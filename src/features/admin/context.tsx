import { Toast, ToastTitle, useToastController, type SpinButtonOnChangeData } from "@fluentui/react-components";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { ApiError } from "@/api";

export const TOASTER_ID = "admin-toaster";

type Intent = "success" | "error" | "warning" | "info";

type AdminKit = {
  notify: (intent: Intent, title: string) => void;
  fail: (caught: unknown, fallback: string) => void;
};

const AdminContext = createContext<AdminKit | null>(null);

export function AdminProvider({ onAuthLost, children }: { onAuthLost: () => void; children: ReactNode }) {
  const { dispatchToast } = useToastController(TOASTER_ID);

  const notify = useCallback(
    (intent: Intent, title: string) => {
      dispatchToast(
        <Toast>
          <ToastTitle>{title}</ToastTitle>
        </Toast>,
        { intent, timeout: intent === "error" ? 6000 : 3000 },
      );
    },
    [dispatchToast],
  );

  const fail = useCallback(
    (caught: unknown, fallback: string) => {
      if (caught instanceof ApiError && caught.code === "ERR_UNAUTHENTICATED") {
        notify("warning", "登录已过期，请重新登录");
        onAuthLost();
        return;
      }
      notify("error", caught instanceof ApiError ? caught.message : fallback);
    },
    [notify, onAuthLost],
  );

  const value = useMemo(() => ({ notify, fail }), [notify, fail]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminKit {
  const kit = useContext(AdminContext);
  if (!kit) {
    throw new Error("useAdmin must be used inside AdminProvider");
  }
  return kit;
}

export function fieldErrors(caught: unknown): Record<string, string> {
  return caught instanceof ApiError ? caught.fieldMessages() : {};
}

export function spinValue(data: SpinButtonOnChangeData): number | undefined {
  if (typeof data.value === "number") {
    return data.value;
  }
  if (data.displayValue === undefined) {
    return undefined;
  }
  const parsed = Number(data.displayValue.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function charCount(value: string, max: number): string {
  return `${[...value].length}/${max}`;
}
