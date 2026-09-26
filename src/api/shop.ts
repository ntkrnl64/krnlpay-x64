import type { Shop } from "@shared/contract";
import { send } from "./http";

export function getShop(): Promise<Shop> {
  return send("/api/v1/shop");
}
