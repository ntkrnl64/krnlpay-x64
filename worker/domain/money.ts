import { issue, type Issue } from "../http/errors";

export const MONEY_MIN = 0.01;
export const MONEY_MAX = 10000;

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function formatAmount(amount: number): string {
  return roundMoney(amount).toFixed(2);
}

export function moneyIssue(value: unknown): Issue | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return issue("ERR_AMOUNT_REQUIRED");
  }
  if (value < MONEY_MIN) {
    return issue("ERR_AMOUNT_TOO_SMALL", { min: MONEY_MIN });
  }
  if (value > MONEY_MAX) {
    return issue("ERR_AMOUNT_TOO_LARGE", { max: MONEY_MAX });
  }
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) >= 1e-6) {
    return issue("ERR_AMOUNT_TOO_PRECISE");
  }
  return null;
}
