import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import sharp from "sharp";

// App icons and share images, drawn at build time. Text goes through satori, which turns it into
// SVG paths with the bundled Jost font, so the PNGs look the same on every machine.

const ACCENT = "#0f7a4a"; // --color-accent (light)
const INK_STRONG = "#1d211f";
const INK_MUTED = "#5d6360";
const SURFACE = "#eff6f2";

/** The ball-on-green mark from the header, as SVG. */
function markSvg(size: number, rounded = true): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${rounded ? 7 : 0}" fill="${ACCENT}"/>
  <circle cx="16" cy="17" r="8" fill="#fff"/>
  <g fill="#c9d3ce">
    <circle cx="13.5" cy="14.5" r="1"/><circle cx="17" cy="14" r="1"/>
    <circle cx="15" cy="18" r="1"/><circle cx="18.5" cy="17.5" r="1"/>
  </g>
</svg>`;
}

// Maskable and Apple icons are cropped by the platform: square corners, and the ball already sits
// inside the maskable safe zone (the middle 80%).
export const ICONS = {
  "icon-192": { size: 192, rounded: true },
  "icon-512": { size: 512, rounded: true },
  "icon-maskable-512": { size: 512, rounded: false },
  "apple-touch-icon": { size: 180, rounded: false },
} as const;

export type IconName = keyof typeof ICONS;

export async function iconPng(name: IconName): Promise<Uint8Array<ArrayBuffer>> {
  const { size, rounded } = ICONS[name];
  return new Uint8Array(
    await sharp(Buffer.from(markSvg(size, rounded)))
      .png()
      .toBuffer(),
  );
}

const require = createRequire(import.meta.url);
const font = (weight: 500 | 600) =>
  readFileSync(require.resolve(`@fontsource/jost/files/jost-latin-${weight}-normal.woff`));
let fonts: Array<{ name: string; data: Buffer; weight: 500 | 600 }> | undefined;

export const SHARE_IMAGE = { width: 1200, height: 630 } as const;

/** A 1200×630 Open Graph card: brand, an optional eyebrow (category), title and summary. */
export async function shareImagePng(card: {
  title: string;
  summary: string;
  eyebrow?: string;
}): Promise<Uint8Array<ArrayBuffer>> {
  fonts ??= [
    { name: "Jost", data: font(500), weight: 500 },
    { name: "Jost", data: font(600), weight: 600 },
  ];
  const mark = `data:image/svg+xml;base64,${Buffer.from(markSvg(64)).toString("base64")}`;
  const svg = await satori(
    <div
      style={{
        // Satori sizes boxes without their padding, so the padding is taken off here.
        width: SHARE_IMAGE.width - 144,
        height: SHARE_IMAGE.height - 152,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px 88px",
        background: `linear-gradient(to top, ${ACCENT} 24px, #ffffff 24px)`,
        fontFamily: "Jost",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img src={mark} width={64} height={64} />
        <span style={{ fontSize: 40, fontWeight: 600, color: INK_STRONG, letterSpacing: 1 }}>
          Shotbook
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {card.eyebrow && (
          <span
            style={{
              alignSelf: "flex-start",
              padding: "6px 18px",
              borderRadius: 10,
              background: SURFACE,
              color: ACCENT,
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {card.eyebrow}
          </span>
        )}
        <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.1, color: INK_STRONG }}>
          {card.title}
        </div>
        <div style={{ fontSize: 36, fontWeight: 500, lineHeight: 1.35, color: INK_MUTED }}>
          {card.summary}
        </div>
      </div>
    </div>,
    { ...SHARE_IMAGE, fonts },
  );
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}
