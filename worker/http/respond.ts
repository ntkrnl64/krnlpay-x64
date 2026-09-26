import { currentRequestId } from "./context";
import type { ApiErrorBody, ErrorCode, FieldErrors, Params } from "./errors";

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }
  return Response.json(data, { status, headers });
}

export function apiError(status: number, code: ErrorCode, extra?: { params?: Params; cause?: ErrorCode }): Response {
  const body: ApiErrorBody = { code, request_id: currentRequestId() };
  if (extra?.params) {
    body.params = extra.params;
  }
  if (extra?.cause) {
    body.cause = extra.cause;
  }
  return json(body, status);
}

export function validationError(fields: FieldErrors): Response {
  const body: ApiErrorBody = { code: "ERR_VALIDATION", fields, request_id: currentRequestId() };
  return json(body, 422);
}

export function finalize(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const requestId = currentRequestId();
  if (requestId) {
    headers.set("X-Request-Id", requestId);
  }
  if (request.headers.get("Origin")) {
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Type, X-Request-Id");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function readJson(request: Request): Promise<{ body: unknown } | { response: Response }> {
  try {
    return { body: await request.json() };
  } catch {
    return { response: apiError(400, "ERR_INVALID_JSON") };
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "local";
}

export async function allow(limiter: RateLimit, key: string): Promise<boolean> {
  const result = await limiter.limit({ key });
  return result.success;
}
