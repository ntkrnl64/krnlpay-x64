import { describe, expect, test } from "bun:test";
import { CLIENT_ERROR_CODES, ERROR_CODES } from "../../shared/errors";
import { debugIssues, debugMessage } from "../../shared/messages";
import { en } from "../../shared/messages.en";
import { CodedError } from "./errors";

describe("shared error messages", () => {
  test("every code has an English description", () => {
    for (const code of [...ERROR_CODES, ...CLIENT_ERROR_CODES]) {
      expect(en[code]).toBeTruthy();
    }
  });

  test("fills params and falls back for unknown codes", () => {
    expect(debugMessage("ERR_ALIPAY_REJECTED", { code: "ACQ.ACCESS_FORBIDDEN" })).toBe(
      "Alipay rejected the precreate request (ACQ.ACCESS_FORBIDDEN)",
    );
    expect(debugMessage("ERR_FROM_THE_FUTURE")).toBe("Unrecognised error (ERR_FROM_THE_FUTURE)");
  });

  test("renders field issues and coded errors in English", () => {
    expect(debugIssues({ amount: [{ code: "ERR_AMOUNT_TOO_SMALL", params: { min: 0.01 } }] })).toEqual({
      amount: ["ERR_AMOUNT_TOO_SMALL: Amount is below 0.01"],
    });
    expect(new CodedError("ERR_ALIPAY_HTTP", { params: { status: 502 } }).message).toBe(
      "Alipay gateway returned HTTP 502",
    );
  });
});
