import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { CodedError } from "../http/errors";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export function hashPassword(password: string): string {
  assertPassword(password);
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length === 0 || password.length > 128) {
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n < 2 || r < 1 || p < 1) {
    return false;
  }
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64url");
    expected = Buffer.from(parts[5] ?? "", "base64url");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length !== KEYLEN) {
    return false;
  }
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
      if (error || !derived) {
        reject(error ?? new Error("scrypt failed"));
        return;
      }
      resolve(derived);
    });
  });
  return timingSafeEqual(key, expected);
}

function assertPassword(password: string): void {
  if (password.length < 10 || password.length > 128) {
    throw new CodedError("ERR_PASSWORD_LENGTH", { params: { min: 10, max: 128 } });
  }
}
