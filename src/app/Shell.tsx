import { Button, Caption1, Link, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { SettingsRegular, ShieldCheckmarkRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./theme";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  column: {
    flexGrow: 1,
    width: "100%",
    maxWidth: "640px",
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "12px 16px 32px",
  },
  bar: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "4px",
    marginBottom: "8px",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "0 16px 28px",
    color: tokens.colorNeutralForeground3,
  },
});

export function Shell({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <main className={styles.column}>
        <div className={styles.bar}>
          <ThemeToggle />
          <Tooltip content="管理后台" relationship="label">
            <Button appearance="subtle" icon={<SettingsRegular />} onClick={() => navigate("/admin")} />
          </Tooltip>
        </div>
        {children}
      </main>
      <footer className={styles.footer}>
        <ShieldCheckmarkRegular aria-hidden />
        <Caption1>付款由支付宝完成</Caption1>
        <Caption1 aria-hidden>·</Caption1>
        <Caption1>
          <Link href="https://github.com/ntkrnl64/krnlpay-x64" target="_blank" rel="noopener noreferrer">
            GitHub
          </Link>
        </Caption1>
      </footer>
    </div>
  );
}
