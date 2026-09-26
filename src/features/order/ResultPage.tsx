import {
  Body1,
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Title2,
  Tooltip,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowLeftRegular,
  CheckmarkCircleFilled,
  CheckmarkRegular,
  ClockDismissRegular,
  CopyRegular,
  ErrorCircleRegular,
  OpenRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, getOrderStatus, getShop, type Order, type Shop } from "@/api";
import { Amount, EmptyState, Section } from "@/components/ui";
import { PAY_WINDOW_MS, clearPending, httpUrl, onVisible, withOrderNo } from "@/features/pay/pending";
import { applyFavicon } from "@/features/shop/ShopIcon";
import { formatDateTime } from "@/lib/format";

const REDIRECT_SECONDS = 3;
const POLL_MS = 3000;
const CLOSE_GRACE_MS = 60 * 1000;

const useStyles = makeStyles({
  head: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalM,
  },
  icon: {
    fontSize: "72px",
  },
  success: {
    color: tokens.colorStatusSuccessForeground1,
  },
  warning: {
    color: tokens.colorStatusWarningForeground1,
  },
  title: {
    margin: 0,
    overflowWrap: "anywhere",
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  receipt: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
    margin: 0,
    ...shorthands.padding(tokens.spacingVerticalL, 0, 0),
    ...shorthands.borderTop("1px", "dashed", tokens.colorNeutralStroke2),
  },
  term: {
    color: tokens.colorNeutralForeground3,
  },
  value: {
    margin: 0,
    textAlign: "right",
    minWidth: 0,
    overflowWrap: "anywhere",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  mono: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
});

