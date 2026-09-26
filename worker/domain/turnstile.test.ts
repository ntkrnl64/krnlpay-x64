import { describe, expect, test } from "bun:test";
import { turnstileAccepted } from "./turnstile";

describe("turnstile decision", () => {
  test("requires the login action and an allowed hostname", () => {
    const hostnames = new Set(["localhost"]);
    expect(turnstileAccepted({ success: true, action: "login", hostname: "localhost" }, hostnames)).toBe(true);
    expect(turnstileAccepted({ success: true, action: "signup", hostname: "localhost" }, hostnames)).toBe(false);
    expect(turnstileAccepted({ success: true, action: "login", hostname: "evil.test" }, hostnames)).toBe(false);
    expect(turnstileAccepted({ success: false, action: "login", hostname: "localhost" }, hostnames)).toBe(false);
    expect(
      turnstileAccepted(
        { success: true, hostname: "example.com" },
        hostnames,
        "1x0000000000000000000000000000000AA",
      ),
    ).toBe(true);
    expect(turnstileAccepted({ success: true, hostname: "example.com" }, hostnames, "real-secret")).toBe(false);
  });
});
