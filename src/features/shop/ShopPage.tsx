import {
  Body1,
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Skeleton,
  SkeletonItem,
  Subtitle1,
  Title2,
  createFocusOutlineStyle,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  useArrowNavigationGroup,
} from "@fluentui/react-components";
import { CheckmarkCircleFilled, CircleRegular, QrCodeRegular } from "@fluentui/react-icons";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, getOrderStatus, getShop, type Product, type Shop } from "@/api";
import { Amount, EmptyState, Section } from "@/components/ui";
import { PaymentDialog, type PaymentRequest } from "@/features/pay/PaymentDialog";
import { clearPending, httpUrl, isLive, loadPending, onVisible, resultPath, type PendingOrder } from "@/features/pay/pending";
import { formatCountdown, formatYuan, parseMoney } from "@/lib/format";
import { ShopIcon, applyFavicon } from "./ShopIcon";

type Choice = { kind: "product"; product: Product } | { kind: "preset"; amount: number } | { kind: "custom" };

const useStyles = makeStyles({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  hero: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
  },
  heroText: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  title: {
    margin: 0,
    overflowWrap: "anywhere",
  },
  muted: {
    color: tokens.colorNeutralForeground2,
  },
  about: {
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    paddingTop: tokens.spacingVerticalL,
  },
  products: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  presets: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalS,
    "@media (min-width: 480px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  },
  tile: {
    appearance: "none",
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    width: "100%",
    minHeight: "48px",
    boxSizing: "border-box",
    margin: 0,
    textAlign: "left",
    fontFamily: "inherit",
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderColor(tokens.colorNeutralStroke1Hover),
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
    ...createFocusOutlineStyle(),
  },
  tileSelected: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    boxShadow: `inset 0 0 0 1px ${tokens.colorBrandStroke1}`,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
    ":active": {
      backgroundColor: tokens.colorBrandBackground2Pressed,
    },
  },
  presetTile: {
    justifyContent: "center",
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
    minHeight: "52px",
  },
  radioIcon: {
    flexShrink: 0,
    fontSize: "20px",
    color: tokens.colorNeutralForeground3,
  },
  radioIconOn: {
    color: tokens.colorBrandForeground1,
  },
  productText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flexGrow: 1,
    minWidth: 0,
  },
  productName: {
    fontWeight: tokens.fontWeightSemibold,
    overflowWrap: "anywhere",
  },
  productDesc: {
    color: tokens.colorNeutralForeground3,
    overflowWrap: "anywhere",
  },
  productPrice: {
    flexShrink: 0,
    fontWeight: tokens.fontWeightSemibold,
    fontVariantNumeric: "tabular-nums",
  },
  checkout: {
    position: "sticky",
    bottom: tokens.spacingVerticalL,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL, tokens.spacingVerticalM, tokens.spacingHorizontalXL),
  },
  checkoutInfo: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  checkoutLabel: {
    color: tokens.colorNeutralForeground3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  payButton: {
    flexShrink: 0,
    minWidth: "132px",
  },
  skeleton: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  skeletonRow: {
    display: "grid",
    gridTemplateColumns: "56px 1fr",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
  },
  skeletonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalS,
  },
});

function withResume(request: PaymentRequest): PaymentRequest {
  const saved = loadPending();
  const matches =
    saved !== null &&
    isLive(saved) &&
    saved.amount === request.amount &&
    saved.productId === (request.product?.id ?? null);
  return { ...request, id: Date.now(), resume: matches ? saved : undefined };
}

