import type { ErrorCode, Issue, Params } from "../../shared/errors";
import { debugMessage } from "../../shared/messages";

export type { ApiErrorBody, ErrorCode, Issue, Params } from "../../shared/errors";

export type FieldErrors = Record<string, Issue[]>;

export function issue(code: ErrorCode, params?: Params): Issue {
  return params ? { code, params } : { code };
}

export class CodedError extends Error {
  readonly code: ErrorCode;
  readonly params?: Params;
  readonly detail?: Record<string, unknown>;

  constructor(code: ErrorCode, options?: { params?: Params; detail?: Record<string, unknown>; cause?: unknown }) {
    super(debugMessage(code, options?.params), options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CodedError";
    this.code = code;
    this.params = options?.params;
    this.detail = options?.detail;
  }
}
