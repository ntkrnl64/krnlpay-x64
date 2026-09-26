import { generateKeyPairSync } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  alipayTimestamp,
  buildSignContent,
  extractSignedNode,
  generateOrderNo,
  signRSA2,
  verifyRSA2,
} from "./alipay";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("order numbers", () => {
  test("uses Shanghai time and 23 digits", () => {
    const orderNo = generateOrderNo(new Date("2026-09-26T02:18:00.123Z"));
    expect(orderNo.startsWith("20260926101800123")).toBe(true);
    expect(orderNo).toMatch(/^\d{23}$/);
  });
});

describe("timestamps", () => {
  test("formats Shanghai clock time", () => {
    expect(alipayTimestamp(new Date("2026-09-26T02:18:07.000Z"))).toBe("2026-09-26 10:18:07");
  });
});

describe("signing", () => {
  test("request content keeps sign_type and notify content drops it", () => {
    const params = { sign: "abc", sign_type: "RSA2", app_id: "1", method: "alipay.trade.precreate" };
    expect(buildSignContent(params, "request")).toBe("app_id=1&method=alipay.trade.precreate&sign_type=RSA2");
    expect(buildSignContent(params, "notify")).toBe("app_id=1&method=alipay.trade.precreate");
  });

  test("round-trips RSA2 and accepts a PKCS8 body without headers", () => {
    const content = "app_id=1&method=alipay.trade.precreate";
    const signature = signRSA2(content, privateKey);
    expect(verifyRSA2(content, signature, publicKey)).toBe(true);
    expect(verifyRSA2(`${content}&x=1`, signature, publicKey)).toBe(false);

    const body = privateKey
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s+/g, "");
    expect(signRSA2(content, body)).toBe(signature);
  });

  test("extracts the raw response node used for verification", () => {
    const content = '{"code":"10000","msg":"Success","qr_code":"https://qr.alipay.com/x"}';
    const signature = signRSA2(content, privateKey);
    const raw = `{"alipay_trade_precreate_response":${content},"sign":"${signature}"}`;
    const extracted = extractSignedNode(raw, "alipay_trade_precreate_response");
    expect(extracted.content).toBe(content);
    expect(verifyRSA2(extracted.content, extracted.sign, publicKey)).toBe(true);
  });
});
