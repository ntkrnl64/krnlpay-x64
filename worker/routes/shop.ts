import { session } from "../domain/orders";
import { decodeIcon, getSettings, iconVersion, listProducts, publicIcon } from "../domain/shop";
import { apiError, json } from "../http/respond";

export async function publicShop(env: Env): Promise<Response> {
  const db = session(env.DB);
  const settings = await getSettings(db);
  const products = await listProducts(db, true);
  return json({ ...settings, icon: publicIcon(settings.icon), products });
}

export async function shopIcon(env: Env, url: URL): Promise<Response> {
  const settings = await getSettings(session(env.DB));
  const decoded = decodeIcon(settings.icon);
  if (!decoded) {
    return apiError(404, "ERR_ICON_NOT_SET");
  }
  const current = url.searchParams.get("v") === iconVersion(settings.icon);
  return new Response(decoded.bytes, {
    headers: {
      "Content-Type": decoded.type,
      "Cache-Control": current ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
