import type { AnyErrorCode, Issue, Params } from "./errors";
import { en } from "./messages.en";

export type MessageCatalog = Record<AnyErrorCode, string>;

export function describe(catalog: MessageCatalog, code: string, params?: Params): string {
  if (code in catalog) {
    return format(catalog[code as AnyErrorCode], params);
  }
  return format(catalog.ERR_UNKNOWN, { code });
}

export function debugMessage(code: string, params?: Params): string {
  return describe(en, code, params);
}

export function debugIssues(fields: Record<string, Issue[]> | undefined): Record<string, string[]> | undefined {
  if (!fields) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(fields).map(([field, issues]) => [
      field,
      issues.map((item) => `${item.code}: ${debugMessage(item.code, item.params)}`),
    ]),
  );
}

function format(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
