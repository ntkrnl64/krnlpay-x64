import { buildSignContent, generateOrderNo, precreate, verifyRSA2 } from "../domain/alipay";
import { parseCheckout, resolveCheckout } from "../domain/checkout";
import { formatAmount } from "../domain/money";
import { getByOrderNo, insertOrder, isOrderNo, markOrder, sameMoney, session } from "../domain/orders";
import { getProduct, getSettings } from "../domain/shop";
import { errorFields, log } from "../http/context";
import { CodedError } from "../http/errors";
import { allow, apiError, clientIp, json, readJson, validationError } from "../http/respond";
import { debugIssues, debugMessage } from "../../shared/messages";

const PAID = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

export async function createOrder(request: Request, env: Env): Promise<Response> {
  const allowed = await allow(env.CREATE_ORDER_LIMITER, `${clientIp(request)}:create`);
  if (!allowed) {
    log.warn("rate limited", { limiter: "create_order" });
    return apiError(429, "ERR_ORDER_RATE_LIMITED");
  }

  const read = await readJson(request);
  if ("response" in read) {
    return read.response;
  }

  const parsed = parseCheckout(read.body);
  if ("errors" in parsed) {
    log.info("checkout rejected", { fields: debugIssues(parsed.errors) });
    return validationError(parsed.errors);
  }

  const db = session(env.DB);
  const settings = await getSettings(db);
  const product = parsed.value.kind === "product" ? await getProduct(db, parsed.value.productId) : null;
  const resolved = resolveCheckout(parsed.value, settings, product);
  if (!resolved.ok) {
    log.info("checkout refused", {
      code: resolved.code,
      message: debugMessage(resolved.code, resolved.params),
      request: parsed.value,
    });
    return apiError(resolved.status, resolved.code, { params: resolved.params });
  }

  const config = alipayConfig(env);
  if (!config) {
    return apiError(503, "ERR_PAYMENT_UNAVAILABLE");
  }

  const orderNo = generateOrderNo();
  const orderLog = {
    order_no: orderNo,
    amount: formatAmount(resolved.amount),
    product_id: resolved.productId,
    source: parsed.value.source,
  };
  const startedAt = Date.now();
  let qrcode: string;
  try {
    qrcode = await precreate({
      gateway: env.ALIPAY_GATEWAY,
      appId: config.appId,
      privateKey: config.privateKey,
      publicKey: config.publicKey,
      notifyUrl: config.notifyUrl,
      orderNo,
      subject: resolved.orderName,
      totalAmount: formatAmount(resolved.amount),
    });
  } catch (error) {
    log.error("precreate failed", { ...orderLog, elapsed_ms: Date.now() - startedAt, ...errorFields(error) });
    return apiError(502, "ERR_ORDER_CREATE_FAILED", { cause: error instanceof CodedError ? error.code : undefined });
  }

  try {
    const order = await insertOrder(db, {
      orderNo,
      orderName: resolved.orderName,
      amount: resolved.amount,
      qrcode,
      source: parsed.value.source,
      productId: resolved.productId,
      now: new Date().toISOString(),
    });
    log.info("order created", { ...orderLog, elapsed_ms: Date.now() - startedAt });
    return json({ success: true, data: order });
  } catch (error) {
    log.error("insert order failed", { ...orderLog, ...errorFields(error) });
    return apiError(500, "ERR_ORDER_CREATE_FAILED", { cause: error instanceof CodedError ? error.code : undefined });
  }
}

export async function orderStatus(env: Env, orderNo: string): Promise<Response> {
  if (!isOrderNo(orderNo)) {
    return apiError(400, "ERR_ORDER_NO_INVALID");
  }
  const order = await getByOrderNo(session(env.DB), orderNo);
  if (!order) {
    log.warn("order not found", { order_no: orderNo });
    return apiError(404, "ERR_ORDER_NOT_FOUND");
  }
  return json({ success: true, data: order });
}

export async function notify(request: Request, env: Env): Promise<Response> {
  const config = alipayConfig(env);
  if (!config) {
    return apiError(503, "ERR_PAYMENT_UNAVAILABLE");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (error) {
    log.error("notify form parse failed", { content_type: request.headers.get("Content-Type"), ...errorFields(error) });
    return apiError(400, "ERR_NOTIFY_REJECTED");
  }

  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  const notifyLog = {
    notify_id: params.notify_id ?? "",
    order_no: params.out_trade_no ?? "",
    trade_no: params.trade_no ?? "",
    trade_status: params.trade_status ?? "",
    total_amount: params.total_amount ?? "",
  };

  const content = buildSignContent(params, "notify");
  if (!params.sign || !verifyRSA2(content, params.sign, config.publicKey)) {
    log.error("notify signature rejected", { ...notifyLog, has_sign: Boolean(params.sign), sign_type: params.sign_type ?? "" });
    return apiError(400, "ERR_NOTIFY_REJECTED");
  }

  if (params.app_id !== config.appId) {
    log.error("notify app mismatch", { ...notifyLog, app_id: params.app_id ?? "" });
    return apiError(400, "ERR_NOTIFY_REJECTED");
  }

  log.info("alipay notify", notifyLog);

  const orderNo = params.out_trade_no ?? "";
  const db = session(env.DB);
  const order = await getByOrderNo(db, orderNo);
  if (!order) {
    log.error("notify order missing", notifyLog);
    return apiError(404, "ERR_ORDER_NOT_FOUND");
  }
  if (order.is_paid) {
    log.warn("notify order already paid", notifyLog);
    return new Response("success", { headers: { "Content-Type": "text/plain;charset=utf-8" } });
  }

  const tradeStatus = params.trade_status ?? "";
  const isPaid = PAID.has(tradeStatus);
  if (isPaid && !sameMoney(order.amount, params.total_amount)) {
    log.error("notify amount mismatch", { ...notifyLog, expected_amount: formatAmount(order.amount) });
    return apiError(400, "ERR_NOTIFY_REJECTED");
  }

  try {
    await markOrder(db, orderNo, tradeStatus, isPaid, new Date().toISOString());
  } catch (error) {
    log.error("notify save failed", { ...notifyLog, ...errorFields(error) });
    return apiError(500, "ERR_NOTIFY_SAVE_FAILED");
  }
  log.info("order status updated", { ...notifyLog, is_paid: isPaid });

  return new Response("success", { headers: { "Content-Type": "text/plain;charset=utf-8" } });
}

function alipayConfig(env: Env): { appId: string; privateKey: string; publicKey: string; notifyUrl: string } | null {
  const missing = (
    [
      ["ALIPAY_APP_ID", env.ALIPAY_APP_ID],
      ["ALIPAY_PRIVATE_KEY", env.ALIPAY_PRIVATE_KEY],
      ["ALIPAY_PUBLIC_KEY", env.ALIPAY_PUBLIC_KEY],
      ["ALIPAY_NOTIFY_URL", env.ALIPAY_NOTIFY_URL],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    log.error("alipay config missing", { missing });
    return null;
  }
  return {
    appId: env.ALIPAY_APP_ID,
    privateKey: env.ALIPAY_PRIVATE_KEY,
    publicKey: env.ALIPAY_PUBLIC_KEY,
    notifyUrl: env.ALIPAY_NOTIFY_URL,
  };
}
