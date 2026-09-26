export function formatYuan(amount: number): string {
  return `￥${formatNumber(amount)}`;
}

export function formatNumber(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

export function parseMoney(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString("zh-CN", {
    year: sameYear ? undefined : "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
