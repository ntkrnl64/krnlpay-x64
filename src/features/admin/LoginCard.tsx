import {
  Button,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { LockClosedRegular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { ApiError, adminLogin } from "@/api";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { Section } from "@/components/ui";

const useStyles = makeStyles({
  wrap: {
    width: "100%",
    maxWidth: "400px",
    margin: "8vh auto 0",
  },
  head: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalXS,
  },
  icon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "48px",
    height: "48px",
    borderRadius: tokens.borderRadiusXLarge,
    fontSize: "24px",
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    marginBottom: tokens.spacingVerticalS,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  turnstile: {
    display: "flex",
    justifyContent: "center",
    minHeight: "65px",
  },
});

export function LoginCard({ sitekey, onSignedIn }: { sitekey: string; onSignedIn: () => void }) {
  const styles = useStyles();
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setBusy(true);
    setError(null);
    setPasswordError(null);
    try {
      await adminLogin(password, token);
      setPassword("");
      onSignedIn();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "登录失败，请稍后重试";
      if (caught instanceof ApiError && caught.code === "ERR_WRONG_PASSWORD") {
        setPasswordError(message);
      } else {
        setError(message);
      }
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Section>
        <div className={styles.head}>
          <div className={styles.icon}>
            <LockClosedRegular aria-hidden />
          </div>
          <Title3 as="h1" style={{ margin: 0 }}>
            登录管理后台
          </Title3>
        </div>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void onLogin();
          }}
        >
          {error ? (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          ) : null}
          <Field
            label="密码"
            required
            hint={passwordError}
            validationState={passwordError ? "error" : "none"}
            validationMessage={passwordError ?? undefined}
          >
            <Input
              type="password"
              size="large"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(_event, data) => {
                setPassword(data.value);
                setPasswordError(null);
              }}
            />
          </Field>
          {sitekey ? (
            <div className={styles.turnstile}>
              <Turnstile ref={turnstileRef} sitekey={sitekey} onToken={setToken} />
            </div>
          ) : (
            <MessageBar intent="warning">
              <MessageBarBody>未配置 Turnstile site key，暂时无法登录。</MessageBarBody>
            </MessageBar>
          )}
          <Button
            appearance="primary"
            size="large"
            type="submit"
            disabled={busy || !sitekey || !token || password.length === 0}
            icon={busy ? <Spinner size="tiny" /> : undefined}
          >
            {busy ? "正在登录…" : token || !sitekey ? "登录" : "等待人机验证…"}
          </Button>
        </form>
      </Section>
    </div>
  );
}
