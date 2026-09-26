import type { Product, ShopSettings } from "../../shared/contract";
import { issue, type ErrorCode, type FieldErrors, type Params } from "../http/errors";
import { formatAmount, moneyIssue, roundMoney } from "./money";

export type CheckoutRequest =
  | { kind: "product"; productId: number; source: string }
  | { kind: "custom"; amount: number; source: string };

const SOURCE = /^[A-Za-z0-9]{1,20}$/;

export function parseCheckout(body: unknown): { value: CheckoutRequest } | { errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!isRecord(body)) {
    return { errors: { amount: [issue("ERR_CHECKOUT_CHOICE_REQUIRED")], source: [issue("ERR_SOURCE_REQUIRED")] } };
  }

  const source = typeof body.source === "string" ? body.source : "";
  if (!source) {
    errors.source = [issue("ERR_SOURCE_REQUIRED")];
  } else if (!SOURCE.test(source)) {
    errors.source = [
      /^[A-Za-z0-9]+$/.test(source) ? issue("ERR_SOURCE_LENGTH", { min: 1, max: 20 }) : issue("ERR_SOURCE_CHARSET"),
    ];
  }

  const productId = positiveInt(body.product_id);
  if (body.product_id !== undefined && body.product_id !== null && body.product_id !== "" && productId === null) {
    errors.product_id = [issue("ERR_PRODUCT_NOT_FOUND")];
  }

  if (productId !== null && Object.keys(errors).length === 0) {
    return { value: { kind: "product", productId, source } };
  }

  const amountError = moneyIssue(body.amount);
  if (amountError) {
    errors.amount = [amountError];
  }

  if (Object.keys(errors).length > 0 || typeof body.amount !== "number") {
    return { errors };
  }

  return { value: { kind: "custom", amount: roundMoney(body.amount), source } };
}

export function resolveCheckout(
  request: CheckoutRequest,
  settings: ShopSettings,
  product: Product | null,
):
  | { ok: true; orderName: string; amount: number; productId: number | null }
  | { ok: false; status: number; code: ErrorCode; params?: Params } {
  if (request.kind === "product") {
    if (!product) {
      return { ok: false, status: 404, code: "ERR_PRODUCT_NOT_FOUND" };
    }
    if (!product.enabled) {
      return { ok: false, status: 422, code: "ERR_PRODUCT_DISABLED" };
    }
    return { ok: true, orderName: product.name, amount: product.price, productId: product.id };
  }
  if (!settings.custom_enabled) {
    return { ok: false, status: 422, code: "ERR_CUSTOM_AMOUNT_DISABLED" };
  }
  if (request.amount < settings.custom_min || request.amount > settings.custom_max) {
    return {
      ok: false,
      status: 422,
      code: "ERR_AMOUNT_OUT_OF_RANGE",
      params: { min: formatAmount(settings.custom_min), max: formatAmount(settings.custom_max) },
    };
  }
  return { ok: true, orderName: customOrderName(request.amount), amount: request.amount, productId: null };
}

// Sent to Alipay as the trade subject and shown in the buyer's Alipay app, so it cannot be a code.
function customOrderName(amount: number): string {
  return `自定义 ${formatAmount(amount)} 元`;
}

function positiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
