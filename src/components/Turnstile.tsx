import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type TurnstileHandle = {
  reset: () => void;
};

type TurnstileProps = {
  sitekey: string;
  onToken: (token: string) => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile({ sitekey, onToken }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current("");
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    },
  }));

  useEffect(() => {
    let cancelled = false;

    function render() {
      if (cancelled || !host.current || !window.turnstile || widgetId.current) {
        return;
      }
      widgetId.current = window.turnstile.render(host.current, {
        sitekey,
        action: "login",
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      let script = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [sitekey]);

  return <div ref={host} />;
});
