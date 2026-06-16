/**
 * Mood-board palette → couple-website theme tokens (4-path model · 2026-06-14).
 *
 * The couple site's Tailwind colors (`cream`/`ink`/`terracotta`/`mulberry`,
 * incl. `-600`/`-700`) resolve to `rgb(var(--color-*) / <alpha>)`. So we can
 * re-skin the WHOLE site by overriding those `--color-*` vars on a wrapper
 * (InvitationShell's `<main>`) — no component refactor. The override VALUES are
 * space-separated RGB channels (e.g. `92 37 66`), matching the `:root` defaults.
 *
 * The job here is the contrast-safe MAPPING: a mood-board palette is chosen to
 * look beautiful as decor, NOT to be legible UI. We map it to UI roles with a
 * WCAG-AA floor so a guest never meets an unreadable page:
 *   - accent (terracotta family) ← the boldest palette color, darkened until it
 *     reads as text on the page (AA 4.5)
 *   - cta (mulberry family)      ← a deep palette color, darkened until light
 *     button text reads on it (AA 4.5 vs white)
 *   - paper (cream)              ← a near-white palette color for a subtle tint,
 *     else the safe default
 *   - ink (text)                 ← kept the safe obsidian default (always dark →
 *     always high-contrast on a light page); themed text is a later refinement
 *
 * Returns null when the palette is absent/too thin to theme — the caller then
 * injects nothing and the global Clean-Editorial defaults apply (current look).
 */

import type { RolePalette, PaletteKey } from './mood-board';

type RGB = { r: number; g: number; b: number };

const WHITE: RGB = { r: 255, g: 255, b: 255 };

// Brand defaults (the `:root` channel values) — used as safe fallbacks.
const DEFAULTS = {
  paper: { r: 251, g: 251, b: 250 }, // --color-cream
  ink: { r: 30, g: 34, b: 41 }, // --color-ink
  accent: { r: 197, g: 160, b: 89 }, // --color-terracotta
  cta: { r: 92, g: 37, b: 66 }, // --color-mulberry
} as const;

function hexToRgb(hex: string): RGB | null {
  const body = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())?.[1];
  if (!body) return null;
  const n = parseInt(body, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channels(c: RGB): string {
  return `${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)}`;
}

function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: RGB): number {
  return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
}

