import { errorFields, log } from "../http/context";

export const LOGIN_ACTION = "login";

export type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function hostnameAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}

export function turnstileTokenShape(token: unknown): token is string {
  return typeof token === "string" && token.length > 0 && token.length <= 2048;
}

const DUMMY_PASS_SECRET = "1x0000000000000000000000000000000AA";

export function turnstileAccepted(result: SiteverifyResult, hostnames: Set<string>, secret = ""): boolean {
  if (result.success !== true || typeof result.hostname !== "string") {
    return false;
  }
  // Cloudflare's published always-pass test secret returns hostname example.com and omits action.
  if (secret === DUMMY_PASS_SECRET && result.hostname === "example.com" && !result.action) {
    return true;
  }
  return result.action === LOGIN_ACTION && hostnames.has(result.hostname);
}

export async function verifyTurnstile(input: {
  secret: string | undefined;
  token: unknown;
  remoteIp: string;
  hostnames: Set<string>;
}): Promise<"ok" | "forbidden" | "misconfigured"> {
  if (!input.secret) {
    return "misconfigured";
  }
  if (!turnstileTokenShape(input.token) || input.hostnames.size === 0) {
    log.warn("turnstile token rejected before siteverify", {
      has_token: typeof input.token === "string" && input.token.length > 0,
      allowed_hostnames: input.hostnames.size,
    });
    return "forbidden";
  }
  let result: SiteverifyResult;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: input.secret,
        response: input.token,
        remoteip: input.remoteIp,
      }),
    });
    if (!response.ok) {
      log.error("turnstile siteverify http error", { status: response.status });
      return "forbidden";
    }
    result = (await response.json()) as SiteverifyResult;
  } catch (error) {
    log.error("turnstile siteverify failed", errorFields(error));
    return "forbidden";
  }
  if (!turnstileAccepted(result, input.hostnames, input.secret)) {
    log.warn("turnstile rejected", {
      success: result.success ?? false,
      action: result.action ?? "",
      hostname: result.hostname ?? "",
      allowed_hostnames: [...input.hostnames],
      error_codes: result["error-codes"] ?? [],
    });
    return "forbidden";
  }
  return "ok";
}
