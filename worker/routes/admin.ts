import { debugIssues } from "../../shared/messages";
import { errorFields, log } from "../http/context";
import { apiError, clientIp, json, readJson, validationError } from "../http/respond";
import { listOrders, session } from "../domain/orders";
import { verifyPassword } from "../domain/password";
import {
  deleteProduct,
  getSettings,
  insertProduct,
  listProducts,
  parseProduct,
  parseSettings,
  saveSettings,
  updateProduct,
} from "../domain/shop";
import {
  clearSessionCookie,
  issueSession,
  readSessionToken,
  requestIsSecure,
  sessionCookie,
  sessionIsValid,
} from "../domain/session";
import { hostnameAllowlist, verifyTurnstile } from "../domain/turnstile";

export async function handleAdmin(request: Request, env: Env, url: URL, path: string): Promise<Response> {
  if (path === "/api/admin/turnstile" && request.method === "GET") {
    return json({ sitekey: env.TURNSTILE_SITE_KEY || "" });
  }
  if (path === "/api/admin/login" && request.method === "POST") {
    return login(request, env);
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie(requestIsSecure(request)) });
  }

  const denied = await requireAdmin(request, env);
  if (denied) {
    return denied;
  }

  if (path === "/api/admin/session" && request.method === "GET") {
    return json({ success: true });
  }
  if (path === "/api/admin/settings" && request.method === "GET") {
    return json(await getSettings(session(env.DB)));
  }
  if (path === "/api/admin/settings" && request.method === "PUT") {
    return putSettings(request, env);
  }
  if (path === "/api/admin/products" && request.method === "GET") {
    return json(await listProducts(session(env.DB), false));
  }
  if (path === "/api/admin/products" && request.method === "POST") {
    return createProduct(request, env);
  }
  if (path.startsWith("/api/admin/products/") && request.method === "PUT") {
    return changeProduct(request, env, path);
  }
  if (path.startsWith("/api/admin/products/") && request.method === "DELETE") {
    return removeProduct(env, path);
  }
  if (path === "/api/admin/orders" && request.method === "GET") {
    return json(await listOrders(session(env.DB), url, "/api/admin/orders"));
  }
  return apiError(404, "ERR_ROUTE_NOT_FOUND");
}

async function login(request: Request, env: Env): Promise<Response> {
  const limit = await env.ADMIN_LOGIN_LIMITER.limit({ key: clientIp(request) });
  if (!limit.success) {
    log.warn("rate limited", { limiter: "admin_login" });
    return apiError(429, "ERR_RATE_LIMITED");
  }
  if (!env.ADMIN_PASSWORD_HASH) {
    log.error("admin password hash missing");
    return apiError(503, "ERR_ADMIN_PASSWORD_UNSET");
  }

  const read = await readJson(request);
  if ("response" in read) {
    return read.response;
  }
  const record = isRecord(read.body) ? read.body : {};
  const verdict = await verifyTurnstile({
    secret: env.TURNSTILE_SECRET,
    token: record["cf-turnstile-response"],
    remoteIp: clientIp(request),
    hostnames: hostnameAllowlist(env.TURNSTILE_HOSTNAMES),
  });
  if (verdict === "misconfigured") {
    log.error("turnstile secret missing");
    return apiError(503, "ERR_TURNSTILE_UNSET");
  }
  if (verdict === "forbidden") {
    return apiError(403, "ERR_TURNSTILE_FAILED");
  }

  const password = typeof record.password === "string" ? record.password : "";
  let match = false;
  try {
    match = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  } catch (error) {
    log.error("password verify failed", errorFields(error));
    return apiError(500, "ERR_INTERNAL");
  }
  if (!match) {
    log.warn("admin login rejected", { reason: "wrong_password" });
    return apiError(401, "ERR_WRONG_PASSWORD");
  }

  log.info("admin signed in");
  const token = await issueSession(env.ADMIN_PASSWORD_HASH);
  return json({ success: true }, 200, { "Set-Cookie": sessionCookie(token, requestIsSecure(request)) });
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  if (!env.ADMIN_PASSWORD_HASH) {
    log.error("admin password hash missing");
    return apiError(503, "ERR_ADMIN_PASSWORD_UNSET");
  }
  const ok = await sessionIsValid(readSessionToken(request.headers.get("Cookie")), env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    return apiError(401, "ERR_UNAUTHENTICATED");
  }
  return null;
}

async function putSettings(request: Request, env: Env): Promise<Response> {
  const read = await readJson(request);
  if ("response" in read) {
    return read.response;
  }
  const parsed = parseSettings(read.body);
  if ("errors" in parsed) {
    log.info("settings rejected", { fields: debugIssues(parsed.errors) });
    return validationError(parsed.errors);
  }
  await saveSettings(session(env.DB), parsed.value);
  log.info("settings saved");
  return json({ success: true, data: parsed.value });
}

async function createProduct(request: Request, env: Env): Promise<Response> {
  const parsed = await readProduct(request);
  if (parsed instanceof Response) {
    return parsed;
  }
  const product = await insertProduct(session(env.DB), parsed, new Date().toISOString());
  log.info("product created", { product_id: product.id });
  return json({ success: true, data: product }, 201);
}

async function changeProduct(request: Request, env: Env, path: string): Promise<Response> {
  const id = productId(path);
  if (!id) {
    return apiError(404, "ERR_PRODUCT_NOT_FOUND");
  }
  const parsed = await readProduct(request);
  if (parsed instanceof Response) {
    return parsed;
  }
  const updated = await updateProduct(session(env.DB), id, parsed, new Date().toISOString());
  if (!updated) {
    return apiError(404, "ERR_PRODUCT_NOT_FOUND");
  }
  log.info("product updated", { product_id: id });
  return json({ success: true });
}

async function removeProduct(env: Env, path: string): Promise<Response> {
  const id = productId(path);
  if (!id) {
    return apiError(404, "ERR_PRODUCT_NOT_FOUND");
  }
  const removed = await deleteProduct(session(env.DB), id);
  if (!removed) {
    return apiError(404, "ERR_PRODUCT_NOT_FOUND");
  }
  log.info("product deleted", { product_id: id });
  return json({ success: true });
}

async function readProduct(request: Request) {
  const read = await readJson(request);
  if ("response" in read) {
    return read.response;
  }
  const parsed = parseProduct(read.body);
  if ("errors" in parsed) {
    log.info("product rejected", { fields: debugIssues(parsed.errors) });
    return validationError(parsed.errors);
  }
  return parsed.value;
}

function productId(path: string): number | null {
  const raw = path.slice("/api/admin/products/".length);
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return id > 0 ? id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
