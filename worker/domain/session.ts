import { timingSafeEqual } from "node:crypto";

const COOKIE = "krnlpay_session";
const SESSION_SECONDS = 12 * 60 * 60;

export function sessionCookie(token: string, secure: boolean): string {
  return cookie(`${COOKIE}=${token}`, secure, SESSION_SECONDS);
}

export function clearSessionCookie(secure: boolean): string {
  return cookie(`${COOKIE}=`, secure, 0);
}

export async function issueSession(passwordHash: string, now = Date.now()): Promise<string> {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ exp: now + SESSION_SECONDS * 1000 })));
  const signature = await sign(passwordHash, payload);
  return `${payload}.${signature}`;
}

export async function sessionIsValid(token: string | null, passwordHash: string, now = Date.now()): Promise<boolean> {
  if (!token || !passwordHash) {
    return false;
  }
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return false;
  }
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(passwordHash, payload);
  const left = decodeBase64url(signature);
  const right = decodeBase64url(expected);
  if (!left || !right || left.length !== right.length || !timingSafeEqual(left, right)) {
    return false;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64url(payload) ?? new Uint8Array())) as { exp?: unknown };
    return typeof parsed.exp === "number" && parsed.exp > now;
  } catch {
    return false;
  }
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) {
      return rest.join("=") || null;
    }
  }
  return null;
}

export function requestIsSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(signature));
}

function cookie(assignment: string, secure: boolean, maxAge: number): string {
  const parts = [assignment, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64url(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}
