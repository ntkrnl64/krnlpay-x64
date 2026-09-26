export const PAY_WINDOW_MS = 10 * 60 * 1000;

export const PAY_WINDOW_MINUTES = PAY_WINDOW_MS / 60_000;

export function alipayTimeoutExpress(): string {
  return `${PAY_WINDOW_MINUTES}m`;
}
