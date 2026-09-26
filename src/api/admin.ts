import type { Order, Pager, Product, ShopSettings } from "@shared/contract";
import { readError, send } from "./http";

export function getTurnstileSitekey(): Promise<{ sitekey: string }> {
  return send("/api/admin/turnstile");
}

export function adminLogin(password: string, token: string): Promise<{ success: boolean }> {
  return send("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password, "cf-turnstile-response": token }),
  });
}

export function adminLogout(): Promise<{ success: boolean }> {
  return send("/api/admin/logout", { method: "POST" });
}

export async function adminSession(): Promise<boolean> {
  const response = await fetch("/api/admin/session", { headers: { Accept: "application/json" } });
  if (response.ok) {
    return true;
  }
  if (response.status === 401) {
    return false;
  }
  throw await readError(response);
}

export function listProducts(): Promise<Product[]> {
  return send("/api/admin/products");
}

export function createProduct(input: Omit<Product, "id">): Promise<{ data: Product }> {
  return send("/api/admin/products", { method: "POST", body: JSON.stringify(input) });
}

export function updateProduct(id: number, input: Omit<Product, "id">): Promise<{ success: boolean }> {
  return send(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteProduct(id: number): Promise<{ success: boolean }> {
  return send(`/api/admin/products/${id}`, { method: "DELETE" });
}

export function getSettings(): Promise<ShopSettings> {
  return send("/api/admin/settings");
}

export function saveSettings(settings: ShopSettings): Promise<{ success: boolean }> {
  return send("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
}

export function listAdminOrders(page: number): Promise<{ data: Order[]; pager: Pager }> {
  const url = new URL("/api/admin/orders", window.location.origin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "10");
  url.searchParams.set("sort", "id");
  url.searchParams.set("order", "desc");
  return send(url.pathname + url.search);
}
