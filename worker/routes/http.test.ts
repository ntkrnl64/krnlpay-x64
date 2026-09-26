import { describe, expect, test } from "bun:test";
import { handleRequest } from "../index";

function testEnv(limiterSuccess = true): Env {
  const limiter = { limit: async () => ({ success: limiterSuccess }) };
  return {
    ALIPAY_GATEWAY: "https://openapi.alipay.com/gateway.do",
    ALIPAY_APP_ID: "",
    ALIPAY_PRIVATE_KEY: "",
    ALIPAY_PUBLIC_KEY: "",
    ALIPAY_NOTIFY_URL: "",
    ADMIN_PASSWORD_HASH: "configured",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET: "test-secret",
    TURNSTILE_HOSTNAMES: "localhost",
    ALIPAY_API_LIMITER: limiter,
    CREATE_ORDER_LIMITER: limiter,
    ADMIN_LOGIN_LIMITER: limiter,
    DB: {
      withSession() {
        throw new Error("db should not be used");
      },
    },
  } as Env;
}

describe("http routes", () => {
  test("unknown pages and missing assets return 404", async () => {
    for (const path of ["/missing", "/admin/missing", "/order", "/order/123/extra", "/assets/missing.js"]) {
      const response = await handleRequest(
        new Request(`http://localhost${path}`, { headers: { Accept: "text/html" } }),
        testEnv(),
      );
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("404 Not Found");
    }
  });

  test("serves the app shell for valid page routes on GET and HEAD", async () => {
    const env = testEnv();
    env.ASSETS = {
      async fetch(request: Request) {
        expect(new URL(request.url).pathname).toBe("/");
        return new Response(request.method === "HEAD" ? null : "app shell", {
          headers: { "Content-Type": "text/html" },
        });
      },
    } as Fetcher;
    for (const path of ["/", "/zpay", "/admin", "/admin/", "/order/123?source=alipay"]) {
      for (const method of ["GET", "HEAD"]) {
        const response = await handleRequest(new Request(`http://localhost${path}`, { method }), env);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(method === "HEAD" ? "" : "app shell");
      }
    }
  });

  test("returns 422 before touching the database", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/v1/alipay/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      testEnv(),
    );
    expect(response.status).toBe(422);
  });

  test("returns 400 for a short order number", async () => {
    const response = await handleRequest(new Request("http://localhost/api/v1/alipay/orders/123"), testEnv());
    expect(response.status).toBe(400);
  });

  test("errors are codes with a request id, never prose", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/v1/alipay/orders/123", { headers: { "CF-Ray": "ray-123" } }),
      testEnv(),
    );
    expect(response.headers.get("X-Request-Id")).toBe("ray-123");
    expect(await response.json()).toEqual({ code: "ERR_ORDER_NO_INVALID", request_id: "ray-123" });
  });

  test("validation errors carry per-field codes and params", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/v1/alipay/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 0, source: "alipay" }),
      }),
      testEnv(),
    );
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.code).toBe("ERR_VALIDATION");
    expect(body.fields).toEqual({ amount: [{ code: "ERR_AMOUNT_TOO_SMALL", params: { min: 0.01 } }] });
    expect(typeof body.request_id).toBe("string");
  });

  test("malformed json is reported as a code", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/v1/alipay/orders", { method: "POST", body: "{" }),
      testEnv(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "ERR_INVALID_JSON" });
  });

  test("returns 429 when the api limiter is exhausted", async () => {
    const response = await handleRequest(new Request("http://localhost/api/v1/alipay/orders/"), testEnv(false));
    expect(response.status).toBe(429);
  });

  test("does not publish the order list", async () => {
    const response = await handleRequest(new Request("http://localhost/api/v1/alipay/orders"), testEnv());
    expect(response.status).toBe(404);
  });

  test("rejects admin login without a turnstile token", async () => {
    const response = await handleRequest(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "anything-at-all" }),
      }),
      testEnv(),
    );
    expect(response.status).toBe(403);
  });

  test("rejects an anonymous order list", async () => {
    const response = await handleRequest(new Request("http://localhost/api/admin/orders"), testEnv());
    expect(response.status).toBe(401);
  });
});
