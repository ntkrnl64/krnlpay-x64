import {
  Badge,
  Body1,
  Button,
  Caption1,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular, ChevronLeftRegular, ChevronRightRegular, ReceiptRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { listAdminOrders, type Order, type Pager } from "@/api";
import { EmptyState, Section } from "@/components/ui";
import { formatDateTime, formatYuan } from "@/lib/format";
import { useAdmin } from "./context";

const useStyles = makeStyles({
  scroller: {
    overflowX: "auto",
    marginLeft: `calc(-1 * ${tokens.spacingHorizontalXL})`,
    marginRight: `calc(-1 * ${tokens.spacingHorizontalXL})`,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
  },
  table: {
    minWidth: "520px",
  },
  busy: {
    opacity: 0.55,
    transitionProperty: "opacity",
    transitionDuration: tokens.durationNormal,
  },
  time: {
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    color: tokens.colorNeutralForeground2,
  },
  orderNo: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
  },
  amount: {
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  pager: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
  },
});

function statusBadge(order: Order) {
  if (order.is_paid) {
    return (
      <Badge appearance="tint" color="success">
        已支付
      </Badge>
    );
  }
  if (order.status === "TRADE_CLOSED") {
    return (
      <Badge appearance="tint" color="subtle">
        已关闭
      </Badge>
    );
  }
  if (order.status === "WAIT_BUYER_PAY") {
    return (
      <Badge appearance="tint" color="warning">
        等待付款
      </Badge>
    );
  }
  return (
    <Badge appearance="tint" color="informative">
      {order.status === "INIT" ? "未支付" : order.status}
    </Badge>
  );
}

export function OrdersTab({ active }: { active: boolean }) {
  const styles = useStyles();
  const { fail } = useAdmin();
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [pager, setPager] = useState<Pager | null>(null);
  const [loading, setLoading] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(
    async (target: number) => {
      setLoading(true);
      try {
        const result = await listAdminOrders(target);
        setOrders(result.data);
        setPager(result.pager);
        setPage(Math.max(1, result.pager.CurrentPage));
      } catch (caught) {
        fail(caught, "订单加载失败");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  pageRef.current = page;

  useEffect(() => {
    if (active) {
      void load(pageRef.current);
    }
  }, [active, load]);

  const totalPages = pager?.TotalPage ?? 0;

  return (
    <Section
      title="订单"
      description={pager ? `共 ${pager.TotalCount} 笔，最新的在前` : undefined}
      action={
        <Tooltip content="刷新" relationship="label">
          <Button
            appearance="subtle"
            icon={loading ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
            disabled={loading}
            onClick={() => void load(page)}
          />
        </Tooltip>
      }
    >
      {orders === null ? <Spinner label="正在加载订单" /> : null}
      {orders && orders.length === 0 ? (
        <EmptyState icon={<ReceiptRegular />} title="还没有订单" description="访客付款后，订单会出现在这里。" />
      ) : null}
      {orders && orders.length > 0 ? (
        <>
          <div className={styles.scroller}>
            <Table aria-label="订单" className={mergeClasses(styles.table, loading && styles.busy)}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell style={{ width: 120 }}>时间</TableHeaderCell>
                  <TableHeaderCell>名称</TableHeaderCell>
                  <TableHeaderCell style={{ width: 100 }}>金额</TableHeaderCell>
                  <TableHeaderCell style={{ width: 96 }}>状态</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.order_no}>
                    <TableCell>
                      <Caption1 className={styles.time}>{formatDateTime(order.created_at)}</Caption1>
                    </TableCell>
                    <TableCell>
                      <TableCellLayout
                        description={<span className={styles.orderNo}>{order.order_no}</span>}
                        truncate
                      >
                        {order.order_name}
                      </TableCellLayout>
                    </TableCell>
                    <TableCell>
                      <Body1 className={styles.amount}>{formatYuan(order.amount)}</Body1>
                    </TableCell>
                    <TableCell>{statusBadge(order)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 ? (
            <div className={styles.pager}>
              <Caption1>
                第 {page} / {totalPages} 页
              </Caption1>
              <Tooltip content="上一页" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ChevronLeftRegular />}
                  disabled={loading || page <= 1}
                  onClick={() => void load(page - 1)}
                />
              </Tooltip>
              <Tooltip content="下一页" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ChevronRightRegular />}
                  disabled={loading || page >= totalPages}
                  onClick={() => void load(page + 1)}
                />
              </Tooltip>
            </div>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}
