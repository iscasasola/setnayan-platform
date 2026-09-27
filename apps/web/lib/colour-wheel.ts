/**
 * apps/web/lib/colour-wheel.ts — THE COLOUR PANEL'S ARITHMETIC.
 *
 * Keynote's Colour panel (owner 2026-09-27, "ALL THE MAKER'S TOOLBARS TAKE
 * KEYNOTE AND PAGES AS THEIR MODEL"; the approved prototype's split well): a
 * wheel (hue round the rim, saturation from the centre out), a Brightness
 * slider and an Opacity slider, over one colour. The wheel and brightness are
 * HSV; the colour stored is still `#rrggbb` (or `#rrggbbaa` below 100%
 * opacity — `lib/element-style.ts` `hubElementColor`), so nothing new reaches
 * CSS: a panel position is turned into hex digits here and nowhere else.
 *
 * Pure. No DOM.
 */

export type Hsv = { h: number; s: number; v: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** `#rrggbb` (the first six digits of a longer one) → HSV; null when it is not a colour. */
export function hexToHsv(hex: string): Hsv | null {
  const m = /^#([0-9a-f]{6})/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** HSV → `#rrggbb`. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = clamp01(v) * clamp01(s);
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = clamp01(v) - c;
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return `#${hex2((r + m) * 255)}${hex2((g + m) * 255)}${hex2((b + m) * 255)}`;
}

/** The opacity (0–100) a stored colour carries: 100 for six digits. */
export function colourOpacity(hex: string): number {
  return hex.length === 9 ? Math.round((parseInt(hex.slice(7, 9), 16) / 255) * 100) : 100;
}

/** A colour at an opacity (0–100): six digits at 100, else `#rrggbbaa`. */
export function withOpacity(hex: string, opacity: number): string {
  const base = hex.slice(0, 7).toLowerCase();
  const pct = Math.round(Math.min(100, Math.max(0, opacity)));
  return pct >= 100 ? base : `${base}${hex2((pct / 100) * 255)}`;
}

/**
 * A point on the wheel → hue and saturation. `x`, `y` are relative to the
 * wheel's centre, `radius` its radius; outside the rim is the rim.
 */
export function wheelPoint(x: number, y: number, radius: number): { h: number; s: number } {
  const r = Math.hypot(x, y);
  let h = (Math.atan2(y, x) * 180) / Math.PI + 90;
  if (h < 0) h += 360;
  return { h: h % 360, s: radius > 0 ? clamp01(r / radius) : 0 };
}

/** Where hue and saturation sit on the wheel — the inverse of `wheelPoint`. */
export function wheelPosition(h: number, s: number, radius: number): { x: number; y: number } {
  const a = ((h - 90) * Math.PI) / 180;
  return { x: Math.cos(a) * s * radius, y: Math.sin(a) * s * radius };
}
