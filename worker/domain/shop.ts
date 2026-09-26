import type { Product, ShopSettings } from "../../shared/contract";
import { CodedError, issue, type FieldErrors, type Issue } from "../http/errors";
import { MONEY_MAX, MONEY_MIN, moneyIssue, roundMoney } from "./money";

type SettingsRow = {
  shop_name: string;
  icon: string | null;
  tagline: string;
  about: string;
  thank_you: string;
  custom_enabled: number;
  custom_min: number;
  custom_max: number;
  presets: string;
  success_redirect: string;
};

type ProductRow = {
  id: number;
  name: string;
  description: string;
  price: number;
  enabled: number;
  sort_order: number;
};

export const DEFAULT_SETTINGS: ShopSettings = {
  shop_name: "随喜",
  icon: "",
  tagline: "选一笔金额，或选一件东西，用支付宝付清。",
  about: "",
  thank_you: "收到了，谢谢。",
  custom_enabled: true,
  custom_min: 1,
  custom_max: 500,
  presets: [6, 18, 36, 66, 88, 128],
  success_redirect: "",
};

export function publicIcon(icon: string): string {
  return icon.startsWith("data:") ? `/api/v1/shop/icon?v=${iconVersion(icon)}` : icon;
}

export function decodeIcon(icon: string): { type: string; bytes: Uint8Array } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(icon);
  if (!match) {
    return null;
  }
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return { type: match[1], bytes };
}

