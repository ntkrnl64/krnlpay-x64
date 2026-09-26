import {
  Body1,
  Caption1,
  Subtitle2,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";

const useStyles = makeStyles({
  amount: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "2px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    whiteSpace: "nowrap",
  },
  currency: {
    fontSize: "0.55em",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  medium: {
    fontSize: tokens.fontSizeBase600,
    lineHeight: tokens.lineHeightBase600,
  },
  large: {
    fontSize: tokens.fontSizeHero800,
    lineHeight: tokens.lineHeightHero800,
    letterSpacing: "-0.02em",
  },
  hero: {
    fontSize: tokens.fontSizeHero900,
    lineHeight: tokens.lineHeightHero900,
    letterSpacing: "-0.03em",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow4,
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
  },
  sectionHead: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
  },
  sectionText: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    minWidth: 0,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalXXXL, tokens.spacingHorizontalL),
  },
  emptyIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    borderRadius: tokens.borderRadiusCircular,
    fontSize: "28px",
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    marginBottom: tokens.spacingVerticalS,
  },
  emptyAction: {
    marginTop: tokens.spacingVerticalM,
  },
});

export function Amount({ value, size = "medium", className }: { value: number; size?: "medium" | "large" | "hero"; className?: string }) {
  const styles = useStyles();
  return (
    <span className={mergeClasses(styles.amount, styles[size], className)} aria-label={`${formatNumber(value)} 元`}>
      <span className={styles.currency} aria-hidden>
        ￥
      </span>
      <span aria-hidden>{formatNumber(value)}</span>
    </span>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const styles = useStyles();
  return (
    <section className={styles.section} aria-labelledby={title && id ? id : undefined}>
      {title || action ? (
        <div className={styles.sectionHead}>
          <div className={styles.sectionText}>
            {title ? (
              <Subtitle2 as="h2" id={id} style={{ margin: 0 }}>
                {title}
              </Subtitle2>
            ) : null}
            {description ? <Caption1 className={styles.muted}>{description}</Caption1> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>{icon}</div>
      <Subtitle2>{title}</Subtitle2>
      {description ? <Body1 className={styles.muted}>{description}</Body1> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}
