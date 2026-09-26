import { AsyncLocalStorage } from "node:async_hooks";
import { CodedError } from "./errors";

export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function requestIdFor(request: Request): string {
  return request.headers.get("CF-Ray") ?? crypto.randomUUID();
}

type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", msg: string, fields?: Fields): void {
  const context = storage.getStore();
  const line = JSON.stringify({
    level,
    msg,
    request_id: context?.requestId,
    method: context?.method,
    path: context?.path,
    ...fields,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

export function errorFields(error: unknown): Fields {
  if (error instanceof CodedError) {
    return {
      code: error.code,
      message: error.message,
      params: error.params,
      detail: error.detail,
      cause: error.cause === undefined ? undefined : describeCause(error.cause),
    };
  }
  return { error: describeCause(error) };
}

function describeCause(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return String(error);
}
