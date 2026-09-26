import { describe, expect, test } from "bun:test";
import { parseCheckout, resolveCheckout } from "./checkout";
import { DEFAULT_SETTINGS } from "./shop";

const product = {
  id: 3,
  name: "一盏茶",
  description: "",
  price: 18,
  enabled: true,
  sort_order: 0,
};

describe("checkout", () => {
  test("accepts a custom amount and ignores a client order name", () => {
    expect(parseCheckout({ order_name: "充值", amount: 10, source: "alipay" })).toEqual({
      value: { kind: "custom", amount: 10, source: "alipay" },
    });
  });

  test("rejects an empty body", () => {
    const result = parseCheckout(null);
    expect("errors" in result).toBe(true);
  });

  test("rejects amounts outside 0.01 to 10000", () => {
    const low = parseCheckout({ amount: 0, source: "alipay" });
    const high = parseCheckout({ amount: 10000.01, source: "alipay" });
    expect(low).toMatchObject({ errors: { amount: [{ code: "ERR_AMOUNT_TOO_SMALL", params: { min: 0.01 } }] } });
    expect(high).toMatchObject({ errors: { amount: [{ code: "ERR_AMOUNT_TOO_LARGE", params: { max: 10000 } }] } });
  });

  test("charges the stored product price", () => {
    const request = parseCheckout({ product_id: 3, amount: 0.01, source: "alipay" });
    expect(request).toEqual({ value: { kind: "product", productId: 3, source: "alipay" } });
    if (!("value" in request)) {
      return;
    }
    expect(resolveCheckout(request.value, DEFAULT_SETTINGS, product)).toEqual({
      ok: true,
      orderName: "一盏茶",
      amount: 18,
      productId: 3,
    });
  });

  test("rejects a custom amount outside the shop range", () => {
    expect(
      resolveCheckout({ kind: "custom", amount: 1, source: "alipay" }, { ...DEFAULT_SETTINGS, custom_min: 6 }, null),
    ).toEqual({ ok: false, status: 422, code: "ERR_AMOUNT_OUT_OF_RANGE", params: { min: "6.00", max: "500.00" } });
  });
});
