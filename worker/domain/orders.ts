import type { Order, Pager } from "../../shared/contract";
import { CodedError } from "../http/errors";
import { formatAmount } from "./money";

const ORDER_NO = /^\d{23}$/;

export function isOrderNo(value: string): boolean {
  return ORDER_NO.test(value);
}

type OrderRow = {
  id: number;
  order_no: string;
  order_name: string;
  amount: number;
  qrcode: string;
  source: string;
  status: string;
  is_paid: number;
  is_deleted: number;
  product_id: number | null;
  created_at: string;
  updated_at: string;
};

const SORTS = new Set([
  "id",
  "order_no",
  "order_name",
  "amount",
  "source",
  "status",
  "is_paid",
  "created_at",
  "updated_at",
]);

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    order_no: row.order_no,
    order_name: row.order_name,
    amount: row.amount,
    qrcode: row.qrcode,
    source: row.source,
    status: row.status,
    is_paid: row.is_paid === 1,
    is_deleted: row.is_deleted === 1,
    product_id: row.product_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function session(db: D1Database): D1DatabaseSession {
  return db.withSession("first-primary");
}

export async function insertOrder(
  db: D1DatabaseSession,
  order: {
    orderNo: string;
    orderName: string;
    amount: number;
    qrcode: string;
    source: string;
    productId: number | null;
    now: string;
  },
): Promise<Order> {
  await db
    .prepare(
      `INSERT INTO orders (order_no, order_name, amount, qrcode, source, status, is_paid, is_deleted, product_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'INIT', 0, 0, ?, ?, ?)`,
    )
    .bind(order.orderNo, order.orderName, order.amount, order.qrcode, order.source, order.productId, order.now, order.now)
    .run();
  const row = await getByOrderNo(db, order.orderNo);
  if (!row) {
    throw new CodedError("ERR_ROW_MISSING", { detail: { table: "orders", order_no: order.orderNo } });
  }
  return row;
}

export async function getByOrderNo(db: D1DatabaseSession, orderNo: string): Promise<Order | null> {
  const row = await db.prepare("SELECT * FROM orders WHERE order_no = ?").bind(orderNo).first<OrderRow>();
  return row ? toOrder(row) : null;
}

export async function markOrder(
  db: D1DatabaseSession,
  orderNo: string,
  status: string,
  isPaid: boolean,
  now: string,
): Promise<void> {
  await db
    .prepare("UPDATE orders SET status = ?, is_paid = ?, updated_at = ? WHERE order_no = ?")
    .bind(status, isPaid ? 1 : 0, now, orderNo)
    .run();
}

export function pagerQuery(url: URL): { perPage: number; sort: string; order: "asc" | "desc" } {
  const requestedPerPage = Number(url.searchParams.get("per_page") ?? "");
  let perPage = 10;
  if (Number.isFinite(requestedPerPage) && requestedPerPage > 0) {
    perPage = Math.min(100, Math.floor(requestedPerPage));
  }
  const requestedSort = url.searchParams.get("sort") ?? "id";
  const sort = SORTS.has(requestedSort) ? requestedSort : "id";
  const order = url.searchParams.get("order") === "desc" ? "desc" : "asc";
  return { perPage, sort, order };
}

export async function listOrders(
  db: D1DatabaseSession,
  requestUrl: URL,
  listPath = "/api/admin/orders",
): Promise<{ data: Order[]; pager: Pager }> {
  const query = pagerQuery(requestUrl);
  const totalRow = await db.prepare("SELECT COUNT(*) AS count FROM orders").first<{ count: number }>();
  const totalCount = Number(totalRow?.count ?? 0);
  const totalPage = totalCount === 0 ? 0 : Math.ceil(totalCount / query.perPage);
  let page = Number(requestUrl.searchParams.get("page") ?? "1");
  if (!Number.isFinite(page) || page <= 0) {
    page = 1;
  }
  if (totalPage === 0) {
    page = 0;
  } else if (page > totalPage) {
    page = totalPage;
  }
  const offset = page <= 0 ? 0 : (page - 1) * query.perPage;
  const rows = await db
    .prepare(`SELECT * FROM orders ORDER BY ${query.sort} ${query.order} LIMIT ? OFFSET ?`)
    .bind(query.perPage, offset)
    .all<OrderRow>();

  return {
    data: (rows.results ?? []).map(toOrder),
    pager: {
      CurrentPage: page,
      PerPage: query.perPage,
      TotalPage: totalPage,
      TotalCount: totalCount,
      NextPageURL: totalPage > page ? pageLink(requestUrl, listPath, page + 1, query) : "",
      PrevPageURL: page > 1 && page <= totalPage ? pageLink(requestUrl, listPath, page - 1, query) : "",
    },
  };
}

function pageLink(
  requestUrl: URL,
  listPath: string,
  page: number,
  query: { perPage: number; sort: string; order: "asc" | "desc" },
): string {
  const url = new URL(listPath, requestUrl.origin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", query.sort);
  url.searchParams.set("order", query.order);
  url.searchParams.set("per_page", String(query.perPage));
  return url.toString();
}

export function sameMoney(left: number, right: string | undefined): boolean {
  if (right === undefined || right === "") {
    return false;
  }
  const paid = Number(right);
  if (!Number.isFinite(paid)) {
    return false;
  }
  return formatAmount(left) === formatAmount(paid);
}