function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Cheap colorfulness metric (0..1) — max−min channel spread. */
function chroma(c: RGB): number {
  return (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255;
}

/** Multiply toward black. amount 0 = unchanged, 1 = black. */
function darken(c: RGB, amount: number): RGB {
  const k = 1 - amount;
  return { r: c.r * k, g: c.g * k, b: c.b * k };
}

/** Darken `color` in small steps until it clears `target` contrast vs `bg`. */
function ensureContrast(color: RGB, bg: RGB, target: number): RGB {
  let c = color;
  for (let i = 0; i < 24 && contrast(c, bg) < target; i++) {
    c = darken(c, 0.08);
  }
  return c;
}

// Roles richest-first, so the "boldest" pick leans on the reception/ceremony
// aesthetic before the role-specific accents.
const POOL_ORDER: PaletteKey[] = [
  'reception',
  'ceremony',
  'guest',
  'wedding_party',
  'bride',
  'groom',
];

/**
 * Build the `--color-*` overrides for the couple-site subtree, or null when the
 * palette can't safely theme the page.
 */
export function buildSitePaletteVars(
  palette: RolePalette | null | undefined,
): Record<string, string> | null {
  if (!palette) return null;

  const seen = new Set<string>();
  const pool: RGB[] = [];
  const pushHex = (hex: string) => {
    const up = hex.toUpperCase();
    if (seen.has(up)) return;
    const rgb = hexToRgb(up);
    if (rgb) {
      seen.add(up);
      pool.push(rgb);
    }
  };
  for (const key of POOL_ORDER) (palette[key] ?? []).forEach(pushHex);
  for (const key of Object.keys(palette) as PaletteKey[]) {
    if (!POOL_ORDER.includes(key)) (palette[key] ?? []).forEach(pushHex);
  }
  if (pool.length === 0) return null;

  // Paper: subtle tint only when the palette has a genuinely near-white color;
  // otherwise the safe alabaster default.
  const lightest = [...pool].sort((a, b) => luminance(b) - luminance(a))[0]!;
  const paper = luminance(lightest) >= 0.82 ? lightest : DEFAULTS.paper;

  // Ink stays the safe obsidian — always dark, so contrast on any light page is high.
  const ink = DEFAULTS.ink;

  // Accent: the most colorful palette color, made readable as text on the paper.
  const colorful = [...pool]
    .filter((c) => chroma(c) >= 0.12)
    .sort((a, b) => chroma(b) - chroma(a));
  const accentBase = colorful[0] ?? DEFAULTS.accent;
  const accent = ensureContrast(accentBase, paper, 4.5);

  // CTA: a deep colorful color that carries light button text (AA vs white).
  const deepColorful = colorful
    .filter((c) => contrast(c, WHITE) >= 3)
    .sort((a, b) => luminance(a) - luminance(b));
  const ctaBase = deepColorful[0] ?? accentBase;
  const cta = ensureContrast(ctaBase, WHITE, 4.5);

  return {
    '--color-cream': channels(paper),
    '--color-ink': channels(ink),
    '--color-terracotta': channels(accent),
    '--color-terracotta-600': channels(darken(accent, 0.12)),
    '--color-terracotta-700': channels(darken(accent, 0.24)),
    '--color-mulberry': channels(cta),
    '--color-mulberry-600': channels(darken(cta, 0.15)),
    '--color-mulberry-700': channels(darken(cta, 0.28)),
  };
}

// ── Save-the-Date reveal colours (0024 addendum §4) ───────────────────────────
// The envelope role-map: wax seal = the DEEP ACCENT, veil tulle = a sheer
// hue-carrying tint. Both pull from the same Mood-Board pool as the page theme
// above, so the reveal recolours in lockstep with the rest of the couple site.

/** Walk the role palette into a de-duped RGB pool (richest roles first). */
function palettePool(palette: RolePalette | null | undefined): RGB[] {
  if (!palette) return [];
  const seen = new Set<string>();
  const pool: RGB[] = [];
  const push = (hex: string) => {
    const up = hex.toUpperCase();
    if (seen.has(up)) return;
    const rgb = hexToRgb(up);
    if (rgb) {
      seen.add(up);
      pool.push(rgb);
    }
  };
  for (const key of POOL_ORDER) (palette[key] ?? []).forEach(push);
  for (const key of Object.keys(palette) as PaletteKey[]) {
    if (!POOL_ORDER.includes(key)) (palette[key] ?? []).forEach(push);
  }
  return pool;
}

function toHex(c: RGB): string {
  const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

/** Lighten `c` toward white by `amount` (0 = unchanged, 1 = white). */
function lighten(c: RGB, amount: number): RGB {
  return {
    r: c.r + (255 - c.r) * amount,
    g: c.g + (255 - c.g) * amount,
    b: c.b + (255 - c.b) * amount,
  };
}

/**
 * Wax-seal colour — the palette's DEEP ACCENT (§4: "Wax seal = the deep accent").
 * The most colourful swatch that still reads as a deep, light-text-bearing tone;
 * mulberry fallback when the palette is sparse. Returned as a `#rrggbb` hex.
 */
export function sealColorFromPalette(palette: RolePalette | null | undefined): string {
  const pool = palettePool(palette);
  const colorful = pool.filter((c) => chroma(c) >= 0.12);
  // Prefer a colour deep enough to read as wax (carries the pressed monogram);
  // among those, the most saturated. Fall back to the most saturated overall,
  // then to brand mulberry.
  const deep = colorful
    .filter((c) => luminance(c) <= 0.5)
    .sort((a, b) => chroma(b) - chroma(a))[0];
  const pick = deep ?? colorful.sort((a, b) => chroma(b) - chroma(a))[0] ?? DEFAULTS.cta;
  return toHex(pick);
}

/**
 * Veil tulle colour — the most colourful swatch lightened toward ivory so the
 * sheer fabric carries a whisper of the palette's hue (legible content shows
 * through). Ivory fallback. Returned as a `#rrggbb` hex.
 */
export function veilColorFromPalette(palette: RolePalette | null | undefined): string {
  const pool = palettePool(palette);
  const colorful = [...pool].filter((c) => chroma(c) >= 0.08).sort((a, b) => chroma(b) - chroma(a));
  const base = colorful[0];
  if (!base) return '#f3ece1';
  return toHex(lighten(base, 0.6));
}
