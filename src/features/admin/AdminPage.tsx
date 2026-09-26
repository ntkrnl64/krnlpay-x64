import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Tab,
  TabList,
  Toaster,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import { ArrowLeftRegular, BoxRegular, BuildingShopRegular, ReceiptRegular, SignOutRegular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, adminLogout, adminSession, getTurnstileSitekey } from "@/api";
import { ThemeToggle } from "@/app/theme";
import { AdminProvider, TOASTER_ID, useAdmin } from "./context";
import { LoginCard } from "./LoginCard";
import { OrdersTab } from "./OrdersTab";
import { ProductsTab } from "./ProductsTab";
import { SettingsTab } from "./SettingsTab";

type TabKey = "shop" | "products" | "orders";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  column: {
    maxWidth: "800px",
    boxSizing: "border-box",
    margin: "0 auto",
    padding: "12px 16px 48px",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    minHeight: "40px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  tabs: {
    marginLeft: `calc(-1 * ${tokens.spacingHorizontalMNudge})`,
  },
  center: {
    paddingTop: "20vh",
  },
});

export function AdminPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [sitekey, setSitekey] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoadError(null);
    void Promise.all([adminSession(), getTurnstileSitekey()])
      .then(([signedIn, turnstile]) => {
        setAuthed(signedIn);
        setSitekey(turnstile.sitekey);
      })
      .catch((caught: unknown) => setLoadError(caught instanceof ApiError ? caught.message : "管理页加载失败，请检查网络"))
      .finally(() => setReady(true));
  }, [attempt]);

  useEffect(() => {
    document.title = "管理后台";
  }, []);

  const onAuthLost = useCallback(() => setAuthed(false), []);

  return (
    <div className={styles.page}>
      <Toaster toasterId={TOASTER_ID} position="top" />
      <AdminProvider onAuthLost={onAuthLost}>
        <main className={styles.column}>
          <header className={styles.header}>
            <Subtitle1 as="h1" style={{ margin: 0 }}>
              管理后台
            </Subtitle1>
            <div className={styles.actions}>
              <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate("/")}>
                返回店铺
              </Button>
              <ThemeToggle />
              {authed ? <SignOutButton onSignedOut={onAuthLost} /> : null}
            </div>
          </header>

          {!ready ? <Spinner className={styles.center} label="正在打开管理后台" /> : null}
          {ready && loadError ? (
            <MessageBar intent="error">
              <MessageBarBody>{loadError}</MessageBarBody>
              <MessageBarActions>
                <Button onClick={() => setAttempt((n) => n + 1)}>重试</Button>
              </MessageBarActions>
            </MessageBar>
          ) : null}
          {ready && !loadError && !authed ? <LoginCard sitekey={sitekey} onSignedIn={() => setAuthed(true)} /> : null}
          {ready && !loadError && authed ? <Panel /> : null}
        </main>
      </AdminProvider>
    </div>
  );
}

function SignOutButton({ onSignedOut }: { onSignedOut: () => void }) {
  const { notify, fail } = useAdmin();
  return (
    <Tooltip content="退出登录" relationship="label">
      <Button
        appearance="subtle"
        icon={<SignOutRegular />}
        onClick={() => {
          void adminLogout()
            .then(() => {
              notify("info", "已退出登录");
              onSignedOut();
            })
            .catch((caught: unknown) => fail(caught, "退出失败"));
        }}
      />
    </Tooltip>
  );
}

function Panel() {
  const styles = useStyles();
  const [tab, setTab] = useState<TabKey>("shop");

  return (
    <>
      <TabList
        className={styles.tabs}
        selectedValue={tab}
        onTabSelect={(_event: SelectTabEvent, data: SelectTabData) => setTab(data.value as TabKey)}
      >
        <Tab value="shop" icon={<BuildingShopRegular />}>
          店铺
        </Tab>
        <Tab value="products" icon={<BoxRegular />}>
          商品
        </Tab>
        <Tab value="orders" icon={<ReceiptRegular />}>
          订单
        </Tab>
      </TabList>
      <div hidden={tab !== "shop"}>
        <SettingsTab />
      </div>
      <div hidden={tab !== "products"}>
        <ProductsTab />
      </div>
      <div hidden={tab !== "orders"}>
        <OrdersTab active={tab === "orders"} />
      </div>
    </>
  );
}
