import type { MonogramConfig } from './monogram';

/**
 * lib/qr-look.ts — WHAT a guest QR looks like, as data. Pure; no server, no DOM.
 *
 * ── THE RULE (owner 2026-09-27, verbatim) ──────────────────────────────────
 * *"QR is free with Setnayan Logo on the center. all Guest QR must have
 * Setnayan Logo on the center. QR on Pro makes the logo use their logo on the
 * center. and change the shape, pattern style."* · *"shape allows square or
 * circle"* · *"this will be tied up to the event hub pro feature"*.
 *
 * So there are exactly two looks a guest QR can wear, and ONE thing decides
 * which — whether the event holds Event Hub Pro (`COUPLE_WEBSITE_PRO`, read
 * through `eventCoupleWebsiteProActive`; §10a internal-hosted events count):
 *
 *   FREE  → `FREE_QR_LOOK`: ink on cream, square, classic modules, the SETNAYAN
 *           mark in the centre. Not a choice; every free code, every surface.
 *   PRO   → the couple's own logo in the centre (their Maker Logo, resolved by
 *           the SAME resolver the Event Hub hero uses — `resolveEventMonogramSvg`
 *           — or their lettered lockup when they have no drawn logo), plus the
 *           three choices below, each ONE dropdown in the Maker's Details.
 *
 * The separate "Custom QR per guest" product (`CUSTOM_QR_GUEST`, palette-tinted
 * modules) FOLDED INTO Event Hub Pro in the same build (decision row 2026-09-27
 * "QR LOGO: AFTER APPLE … FOLDS INTO EVENT HUB PRO"): its colour is the `ink`
 * choice here. One Pro, not two.
 *
 * ── SCANNABILITY IS NOT NEGOTIABLE ─────────────────────────────────────────
 * Every look renders at error-correction level H (~30% redundancy), keeps the
 * three finder patterns square and in the QR's own ink whatever the pattern,
 * caps the centre badge at `BADGE_RADIUS_FRACTION` of the code's side, and
 * refuses an ink that does not clear `MIN_INK_CONTRAST` against the cream
 * ground. `lib/every-qr-look-decodes.test.ts` DECODES a real render of every
 * shape × pattern × centre with the repo's own detector; a look that fails to
 * decode cannot ship, because that test is red.
 */

export type QrShape = 'square' | 'circle';
export type QrPattern = 'classic' | 'rounded' | 'dots';

export const QR_SHAPES: ReadonlyArray<{ key: QrShape; label: string }> = [
  { key: 'square', label: 'Square' },
  { key: 'circle', label: 'Circle' },
];

export const QR_PATTERNS: ReadonlyArray<{ key: QrPattern; label: string }> = [
  { key: 'classic', label: 'Classic' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'dots', label: 'Dots' },
];

/** What sits in the centre clearance. */
export type QrCentre =
  /** The Setnayan mark — every free code. */
  | { kind: 'setnayan' }
  /** The couple's lettered lockup (Pro, no drawn logo yet). */
  | { kind: 'monogram'; monogram: MonogramConfig }
  /** The couple's drawn logo — a sanitised `<svg>` document (Pro). */
  | { kind: 'logo'; svg: string };

export type QrLook = {
  shape: QrShape;
  pattern: QrPattern;
  /** Module (foreground) colour — must clear MIN_INK_CONTRAST against `light`. */
  dark: string;
  /** Ground colour. */
  light: string;
  centre: QrCentre;
};

/** The ink and cream every QR in this product has always used. */
export const QR_INK = '#1A1A1A';
export const QR_CREAM = '#FAF7F2';
/** The official Setnayan mark colour (public/brand/setnayan-mark.svg). */
export const SETNAYAN_GOLD = '#CB9E4B';

/** THE free look. Not configurable; the same on every surface. */
export const FREE_QR_LOOK: QrLook = Object.freeze({
  shape: 'square',
  pattern: 'classic',
  dark: QR_INK,
  light: QR_CREAM,
  centre: { kind: 'setnayan' },
}) as QrLook;

/**
 * The centre badge's radius as a fraction of the QR's side (quiet zone
 * included). 0.135 → a badge ~5.7% of the code's area, the footprint the
 * lettered monogram has carried since 2026-05 under level H; the logo box
 * inside it is 1.5× the radius, so no logo is ever drawn wider than ~0.2 of
 * the side. Do not raise this without re-running the decode suite at every
 * shape × pattern.
 */
export const BADGE_RADIUS_FRACTION = 0.135;

