import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./password";
import { issueSession, sessionIsValid } from "./session";

describe("password hash", () => {
  test("verifies only the original password", async () => {
    const stored = hashPassword("correct-horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse", stored)).toBe(true);
    expect(await verifyPassword("wrong-horse!!", stored)).toBe(false);
    expect(await verifyPassword("correct-horse", "not-a-hash")).toBe(false);
  });
});

describe("session cookie", () => {
  test("expires when the hash changes", async () => {
    const hash = hashPassword("correct-horse");
    const token = await issueSession(hash, 1_000);
    expect(await sessionIsValid(token, hash, 1_000)).toBe(true);
    expect(await sessionIsValid(token, hashPassword("other-secret"), 1_000)).toBe(false);
    expect(await sessionIsValid(token, hash, 1_000 + 13 * 60 * 60 * 1000)).toBe(false);
  });
});
