import type { Params } from "@shared/errors";
import { describe } from "@shared/messages";
import { zhCN } from "./zh-CN";

export { debugIssues, debugMessage } from "@shared/messages";

export function describeError(code: string, params?: Params): string {
  return describe(zhCN, code, params);
}
