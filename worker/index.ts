import { errorFields, log, requestIdFor, runWithContext } from "./http/context";
import { allow, apiError, clientIp, finalize } from "./http/respond";
import { handleAdmin } from "./routes/admin";
import { createOrder, notify, orderStatus } from "./routes/orders";
import { publicShop, shopIcon } from "./routes/shop";

export default {
  async fetch(request, env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const context = { requestId: requestIdFor(request), method: request.method, path };
  return runWithContext(context, async () => {
    try {
      return finalize(await route(request, env, url, path), request);
    } catch (error) {
      log.error("unhandled error", errorFields(error));
      return finalize(apiError(500, "ERR_INTERNAL"), request);
    }
  });
}

async function route(request: Request, env: Env, url: URL, path: string): Promise<Response> {
  if (!path.startsWith("/api/")) {
    // Only real client routes receive the app shell; unknown URLs stay 404.
    const isPage = /^(?:\/|\/zpay|\/admin|\/order\/[^/]+)$/i.test(path);
    if (isPage && (request.method === "GET" || request.method === "HEAD")) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/";
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    const accept = request.headers.get("Accept") ?? "";
    if (accept.includes("text/html")) {
      return new Response("404 Not Found", { status: 404, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
    return apiError(404, "ERR_ROUTE_NOT_FOUND");
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  return routeApi(request, env, url, path);
}

async function routeApi(request: Request, env: Env, url: URL, path: string): Promise<Response> {
  const notifyPath = path === "/api/v1/alipay/orders/notify";
  if (!notifyPath) {
    const allowed = await allow(env.ALIPAY_API_LIMITER, clientIp(request));
    if (!allowed) {
      log.warn("rate limited", { limiter: "api" });
      return apiError(429, "ERR_RATE_LIMITED");
    }
  }

  if (path.startsWith("/api/admin")) {
    return handleAdmin(request, env, url, path);
  }
  if (path === "/api/v1/shop" && request.method === "GET") {
    return publicShop(env);
  }
  if (path === "/api/v1/shop/icon" && request.method === "GET") {
    return shopIcon(env, url);
  }
  if (path === "/api/v1/alipay/orders" && request.method === "POST") {
    return createOrder(request, env);
  }
  if (notifyPath && request.method === "POST") {
    return notify(request, env);
  }
  if (path.startsWith("/api/v1/alipay/orders/") && request.method === "GET") {
    const orderNo = decodeURIComponent(path.slice("/api/v1/alipay/orders/".length));
    return orderStatus(env, orderNo);
  }

  return apiError(404, "ERR_ROUTE_NOT_FOUND");
}
