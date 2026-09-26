import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { useEffect, useState } from "react";

const BRAND = "#0f6cbd";
export const DEFAULT_ICON = "https://assets.krnl64.win/avatar.png";

const useStyles = makeStyles({
  tile: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: tokens.borderRadiusXLarge,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: 1,
    userSelect: "none",
  },
  image: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  emoji: {
    backgroundColor: tokens.colorNeutralBackground3,
    boxShadow: `inset 0 0 0 1px ${tokens.colorNeutralStroke2}`,
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
});

export function isImageIcon(icon: string): boolean {
  return /^(data:image\/|https?:\/\/|\/api\/)/i.test(icon.trim());
}

function isEmoji(text: string): boolean {
  return /\p{Extended_Pictographic}/u.test(text);
}

export function iconText(icon: string, name: string): string {
  const trimmed = icon.trim();
  if (trimmed && !isImageIcon(trimmed)) {
    return trimmed;
  }
  return [...name.trim()][0] ?? "?";
}

function resolveIcon(icon: string): string {
  return icon.trim() || DEFAULT_ICON;
}

export function ShopIcon({ icon, name, size = 56, className }: { icon: string; name: string; size?: number; className?: string }) {
  const styles = useStyles();
  const source = resolveIcon(icon);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [source]);
  const image = isImageIcon(source) && !broken;
  const text = iconText(image ? "" : icon, name);
  const emoji = !image && isEmoji(text);
  const fontSize = Math.round(size * (emoji ? 0.56 : [...text].length > 1 ? 0.36 : 0.46));

  return (
    <div
      className={mergeClasses(styles.tile, image && styles.image, emoji && styles.emoji, className)}
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {image ? <img className={styles.img} src={source} alt="" onError={() => setBroken(true)} /> : text}
    </div>
  );
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function faviconHref(icon: string, name: string): string {
  const source = resolveIcon(icon);
  if (isImageIcon(source)) {
    return source;
  }
  const raw = iconText(icon, name);
  const text = escapeXml(raw);
  const emoji = isEmoji(raw);
  const fontSize = emoji ? 24 : [...raw].length > 1 ? 13 : 18;
  const background = emoji ? "" : `<rect width="32" height="32" rx="7" fill="${BRAND}"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    background +
    `<text x="16" y="16" dy=".36em" text-anchor="middle" font-size="${fontSize}" font-weight="600" ` +
    `font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" fill="#fff">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function applyFavicon(icon: string, name: string): void {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const href = faviconHref(icon, name);
  if (href.startsWith("data:image/svg")) {
    link.type = "image/svg+xml";
  } else {
    link.removeAttribute("type");
  }
  link.href = href;
}
