import {
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  ProgressBar,
  Spinner,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwiseRegular, ClockDismissRegular, DismissRegular, OpenRegular, ScanRegular } from "@fluentui/react-icons";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { ApiError, createOrder, getOrderStatus, type Product } from "@/api";
import { Amount } from "@/components/ui";
import { describeError } from "@/i18n";
import { formatCountdown } from "@/lib/format";
import { PAY_WINDOW_MS, clearPending, isLive, onVisible, savePending, type PendingOrder } from "./pending";

const PAY_WINDOW_SECONDS = PAY_WINDOW_MS / 1000;
const POLL_MS = 2000;
const MAX_POLL_FAILURES = 3;

export type PaymentRequest = {
  id: number;
  product: Product | null;
  amount: number;
  label: string;
  resume?: PendingOrder;
};

type PayState =
  | { id: number; phase: "creating" }
  | { id: number; phase: "awaiting"; qrUrl: string; orderNo: string }
  | { id: number; phase: "expired" }
  | { id: number; phase: "failed"; message: string; requestId?: string };

const useStyles = makeStyles({
  surface: {
    maxWidth: "400px",
    width: "calc(100vw - 32px)",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalL,
    textAlign: "center",
    paddingTop: tokens.spacingVerticalS,
  },
  summary: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalXXS,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  qrFrame: {
    display: "flex",
    backgroundColor: "#ffffff",
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow8,
    ...shorthands.padding("16px"),
  },
  hint: {
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2,
  },
  timer: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  timerText: {
    display: "flex",
    justifyContent: "space-between",
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
  },
  placeholder: {
    height: "240px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIcon: {
    fontSize: "64px",
  },
  warning: {
    color: tokens.colorStatusWarningForeground1,
  },
  wide: {
    width: "100%",
    textAlign: "start",
  },
  requestId: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    userSelect: "all",
    wordBreak: "break-all",
  },
});

function coarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

function failure(id: number, caught: unknown): PayState {
  if (caught instanceof ApiError) {
    return { id, phase: "failed", message: caught.message, requestId: caught.requestId };
  }
  console.error("[payment] unexpected error", caught);
  return { id, phase: "failed", message: describeError("ERR_UNKNOWN", { code: "client" }) };
}