/**
 * WCAG contrast ratio floor for the module ink against the cream ground.
 * 4.5:1 is the AA text floor; a QR needs less in theory, but a phone camera in
 * a dim reception hall does not read theory. Below this a palette colour is
 * offered nowhere and, if somehow stored, falls back to ink at render.
 */
export const MIN_INK_CONTRAST = 4.5;

function hexLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const la = hexLuminance(a);
  const lb = hexLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Is this hex an ink a QR can wear on the cream ground? */
export function qrInkPasses(hex: string | null | undefined): hex is string {
  if (!hex || !HEX_RE.test(hex.trim())) return false;
  // Darker than the ground AND clear of the floor. A light ink on cream can
  // pass the ratio only by being lighter still, which inverts the code.
  return hexLuminance(hex) < hexLuminance(QR_CREAM) && contrastRatio(hex, QR_CREAM) >= MIN_INK_CONTRAST;
}

/**
 * The couple's palette colours a QR may be drawn in — every hex across every
 * role of their Mood Board, deduplicated in palette order, contrast-passing
 * only. Pure over the sanitised palette (`sanitizeRolePalette`).
 */
export function qrInkChoices(palette: Record<string, unknown>, order: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v !== 'string') return;
    const hex = v.trim().toUpperCase();
    if (!qrInkPasses(hex) || seen.has(hex)) return;
    seen.add(hex);
    out.push(hex);
  };
  for (const key of order) {
    const arr = palette[key];
    if (Array.isArray(arr)) for (const v of arr) push(v);
  }
  const custom = palette.custom_roles;
  if (Array.isArray(custom)) {
    for (const role of custom) {
      const colors = (role as { colors?: unknown })?.colors;
      if (Array.isArray(colors)) for (const v of colors) push(v);
    }
  }
  return out;
}

/**
 * The couple's SAVED choices — `events.style_preferences.qr`. Sparse: an
 * absent key is the default, so an event that never opened the panel is
 * byte-identical to today. Stored config is data a human saved, not a promise
 * about shape (the `rsvp_ask_config` rule), so every field is re-checked here.
 */
export type StoredQrStyle = {
  shape?: QrShape;
  pattern?: QrPattern;
  /** A palette hex; honoured only while it passes `qrInkPasses`. */
  ink?: string;
};

export function sanitizeQrStyle(raw: unknown): StoredQrStyle {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: StoredQrStyle = {};
  if (o.shape === 'square' || o.shape === 'circle') out.shape = o.shape;
  if (o.pattern === 'classic' || o.pattern === 'rounded' || o.pattern === 'dots') out.pattern = o.pattern;
  if (typeof o.ink === 'string' && qrInkPasses(o.ink)) out.ink = o.ink.trim().toUpperCase();
  return out;
}

/** The key inside `events.style_preferences` the QR choices live under. */
export const QR_STYLE_PREF_KEY = 'qr';

/** Read the saved choices out of a `style_preferences` blob (unknown shape). */
export function qrStyleFromPreferences(stylePreferences: unknown): StoredQrStyle {
  if (!stylePreferences || typeof stylePreferences !== 'object') return {};
  return sanitizeQrStyle((stylePreferences as Record<string, unknown>)[QR_STYLE_PREF_KEY]);
}

/**
 * Compose the look. PURE — the caller measured `ownsPro` and resolved the
 * couple's mark; this only applies the rule. A free event gets FREE_QR_LOOK
 * regardless of anything saved, so a couple whose Pro lapsed is never shown a
 * choice their guests cannot see.
 *
 * `logoSvg` is skipped when it carries `<text>`: the raster path cannot draw a
 * font request on a lambda (lib/qr-monogram-raster.ts records why), and a
 * screen/file pair that disagree about one couple's mark is the drift this
 * repo forbids — so both surfaces fall back to the lettered lockup together.
 */
export function qrLookFor(input: {
  ownsPro: boolean;
  style: StoredQrStyle;
  monogram: MonogramConfig;
  logoSvg: string | null;
}): QrLook {
  if (!input.ownsPro) return FREE_QR_LOOK;
  const logo = input.logoSvg && !/<text[\s>]/i.test(input.logoSvg) ? input.logoSvg : null;
  return {
    shape: input.style.shape ?? 'square',
    pattern: input.style.pattern ?? 'classic',
    dark: input.style.ink && qrInkPasses(input.style.ink) ? input.style.ink : QR_INK,
    light: QR_CREAM,
    centre: logo ? { kind: 'logo', svg: logo } : { kind: 'monogram', monogram: input.monogram },
  };
}