export function iconVersion(icon: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < icon.length; index += 1) {
    hash ^= icon.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export async function getSettings(db: D1DatabaseSession): Promise<ShopSettings> {
  const row = await db.prepare("SELECT * FROM settings WHERE id = 1").first<SettingsRow>();
  if (!row) {
    return DEFAULT_SETTINGS;
  }
  return {
    shop_name: row.shop_name,
    icon: row.icon ?? "",
    tagline: row.tagline,
    about: row.about,
    thank_you: row.thank_you,
    custom_enabled: row.custom_enabled === 1,
    custom_min: row.custom_min,
    custom_max: row.custom_max,
    presets: parsePresets(row.presets),
    success_redirect: row.success_redirect ?? "",
  };
}

export async function saveSettings(db: D1DatabaseSession, settings: ShopSettings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (id, shop_name, icon, tagline, about, thank_you, custom_enabled, custom_min, custom_max, presets, success_redirect)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         shop_name = excluded.shop_name,
         icon = excluded.icon,
         tagline = excluded.tagline,
         about = excluded.about,
         thank_you = excluded.thank_you,
         custom_enabled = excluded.custom_enabled,
         custom_min = excluded.custom_min,
         custom_max = excluded.custom_max,
         presets = excluded.presets,
         success_redirect = excluded.success_redirect`,
    )
    .bind(
      settings.shop_name,
      settings.icon,
      settings.tagline,
      settings.about,
      settings.thank_you,
      settings.custom_enabled ? 1 : 0,
      settings.custom_min,
      settings.custom_max,
      JSON.stringify(settings.presets),
      settings.success_redirect,
    )
    .run();
}

export function parseSettings(body: unknown): { value: ShopSettings } | { errors: FieldErrors } {
  if (!isRecord(body)) {
    return { errors: { shop_name: [issue("ERR_FIELD_REQUIRED")] } };
  }
  const errors: FieldErrors = {};
  const shopName = text(body.shop_name, 40);
  const tagline = text(body.tagline, 80);
  const about = text(body.about, 1000);
  const thankYou = text(body.thank_you, 120);
  if (!shopName) {
    errors.shop_name = [issue("ERR_FIELD_REQUIRED")];
  } else if (shopName === "too-long") {
    errors.shop_name = [issue("ERR_FIELD_TOO_LONG", { max: 40 })];
  }
  if (tagline === "too-long") {
    errors.tagline = [issue("ERR_FIELD_TOO_LONG", { max: 80 })];
  }
  if (about === "too-long") {
    errors.about = [issue("ERR_FIELD_TOO_LONG", { max: 1000 })];
  }
  if (thankYou === "too-long") {
    errors.thank_you = [issue("ERR_FIELD_TOO_LONG", { max: 120 })];
  }
  const icon = parseIcon(body.icon);
  if ("error" in icon) {
    errors.icon = [icon.error];
  }

  const minError = moneyIssue(body.custom_min);
  const maxError = moneyIssue(body.custom_max);
  if (minError) {
    errors.custom_min = [minError];
  }
  if (maxError) {
    errors.custom_max = [maxError];
  }
  const customMin = typeof body.custom_min === "number" ? roundMoney(body.custom_min) : 0;
  const customMax = typeof body.custom_max === "number" ? roundMoney(body.custom_max) : 0;
  if (!minError && !maxError && customMin > customMax) {
    errors.custom_max = [issue("ERR_RANGE_INVERTED")];
  }

  const presets = Array.isArray(body.presets) ? body.presets : null;
  const presetValues: number[] = [];
  if (!presets || presets.length > 8) {
    errors.presets = [issue("ERR_PRESETS_TOO_MANY", { max: 8 })];
  } else {
    for (const preset of presets) {
      if (typeof preset !== "number" || moneyIssue(preset)) {
        errors.presets = [issue("ERR_PRESETS_INVALID", { min: MONEY_MIN, max: MONEY_MAX })];
        break;
      }
      const rounded = roundMoney(preset);
      if (!minError && !maxError && (rounded < customMin || rounded > customMax)) {
        errors.presets = [issue("ERR_PRESETS_OUT_OF_RANGE")];
        break;
      }
      presetValues.push(rounded);
    }
  }

  const redirect = typeof body.success_redirect === "string" ? body.success_redirect.trim() : "";
  if (redirect && !isHttpUrl(redirect)) {
    errors.success_redirect = [issue("ERR_REDIRECT_INVALID")];
  } else if ([...redirect].length > 300) {
    errors.success_redirect = [issue("ERR_FIELD_TOO_LONG", { max: 300 })];
  }

  if (Object.keys(errors).length > 0 || !shopName || shopName === "too-long") {
    return { errors };
  }
  return {
    value: {
      shop_name: shopName,
      icon: "value" in icon ? icon.value : "",
      tagline: tagline === "too-long" ? "" : tagline,
      about: about === "too-long" ? "" : about,
      thank_you: thankYou === "too-long" ? "" : thankYou,
      custom_enabled: body.custom_enabled === true,
      custom_min: customMin,
      custom_max: customMax,
      presets: presetValues,
      success_redirect: redirect,
    },
  };
}

export async function listProducts(db: D1DatabaseSession, enabledOnly: boolean): Promise<Product[]> {
  const sql = enabledOnly
    ? "SELECT * FROM products WHERE enabled = 1 ORDER BY sort_order ASC, id ASC"
    : "SELECT * FROM products ORDER BY sort_order ASC, id ASC";
  const rows = await db.prepare(sql).all<ProductRow>();
  return (rows.results ?? []).map(toProduct);
}

export async function getProduct(db: D1DatabaseSession, id: number): Promise<Product | null> {
  const row = await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<ProductRow>();
  return row ? toProduct(row) : null;
}

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  enabled: boolean;
  sort_order: number;
};

export function parseProduct(body: unknown): { value: ProductInput } | { errors: FieldErrors } {
  if (!isRecord(body)) {
    return { errors: { name: [issue("ERR_FIELD_REQUIRED")] } };
  }
  const errors: FieldErrors = {};
  const name = text(body.name, 40);
  const description = text(body.description, 200);
  if (!name) {
    errors.name = [issue("ERR_FIELD_REQUIRED")];
  } else if (name === "too-long") {
    errors.name = [issue("ERR_FIELD_TOO_LONG", { max: 40 })];
  }
  if (description === "too-long") {
    errors.description = [issue("ERR_FIELD_TOO_LONG", { max: 200 })];
  }
  const priceError = moneyIssue(body.price);
  if (priceError) {
    errors.price = [priceError];
  }
  const sort = body.sort_order === undefined ? 0 : body.sort_order;
  if (typeof sort !== "number" || !Number.isInteger(sort) || sort < -999 || sort > 999) {
    errors.sort_order = [issue("ERR_SORT_ORDER_INVALID", { min: -999, max: 999 })];
  }
  if (Object.keys(errors).length > 0 || !name || name === "too-long") {
    return { errors };
  }
  return {
    value: {
      name,
      description: description === "too-long" ? "" : description,
      price: roundMoney(body.price as number),
      enabled: body.enabled !== false,
      sort_order: sort as number,
    },
  };
}

export async function insertProduct(db: D1DatabaseSession, input: ProductInput, now: string): Promise<Product> {
  const result = await db
    .prepare(
      `INSERT INTO products (name, description, price, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(input.name, input.description, input.price, input.enabled ? 1 : 0, input.sort_order, now, now)
    .run();
  const id = Number(result.meta.last_row_id);
  const product = await getProduct(db, id);
  if (!product) {
    throw new CodedError("ERR_ROW_MISSING", { detail: { table: "products", id } });
  }
  return product;
}

export async function updateProduct(db: D1DatabaseSession, id: number, input: ProductInput, now: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE products
       SET name = ?, description = ?, price = ?, enabled = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(input.name, input.description, input.price, input.enabled ? 1 : 0, input.sort_order, now, id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteProduct(db: D1DatabaseSession, id: number): Promise<boolean> {
  const result = await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    enabled: row.enabled === 1,
    sort_order: row.sort_order,
  };
}

function parsePresets(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.presets;
    }
    return parsed.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  } catch {
    return DEFAULT_SETTINGS.presets;
  }
}

const ICON_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
const ICON_DATA_MAX = 150_000;
const ICON_URL_MAX = 500;
const ICON_TEXT_MAX = 2;

export function parseIcon(value: unknown): { value: string } | { error: Issue } {
  if (value === undefined || value === null) {
    return { value: "" };
  }
  if (typeof value !== "string") {
    return { error: issue("ERR_ICON_INVALID") };
  }
  const icon = value.trim();
  if (!icon) {
    return { value: "" };
  }
  if (icon.startsWith("data:")) {
    if (!ICON_DATA_URL.test(icon)) {
      return { error: issue("ERR_ICON_TYPE") };
    }
    if (icon.length > ICON_DATA_MAX) {
      return { error: issue("ERR_ICON_TOO_LARGE") };
    }
    return { value: icon };
  }
  if (/^https?:\/\//i.test(icon)) {
    if (!isHttpUrl(icon) || icon.length > ICON_URL_MAX) {
      return { error: issue("ERR_ICON_URL", { max: ICON_URL_MAX }) };
    }
    return { value: icon };
  }
  if (/[\u0000-\u001f<>]/.test(icon) || graphemes(icon) > ICON_TEXT_MAX || [...icon].length > 16) {
    return { error: issue("ERR_ICON_TEXT_TOO_LONG", { max: ICON_TEXT_MAX }) };
  }
  return { value: icon };
}

function graphemes(value: string): number {
  if (typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(value)].length;
  }
  return [...value].length;
}

function text(value: unknown, max: number): string | "too-long" {
  const raw = typeof value === "string" ? value.trim() : "";
  if ([...raw].length > max) {
    return "too-long";
  }
  return raw;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
