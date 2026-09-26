import type { AnyErrorCode, ApiErrorBody, Issue, Params } from "@shared/errors";
import { debugIssues, debugMessage, describeError } from "@/i18n";

export class ApiError extends Error {
  readonly status: number;
  readonly code: AnyErrorCode | string;
  readonly params?: Params;
  readonly fields?: Record<string, Issue[]>;
  readonly reason?: string;
  readonly requestId?: string;

  constructor(status: number, body: Omit<Partial<ApiErrorBody>, "code"> & { code: AnyErrorCode | string }) {
    super(describeError(body.code, body.params));
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.params = body.params;
    this.fields = body.fields;
    this.reason = body.cause;
    this.requestId = body.request_id;
  }

  fieldMessages(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [field, issues] of Object.entries(this.fields ?? {})) {
      const first = issues[0];
      if (first) {
        result[field] = describeError(first.code, first.params);
      }
    }
    return result;
  }
}

export async function readError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = {};
  }
  const code = typeof body.code === "string" ? body.code : "ERR_UNKNOWN";
  return new ApiError(response.status, {
    ...body,
    code,
    params: code === "ERR_UNKNOWN" && !body.params ? { code: `HTTP ${response.status}` } : body.params,
    request_id: body.request_id ?? response.headers.get("X-Request-Id") ?? undefined,
  });
}

function report(method: string, url: string, error: ApiError): void {
  console.error(
    `[api] ${method} ${url} -> ${error.status || "network"} ${error.code}: ${debugMessage(error.code, error.params)}`,
    {
      params: error.params,
      fields: debugIssues(error.fields),
      cause: error.reason ? `${error.reason}: ${debugMessage(error.reason)}` : undefined,
      request_id: error.requestId,
    },
  );
}

export async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (caught) {
    const error = new ApiError(0, { code: "ERR_NETWORK" });
    console.error(`[api] ${method} ${url} -> network error`, caught);
    throw error;
  }
  if (!response.ok) {
    const error = await readError(response);
    report(method, url, error);
    throw error;
  }
  return (await response.json()) as T;
}