export function PaymentDialog({
  request,
  onRetry,
  onClose,
  onPaid,
}: {
  request: PaymentRequest | null;
  onRetry: () => void;
  onClose: () => void;
  onPaid: (orderNo: string) => void;
}) {
  const styles = useStyles();
  const [state, setState] = useState<PayState>({ id: -1, phase: "creating" });
  const [leftSeconds, setLeftSeconds] = useState(PAY_WINDOW_SECONDS);
  const lastRequest = useRef<PaymentRequest | null>(null);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  if (request) {
    lastRequest.current = request;
  }
  const shown = request ?? lastRequest.current;
  const current: PayState = shown && state.id === shown.id ? state : { id: shown?.id ?? -1, phase: "creating" };

  useEffect(() => {
    if (!request) {
      return;
    }
    const id = request.id;
    let cancelled = false;
    let poll: number | undefined;
    let clock: number | undefined;
    let detach = () => {};

    const stop = () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      detach();
    };

    const watch = (order: PendingOrder) => {
      setState({ id, phase: "awaiting", qrUrl: order.qrUrl, orderNo: order.orderNo });
      let failures = 0;
      let checking = false;

      const check = () => {
        if (checking) {
          return;
        }
        checking = true;
        void getOrderStatus(order.orderNo)
          .then((next) => {
            if (cancelled) {
              return;
            }
            failures = 0;
            if (next.is_paid) {
              stop();
              clearPending(order.orderNo);
              onPaidRef.current(order.orderNo);
            }
          })
          .catch((caught: unknown) => {
            if (cancelled) {
              return;
            }
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) {
              stop();
              setState(failure(id, caught));
            }
          })
          .finally(() => {
            checking = false;
          });
      };

      const tick = () => {
        const left = Math.max(0, Math.ceil((order.expiresAt - Date.now()) / 1000));
        setLeftSeconds(left);
        if (left <= 0) {
          stop();
          setState((prev) => (prev.id === id && prev.phase === "awaiting" ? { id, phase: "expired" } : prev));
          check();
        }
      };

      tick();
      clock = window.setInterval(tick, 1000);
      poll = window.setInterval(check, POLL_MS);
      detach = onVisible(check);
    };

    if (request.resume && isLive(request.resume)) {
      watch(request.resume);
    } else {
      createOrder(request.product ? { product_id: request.product.id, source: "alipay" } : { amount: request.amount, source: "alipay" })
        .then((order) => {
          const pending: PendingOrder = {
            orderNo: order.order_no,
            qrUrl: order.qrcode,
            amount: request.amount,
            label: request.label,
            productId: request.product?.id ?? null,
            expiresAt: Date.now() + PAY_WINDOW_MS,
          };
          savePending(pending);
          if (cancelled) {
            return;
          }
          watch(pending);
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setState(failure(id, caught));
          }
        });
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [request]);

  const title = {
    creating: "正在创建订单",
    awaiting: "支付宝扫码付款",
    expired: "付款码已过期",
    failed: "没能完成下单",
  }[current.phase];
  const waiting = current.phase === "awaiting" || current.phase === "creating";

  return (
    <Dialog open={request !== null} modalType="alert" onOpenChange={(_event, data) => !data.open && onClose()}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={<Button appearance="subtle" aria-label="关闭" icon={<DismissRegular />} onClick={onClose} />}
          >
            {title}
          </DialogTitle>
          <DialogContent className={styles.content}>
            {current.phase === "expired" ? (
              <ClockDismissRegular className={mergeClasses(styles.statusIcon, styles.warning)} aria-hidden />
            ) : null}

            {shown ? (
              <div className={styles.summary}>
                <Caption1 className={styles.muted}>{shown.label}</Caption1>
                <Amount value={shown.amount} size="large" />
              </div>
            ) : null}

            {current.phase === "creating" ? (
              <div className={styles.placeholder}>
                <Spinner size="large" label="正在向支付宝下单…" labelPosition="below" />
              </div>
            ) : null}

            {current.phase === "awaiting" ? (
              <>
                <div className={styles.qrFrame}>
                  <QRCodeSVG value={current.qrUrl} size={200} level="M" marginSize={0} aria-label="支付宝付款码" />
                </div>
                <Body1 className={styles.hint}>
                  <ScanRegular aria-hidden />
                  打开支付宝，扫一扫付款
                </Body1>
                <div className={styles.timer}>
                  <ProgressBar
                    value={leftSeconds / PAY_WINDOW_SECONDS}
                    color={leftSeconds <= 60 ? "warning" : "brand"}
                    aria-label="剩余付款时间"
                  />
                  <Caption1 className={styles.timerText}>
                    <span>付款后会自动跳转</span>
                    <span>剩余 {formatCountdown(leftSeconds)}</span>
                  </Caption1>
                </div>
                {coarsePointer() ? (
                  <Button
                    as="a"
                    href={current.qrUrl}
                    appearance="primary"
                    size="large"
                    icon={<OpenRegular />}
                    className={styles.wide}
                  >
                    在支付宝中打开
                  </Button>
                ) : null}
              </>
            ) : null}

            {current.phase === "expired" ? (
              <Body1 className={styles.muted}>每个付款码只在 10 分钟内有效。如果你已经付款，请不要重复支付，稍后刷新页面查看结果。</Body1>
            ) : null}

            {current.phase === "failed" ? (
              <>
                <MessageBar intent="error" className={styles.wide}>
                  <MessageBarBody>{current.message}</MessageBarBody>
                </MessageBar>
                {current.requestId ? (
                  <Caption1 className={styles.requestId}>错误编号 {current.requestId}</Caption1>
                ) : null}
              </>
            ) : null}
          </DialogContent>
          <DialogActions fluid={!waiting}>
            {waiting ? (
              <Button appearance="secondary" onClick={onClose}>
                稍后再付
              </Button>
            ) : (
              <>
                <Button appearance="secondary" onClick={onClose}>
                  关闭
                </Button>
                <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={onRetry}>
                  {current.phase === "expired" ? "重新生成" : "重试"}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
