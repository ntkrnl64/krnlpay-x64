import type { Order } from "@shared/contract";
import { send } from "./http";

export async function createOrder(input: {
  product_id?: number;
  amount?: number;
  source: string;
}): Promise<Order> {
  const body = await send<{ data: Order }>("/api/v1/alipay/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function getOrderStatus(orderNo: string): Promise<Order> {
  const body = await send<{ data: Order }>(`/api/v1/alipay/orders/${orderNo}`);
  return body.data;
}
