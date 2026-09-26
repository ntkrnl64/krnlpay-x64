import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS, decodeIcon, parseIcon, parseSettings, publicIcon } from "./shop";

describe("shop icon", () => {
  test("accepts empty, text, emoji, links and small raster images", () => {
    expect(parseIcon(undefined)).toEqual({ value: "" });
    expect(parseIcon("  ")).toEqual({ value: "" });
    expect(parseIcon("茶")).toEqual({ value: "茶" });
    expect(parseIcon("👨‍👩‍👧")).toEqual({ value: "👨‍👩‍👧" });
    expect(parseIcon("https://example.com/logo.png")).toEqual({ value: "https://example.com/logo.png" });
    expect(parseIcon("data:image/webp;base64,UklGRg==")).toEqual({ value: "data:image/webp;base64,UklGRg==" });
  });

  test("rejects svg, scripts, oversized images and long text", () => {
    expect(parseIcon("data:image/svg+xml;base64,PHN2Zz4=")).toHaveProperty("error");
    expect(parseIcon("javascript:alert(1)")).toHaveProperty("error");
    expect(parseIcon(`data:image/png;base64,${"A".repeat(150_000)}`)).toHaveProperty("error");
    expect(parseIcon("三个字")).toHaveProperty("error");
    expect(parseIcon("<b>")).toHaveProperty("error");
    expect(parseIcon(42)).toHaveProperty("error");
  });

  test("uploaded images are published as a versioned url", () => {
    const first = publicIcon("data:image/png;base64,iVBORw0KGgo=");
    const second = publicIcon("data:image/png;base64,iVBORw0KGgp=");
    expect(first).toMatch(/^\/api\/v1\/shop\/icon\?v=[0-9a-z]+$/);
    expect(second).not.toBe(first);
    expect(publicIcon("🍵")).toBe("🍵");
    expect(publicIcon("https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  test("decodes stored images back to bytes", () => {
    const decoded = decodeIcon("data:image/png;base64,iVBORw0KGgo=");
    expect(decoded?.type).toBe("image/png");
    expect(Array.from(decoded?.bytes ?? [])).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decodeIcon("🍵")).toBeNull();
    expect(decodeIcon("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });

  test("is saved with the rest of the settings", () => {
    const parsed = parseSettings({ ...DEFAULT_SETTINGS, icon: "🍵" });
    expect(parsed).toEqual({ value: { ...DEFAULT_SETTINGS, icon: "🍵" } });
    expect(parseSettings({ ...DEFAULT_SETTINGS, icon: "data:text/html;base64,AA==" })).toMatchObject({
      errors: { icon: [{ code: "ERR_ICON_TYPE" }] },
    });
  });
});