function closed(order: Order): boolean {
  if (order.is_paid) {
    return false;
  }
  if (order.status === "TRADE_CLOSED") {
    return true;
  }
  const created = new Date(order.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created > PAY_WINDOW_MS + CLOSE_GRACE_MS;
}

export function ResultPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { orderNo = "" } = useParams();
  const [params] = useSearchParams();
  const [shop, setShop] = useState<Shop | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const redirect = httpUrl(params.get("redirect")) ?? httpUrl(shop?.success_redirect);
  const target = redirect ? withOrderNo(redirect, orderNo) : null;
  const paid = order?.is_paid === true;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getShop().catch(() => null), getOrderStatus(orderNo)])
      .then(([nextShop, nextOrder]) => {
        if (cancelled) {
          return;
        }
        setShop(nextShop);
        setOrder(nextOrder);
        if (nextShop) {
          applyFavicon(nextShop.icon, nextShop.shop_name);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        const missing =
          caught instanceof ApiError && (caught.code === "ERR_ORDER_NOT_FOUND" || caught.code === "ERR_ORDER_NO_INVALID");
        setError(missing ? "找不到这笔订单，请检查链接是否完整。" : "暂时查不到订单状态，请稍后刷新重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [orderNo]);

  const waiting = order !== null && !order.is_paid && !closed(order);
  useEffect(() => {
    if (!waiting) {
      return;
    }
    let checking = false;
    const check = () => {
      if (checking) {
        return;
      }
      checking = true;
      void getOrderStatus(orderNo)
        .then(setOrder)
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    };
    const poll = window.setInterval(check, POLL_MS);
    const detach = onVisible(check);
    return () => {
      window.clearInterval(poll);
      detach();
    };
  }, [waiting, orderNo]);

  useEffect(() => {
    if (!paid) {
      return;
    }
    clearPending(orderNo);
    if (target) {
      setCountdown(REDIRECT_SECONDS);
    }
  }, [paid, orderNo, target]);

  useEffect(() => {
    if (countdown === null || !target) {
      return;
    }
    if (countdown <= 0) {
      window.location.assign(target);
      return;
    }
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, target]);

  useEffect(() => {
    const name = shop?.shop_name ? ` · ${shop.shop_name}` : "";
    document.title = `${paid ? "付款成功" : "订单详情"}${name}`;
  }, [paid, shop]);

  const backButton = (
    <Button appearance={target && paid ? "subtle" : "primary"} size="large" icon={<ArrowLeftRegular />} onClick={() => navigate("/")}>
      返回店铺
    </Button>
  );

  if (error) {
    return (
      <Section>
        <EmptyState icon={<ErrorCircleRegular />} title="查不到订单" description={error} action={backButton} />
      </Section>
    );
  }

  if (!order) {
    return (
      <Section>
        <Spinner label="正在查询订单" style={{ padding: "48px 0" }} />
      </Section>
    );
  }

  if (!paid) {
    const isClosed = !waiting;
    return (
      <Section>
        <div className={styles.head}>
          {isClosed ? (
            <ClockDismissRegular className={mergeClasses(styles.icon, styles.warning)} aria-hidden />
          ) : (
            <Spinner size="huge" aria-hidden />
          )}
          <Title2 as="h1" className={styles.title}>
            {isClosed ? "订单未完成" : "正在确认付款…"}
          </Title2>
          <Body1 className={styles.muted}>
            {isClosed
              ? "没有收到这笔订单的付款。如果你已经付款，请联系所有者并提供下面的订单号。"
              : "付款完成后，这里会自动更新，请不要重复付款。"}
          </Body1>
          <Amount value={order.amount} size="large" />
        </div>
        <Receipt order={order} shop={shop} paid={false} />
        <div className={styles.actions}>{backButton}</div>
      </Section>
    );
  }

  const host = redirect ? new URL(redirect).host : "";
  return (
    <Section>
      <div className={styles.head}>
        <CheckmarkCircleFilled className={mergeClasses(styles.icon, styles.success)} aria-hidden />
        <Title2 as="h1" className={styles.title}>
          {shop?.thank_you || "收到了，谢谢。"}
        </Title2>
        <Caption1 className={styles.muted}>付款成功</Caption1>
        <Amount value={order.amount} size="hero" />
      </div>
      <Receipt order={order} shop={shop} paid />
      {target && countdown !== null ? (
        <MessageBar intent="info">
          <MessageBarBody>
            {countdown > 0 ? `${countdown} 秒后返回 ${host}` : `正在前往 ${host}…`}
          </MessageBarBody>
          <MessageBarActions>
            <Button size="small" onClick={() => setCountdown(null)}>
              留在本页
            </Button>
          </MessageBarActions>
        </MessageBar>
      ) : null}
      <div className={styles.actions}>
        {target ? (
          <Button as="a" href={target} appearance="primary" size="large" icon={<OpenRegular />} iconPosition="after">
            前往 {host}
          </Button>
        ) : null}
        {backButton}
      </div>
    </Section>
  );
}

function Receipt({ order, shop, paid }: { order: Order; shop: Shop | null; paid: boolean }) {
  const styles = useStyles();
  return (
    <dl className={styles.receipt}>
      <dt className={styles.term}>
        <Body1>内容</Body1>
      </dt>
      <dd className={styles.value}>
        <Body1>{order.order_name}</Body1>
      </dd>
      {shop?.shop_name ? (
        <>
          <dt className={styles.term}>
            <Body1>收款方</Body1>
          </dt>
          <dd className={styles.value}>
            <Body1>{shop.shop_name}</Body1>
          </dd>
        </>
      ) : null}
      <dt className={styles.term}>
        <Body1>{paid ? "付款时间" : "下单时间"}</Body1>
      </dt>
      <dd className={styles.value}>
        <Body1>{formatDateTime(paid ? order.updated_at : order.created_at)}</Body1>
      </dd>
      <dt className={styles.term}>
        <Body1>订单号</Body1>
      </dt>
      <dd className={styles.value}>
        <span className={styles.mono}>{order.order_no}</span>
        <CopyButton text={order.order_no} />
      </dd>
    </dl>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <Tooltip content={copied ? "已复制" : "复制订单号"} relationship="label">
      <Button
        appearance="transparent"
        size="small"
        icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      />
    </Tooltip>
  );
}