function initialChoice(shop: Shop, params: URLSearchParams): { choice: Choice | null; customText: string } {
  const productId = Number(params.get("product"));
  const chosen = shop.products.find((item) => item.id === productId);
  if (chosen) {
    return { choice: { kind: "product", product: chosen }, customText: "" };
  }
  const amountParam = params.get("amount");
  const queryAmount = amountParam === null ? Number.NaN : Number(amountParam);
  if (shop.custom_enabled && Number.isFinite(queryAmount)) {
    if (shop.presets.includes(queryAmount)) {
      return { choice: { kind: "preset", amount: queryAmount }, customText: "" };
    }
    return { choice: { kind: "custom" }, customText: String(queryAmount) };
  }
  if (shop.custom_enabled && shop.presets[0] !== undefined) {
    return { choice: { kind: "preset", amount: shop.presets[0] }, customText: "" };
  }
  if (shop.products.length === 1) {
    return { choice: { kind: "product", product: shop.products[0] }, customText: "" };
  }
  return { choice: null, customText: "" };
}

export function ShopPage() {
  const styles = useStyles();
  const [params] = useSearchParams();
  const [shop, setShop] = useState<Shop | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [customText, setCustomText] = useState("");
  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const navigate = useNavigate();
  const queryRedirect = httpUrl(params.get("redirect"));
  const startedRef = useRef(false);
  const productsLabel = useId();
  const presetsLabel = useId();
  const productNav = useArrowNavigationGroup({ axis: "vertical", circular: true });
  const presetNav = useArrowNavigationGroup({ axis: "grid-linear" });

  useEffect(() => {
    let cancelled = false;
    setPageError(null);
    void getShop()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setShop(next);
        document.title = next.shop_name || document.title;
        applyFavicon(next.icon, next.shop_name);
        const initial = initialChoice(next, params);
        setChoice(initial.choice);
        setCustomText(initial.customText);
        if (startedRef.current || !httpUrl(params.get("redirect")) || !initial.choice) {
          return;
        }
        const request = toRequest(next, initial.choice, initial.customText);
        if (request) {
          startedRef.current = true;
          setPayment(withResume(request));
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setPageError(caught instanceof ApiError ? caught.message : "店铺加载失败，请检查网络后重试");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params, reloadKey]);

  useEffect(() => {
    const saved = loadPending();
    if (!saved) {
      return;
    }
    let cancelled = false;
    getOrderStatus(saved.orderNo)
      .then((order) => {
        if (cancelled) {
          return;
        }
        if (order.is_paid) {
          clearPending(saved.orderNo);
          navigate(resultPath(saved.orderNo, httpUrl(params.get("redirect"))), { replace: true });
        } else if (isLive(saved)) {
          setPending(saved);
        } else {
          clearPending(saved.orderNo);
        }
      })
      .catch(() => {
        if (!cancelled && isLive(saved)) {
          setPending(saved);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, params]);

  if (pageError) {
    return (
      <MessageBar intent="error" layout="multiline">
        <MessageBarBody>
          <MessageBarTitle>打不开店铺</MessageBarTitle>
          {pageError}
        </MessageBarBody>
        <MessageBarActions>
          <Button onClick={() => setReloadKey((key) => key + 1)}>重试</Button>
        </MessageBarActions>
      </MessageBar>
    );
  }
  if (!shop) {
    return <ShopSkeleton />;
  }

  const customAmount = parseMoney(customText);
  const customError = customValidation(shop, customText, customAmount);
  const request = choice ? toRequest(shop, choice, customText) : null;
  const hasCatalog = shop.products.length > 0 || shop.custom_enabled;

  const pick = (next: Choice) => setChoice(next);
  const pay = (next: PaymentRequest) => {
    setPending(null);
    setPayment(withResume(next));
  };
  const finish = (orderNo: string) => navigate(resultPath(orderNo, queryRedirect));

  return (
    <form
      className={styles.stack}
      onSubmit={(event) => {
        event.preventDefault();
        if (request) {
          pay(request);
        }
      }}
    >
      <Section>
        <div className={styles.hero}>
          <ShopIcon icon={shop.icon} name={shop.shop_name} />
          <div className={styles.heroText}>
            <Title2 as="h1" className={styles.title}>
              {shop.shop_name}
            </Title2>
            {shop.tagline ? <Body1 className={styles.muted}>{shop.tagline}</Body1> : null}
          </div>
        </div>
        {shop.about ? <Body1 className={styles.about}>{shop.about}</Body1> : null}
      </Section>

      {pending && !payment ? (
        <PendingBanner
          order={pending}
          onResume={() =>
            pay({
              id: 0,
              product: shop.products.find((item) => item.id === pending.productId) ?? null,
              amount: pending.amount,
              label: pending.label,
            })
          }
          onDiscard={() => {
            clearPending(pending.orderNo);
            setPending(null);
          }}
          onExpired={() => setPending(null)}
          onPaid={finish}
        />
      ) : null}

      {!hasCatalog ? (
        <Section>
          <EmptyState icon={<QrCodeRegular />} title="暂未开放收款" description="所有者还没有上架商品，稍后再来看看吧。" />
        </Section>
      ) : null}

      {shop.products.length > 0 ? (
        <Section title="选择商品" id={productsLabel}>
          <div className={styles.products} role="radiogroup" aria-labelledby={productsLabel} {...productNav}>
            {shop.products.map((item) => {
              const selected = choice?.kind === "product" && choice.product.id === item.id;
              const Icon = selected ? CheckmarkCircleFilled : CircleRegular;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={mergeClasses(styles.tile, selected && styles.tileSelected)}
                  onClick={() => pick({ kind: "product", product: item })}
                >
                  <Icon className={mergeClasses(styles.radioIcon, selected && styles.radioIconOn)} aria-hidden />
                  <span className={styles.productText}>
                    <span className={styles.productName}>{item.name}</span>
                    {item.description ? <Caption1 className={styles.productDesc}>{item.description}</Caption1> : null}
                  </span>
                  <span className={styles.productPrice}>{formatYuan(item.price)}</span>
                </button>
              );
            })}
          </div>
        </Section>
      ) : null}

      {shop.custom_enabled ? (
        <Section
          title={shop.products.length > 0 ? "或者，输入你的金额" : "选择金额"}
          description={`金额范围 ${formatYuan(shop.custom_min)} – ${formatYuan(shop.custom_max)}`}
          id={presetsLabel}
        >
          {shop.presets.length > 0 ? (
            <div className={styles.presets} role="radiogroup" aria-labelledby={presetsLabel} {...presetNav}>
              {shop.presets.map((value) => {
                const selected = choice?.kind === "preset" && choice.amount === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={mergeClasses(styles.tile, styles.presetTile, selected && styles.tileSelected)}
                    onClick={() => pick({ kind: "preset", amount: value })}
                  >
                    {formatYuan(value)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <Field
            label="其他金额"
            validationState={choice?.kind === "custom" && customError ? "error" : "none"}
            validationMessage={choice?.kind === "custom" ? customError : undefined}
          >
            <Input
              size="large"
              inputMode="decimal"
              autoComplete="off"
              contentBefore={<span className={styles.muted}>￥</span>}
              placeholder={`${shop.custom_min} – ${shop.custom_max}`}
              value={customText}
              onFocus={() => customText && pick({ kind: "custom" })}
              onChange={(_event, data) => {
                setCustomText(data.value.replace(/[^\d.]/g, ""));
                pick({ kind: "custom" });
              }}
            />
          </Field>
        </Section>
      ) : null}

      {hasCatalog ? (
        <div className={styles.checkout}>
          <div className={styles.checkoutInfo}>
            <Caption1 className={styles.checkoutLabel}>{request ? request.label : "请选择商品或金额"}</Caption1>
            {request ? <Amount value={request.amount} size="medium" /> : <Subtitle1 className={styles.muted}>—</Subtitle1>}
          </div>
          <Button
            type="submit"
            appearance="primary"
            size="large"
            icon={<QrCodeRegular />}
            disabled={!request}
            className={styles.payButton}
          >
            去付款
          </Button>
        </div>
      ) : null}

      <PaymentDialog
        request={payment}
        onRetry={() => payment && pay(payment)}
        onClose={() => {
          setPayment(null);
          const saved = loadPending();
          setPending(saved && isLive(saved) ? saved : null);
        }}
        onPaid={finish}
      />
    </form>
  );
}

function customValidation(shop: Shop, text: string, amount: number | null): string | undefined {
  if (text.trim() === "") {
    return undefined;
  }
  if (amount === null) {
    return "请输入正确的金额，最多两位小数";
  }
  if (amount < shop.custom_min || amount > shop.custom_max) {
    return `金额需在 ${formatYuan(shop.custom_min)} 到 ${formatYuan(shop.custom_max)} 之间`;
  }
  return undefined;
}

function toRequest(shop: Shop, choice: Choice, customText: string): PaymentRequest | null {
  const id = Date.now();
  if (choice.kind === "product") {
    return { id, product: choice.product, amount: choice.product.price, label: choice.product.name };
  }
  if (!shop.custom_enabled) {
    return null;
  }
  if (choice.kind === "preset") {
    return { id, product: null, amount: choice.amount, label: "输入你的金额" };
  }
  const amount = parseMoney(customText);
  if (amount === null || customValidation(shop, customText, amount)) {
    return null;
  }
  return { id, product: null, amount, label: "自定义金额" };
}

function ShopSkeleton() {
  const styles = useStyles();
  return (
    <Skeleton aria-label="正在打开店铺" className={styles.skeleton}>
      <Section>
        <div className={styles.skeletonRow}>
          <SkeletonItem shape="square" size={56} />
          <div className={styles.heroText}>
            <SkeletonItem size={28} style={{ width: "50%" }} />
            <SkeletonItem size={16} style={{ width: "80%" }} />
          </div>
        </div>
      </Section>
      <Section>
        <SkeletonItem size={20} style={{ width: "30%" }} />
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonItem key={index} size={48} />
          ))}
        </div>
      </Section>
    </Skeleton>
  );
}

function secondsLeft(order: PendingOrder): number {
  return Math.max(0, Math.ceil((order.expiresAt - Date.now()) / 1000));
}

function PendingBanner({
  order,
  onResume,
  onDiscard,
  onExpired,
  onPaid,
}: {
  order: PendingOrder;
  onResume: () => void;
  onDiscard: () => void;
  onExpired: () => void;
  onPaid: (orderNo: string) => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(order));
  const handlers = useRef({ onExpired, onPaid });
  handlers.current = { onExpired, onPaid };

  useEffect(() => {
    let checking = false;
    const check = () => {
      if (checking) {
        return;
      }
      checking = true;
      void getOrderStatus(order.orderNo)
        .then((next) => {
          if (next.is_paid) {
            clearPending(order.orderNo);
            handlers.current.onPaid(order.orderNo);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          checking = false;
        });
    };
    const tick = () => {
      const next = secondsLeft(order);
      setLeft(next);
      if (next <= 0) {
        handlers.current.onExpired();
      }
    };
    const clock = window.setInterval(tick, 1000);
    const poll = window.setInterval(check, 5000);
    const detach = onVisible(check);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(poll);
      detach();
    };
  }, [order]);

  return (
    <MessageBar intent="warning" layout="multiline">
      <MessageBarBody>
        <MessageBarTitle>还有一笔没付完的订单</MessageBarTitle>
        {order.label} {formatYuan(order.amount)}，付款码还剩 {formatCountdown(left)}。已经付过的话，稍等片刻会自动跳转。
      </MessageBarBody>
      <MessageBarActions>
        <Button appearance="primary" onClick={onResume}>
          继续付款
        </Button>
        <Button onClick={onDiscard}>不付了</Button>
      </MessageBarActions>
    </MessageBar>
  );
}
