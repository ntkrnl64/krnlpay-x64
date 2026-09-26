import { createSign, createVerify } from "node:crypto";
import { alipayTimeoutExpress } from "../../shared/payment";
import { CodedError } from "../http/errors";

export type AlipayPrecreate = {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  out_trade_no?: string;
  qr_code?: string;
};

const GATEWAY_DEFAULT = "https://openapi.alipay.com/gateway.do";
const GATEWAY_TIMEOUT_MS = 15_000;

export function shanghaiParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour,
    minute: pick("minute"),
    second: pick("second"),
  };
}

export function alipayTimestamp(date = new Date()): string {
  const clock = shanghaiParts(date);
  return `${clock.year}-${clock.month}-${clock.day} ${clock.hour}:${clock.minute}:${clock.second}`;
}

export function generateOrderNo(date = new Date()): string {
  const clock = shanghaiParts(date);
  const compact = `${clock.year}${clock.month}${clock.day}${clock.hour}${clock.minute}${clock.second}`;
  const millis = String(date.getMilliseconds()).padStart(3, "0");
  return `${compact}${millis}${randomDigits(3)}${randomDigits(3)}`;
}

function randomDigits(count: number): string {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  let digits = "";
  for (const byte of bytes) {
    digits += String(byte % 10);
  }
  return digits;
}

export function buildSignContent(
  params: Record<string, string>,
  mode: "request" | "notify",
): string {
  const excluded = mode === "notify" ? new Set(["sign", "sign_type"]) : new Set(["sign"]);
  return Object.keys(params)
    .filter((key) => !excluded.has(key) && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function signRSA2(content: string, privateKey: string): string {
  const pems = candidateKeys(privateKey, "private");
  let lastError: unknown;
  for (const pem of pems) {
    try {
      const signer = createSign("RSA-SHA256");
      signer.update(content);
      signer.end();
      return signer.sign(pem, "base64");
    } catch (error) {
      lastError = error;
    }
  }
  throw new CodedError("ERR_ALIPAY_KEY", { detail: { tried: pems.length }, cause: lastError });
}

export function verifyRSA2(content: string, signature: string, publicKey: string): boolean {
  const pems = candidateKeys(publicKey, "public");
  for (const pem of pems) {
    try {
      const verifier = createVerify("RSA-SHA256");
      verifier.update(content);
      verifier.end();
      if (verifier.verify(pem, signature, "base64")) {
        return true;
      }
    } catch {
      // Try the next key wrapper.
    }
  }
  return false;
}

function candidateKeys(raw: string, kind: "private" | "public"): string[] {
  const value = raw.replace(/\\n/g, "\n").trim();
  if (value.includes("BEGIN")) {
    return [value.endsWith("\n") ? value : `${value}\n`];
  }
  const body = (value.replace(/\s+/g, "").match(/.{1,64}/g) ?? [value]).join("\n");
  if (kind === "private") {
    return [
      `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`,
      `-----BEGIN RSA PRIVATE KEY-----\n${body}\n-----END RSA PRIVATE KEY-----\n`,
    ];
  }
  return [
    `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`,
    `-----BEGIN RSA PUBLIC KEY-----\n${body}\n-----END RSA PUBLIC KEY-----\n`,
  ];
}

export function extractSignedNode(
  raw: string,
  nodeName: string,
): { content: string; sign: string } {
  const detail = { node: nodeName, body: snippet(raw) };
  const marker = `"${nodeName}"`;
  const markerAt = raw.indexOf(marker);
  if (markerAt < 0) {
    throw new CodedError("ERR_ALIPAY_NODE_MISSING", { detail });
  }
  let index = raw.indexOf(":", markerAt + marker.length);
  if (index < 0) {
    throw new CodedError("ERR_ALIPAY_NODE_MISSING", { detail });
  }
  index += 1;
  while (index < raw.length && raw[index] === " ") {
    index += 1;
  }
  if (raw[index] !== "{") {
    throw new CodedError("ERR_ALIPAY_NODE_NOT_OBJECT", { detail });
  }
  const start = index;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        index += 1;
        break;
      }
    }
  }
  if (depth !== 0) {
    throw new CodedError("ERR_ALIPAY_NODE_INCOMPLETE", { detail });
  }
  const signMatch = /"sign"\s*:\s*"([^"]+)"/.exec(raw);
  if (!signMatch?.[1]) {
    throw new CodedError("ERR_ALIPAY_SIGN_MISSING", { detail });
  }
  return { content: raw.slice(start, index), sign: signMatch[1] };
}

export async function precreate(input: {
  gateway: string | undefined;
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  orderNo: string;
  subject: string;
  totalAmount: string;
}): Promise<string> {
  const params: Record<string, string> = {
    app_id: input.appId,
    method: "alipay.trade.precreate",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: alipayTimestamp(),
    version: "1.0",
    notify_url: input.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: input.orderNo,
      total_amount: input.totalAmount,
      subject: input.subject,
      timeout_express: alipayTimeoutExpress(),
    }),
  };
  params.sign = signRSA2(buildSignContent(params, "request"), input.privateKey);

  const gateway = input.gateway || GATEWAY_DEFAULT;
  const body = new URLSearchParams(params);
  let response: Response;
  try {
    response = await fetch(gateway, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new CodedError("ERR_ALIPAY_UNREACHABLE", { detail: { gateway, timeout_ms: GATEWAY_TIMEOUT_MS }, cause: error });
  }
  const raw = await response.text();
  if (!response.ok) {
    throw new CodedError("ERR_ALIPAY_HTTP", {
      params: { status: response.status },
      detail: { gateway, status: response.status, body: snippet(raw) },
    });
  }

  const signed = extractSignedNode(raw, "alipay_trade_precreate_response");
  if (!verifyRSA2(signed.content, signed.sign, input.publicKey)) {
    throw new CodedError("ERR_ALIPAY_BAD_SIGNATURE", { detail: { sign_length: signed.sign.length, body: snippet(raw) } });
  }
  const parsed = JSON.parse(signed.content) as AlipayPrecreate;
  const outcome = {
    code: parsed.code,
    msg: parsed.msg,
    sub_code: parsed.sub_code,
    sub_msg: parsed.sub_msg,
    out_trade_no: parsed.out_trade_no,
  };
  if (parsed.code !== "10000") {
    throw new CodedError("ERR_ALIPAY_REJECTED", { params: { code: parsed.sub_code ?? parsed.code }, detail: outcome });
  }
  if (!parsed.qr_code) {
    throw new CodedError("ERR_ALIPAY_NO_QR", { detail: outcome });
  }
  return parsed.qr_code;
}

function snippet(raw: string, max = 500): string {
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}
