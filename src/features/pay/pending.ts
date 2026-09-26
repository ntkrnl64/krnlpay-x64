export { PAY_WINDOW_MS } from "@shared/payment";

const PENDING_KEY = "krnlpay-pending";
const PENDING_GRACE_MS = 30 * 60 * 1000;

export type PendingOrder = {
  orderNo: string;
  qrUrl: string;
  amount: number;
  label: string;
  productId: number | null;
  expiresAt: number;
};

export function httpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function withOrderNo(redirect: string, orderNo: string): string {
  const url = new URL(redirect);
  url.searchParams.set("order_no", orderNo);
  return url.toString();
}

export function resultPath(orderNo: string, redirect: string | null): string {
  const path = `/order/${encodeURIComponent(orderNo)}`;
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}

export function loadPending(): PendingOrder | null {
  const value = readPending();
  if (!value) {
    return null;
  }
  if (Date.now() > value.expiresAt + PENDING_GRACE_MS) {
    clearPending();
    return null;
  }
  return value;
}

function readPending(): PendingOrder | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as PendingOrder;
    if (typeof value.orderNo !== "string" || typeof value.expiresAt !== "number") {
      localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return value;
  } catch {
    localStorage.removeItem(PENDING_KEY);
    return null;
  }
}

export function savePending(order: PendingOrder): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(order));
}

export function clearPending(orderNo?: string): void {
  if (orderNo) {
    const current = readPending();
    if (current && current.orderNo !== orderNo) {
      return;
    }
  }
  localStorage.removeItem(PENDING_KEY);
}

export function isLive(order: PendingOrder): boolean {
  return Date.now() < order.expiresAt;
}

export function onVisible(callback: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === "visible") {
      callback();
    }
  };
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("focus", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("focus", handler);
  };
}
