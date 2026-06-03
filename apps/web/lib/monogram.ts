export type MonogramConfig = {
  text: string;       // e.g., "M & J"
  color: string;      // terracotta or whatever the couple picked
  bg?: string;        // monogram badge background; defaults to cream
};

const DEFAULT_BG = '#FAF7F2'; // cream

/**
 * Derive a default monogram label from an event's display name.
 *   "Maria & Juan"          → "M & J"
 *   "Maria and Juan"        → "M & J"
 *   "Maria & Juan (Demo)"   → "M & J"
 *   "Aira-Boy"              → "A & B"
 *   "Setnayan"              → "S"
 *
 * Couples can override via events.monogram_text in the Branding section.
 */
export function deriveMonogram(displayName: string | null | undefined): string {
  if (!displayName) return 'S';
  // Strip parenthetical annotations like "(Demo)" first.
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // Split on "&", "and" (case-insensitive), or hyphens.
  const parts = cleaned
    .split(/\s*(?:&|and|\+|\/|-)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0)?.toUpperCase() ?? 'S';
    const b = parts[1]?.charAt(0)?.toUpperCase() ?? 'S';
    return `${a} & ${b}`;
  }
  return (parts[0]?.charAt(0) ?? 'S').toUpperCase();
}

export function resolveMonogram(event: {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
}): MonogramConfig {
  return {
    text: (event.monogram_text?.trim() || deriveMonogram(event.display_name)).slice(0, 12),
    color: event.monogram_color ?? '#C97B4B',
    bg: DEFAULT_BG,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Onboarding free-monogram → switcher icon (owner-locked 2026-06-03).
 *
 * The wedding onboarding (app/onboarding/wedding) lets the couple pick one of
 * 10 curated {frame · font · ink} presets and persists the active design as
 * `events.monogram_frame_key` + `events.monogram_font_key`. This mirror lets
 * the dashboard chrome (the event switcher) render the SAME design as the
 * couple's icon instead of a plain initials circle. Kept in sync with
 * MONO_DESIGNS in app/onboarding/wedding/_components/onboarding-shell.tsx
 * (a single shared source is a later refactor).
 *
 * At chrome size (~28–36px) the ornate frame webp is illegible, so the switcher
 * renders LETTERS-FORWARD: the couple's initials in their chosen font + ink,
 * no frame (per the 0000 § event-switcher spec note). The frame reads in the
 * larger onboarding medallion + the Website-editor monogram.
 * ──────────────────────────────────────────────────────────────────────── */

type MonoFontKey = 'cormorant' | 'playfair' | 'cinzel' | 'script';
type MonoInkKey = 'mulberry' | 'gold' | 'ink';

const MONO_DESIGNS: { frame: string; font: MonoFontKey; ink: MonoInkKey }[] = [
  { frame: 'wreath', font: 'cormorant', ink: 'mulberry' },
  { frame: 'oval', font: 'playfair', ink: 'ink' },
  { frame: 'crest', font: 'cinzel', ink: 'gold' },
  { frame: 'botanical', font: 'script', ink: 'mulberry' },
  { frame: 'laurel', font: 'cormorant', ink: 'gold' },
  { frame: 'ribbon', font: 'playfair', ink: 'mulberry' },
  { frame: 'flourish', font: 'script', ink: 'ink' },
  { frame: 'square', font: 'cinzel', ink: 'ink' },
  { frame: 'art_deco', font: 'cinzel', ink: 'gold' },
  { frame: 'baroque', font: 'cormorant', ink: 'mulberry' },
];

// Ink hexes mirror app/onboarding/wedding/_styles/onboarding.css :root.
const MONO_INK_HEX: Record<MonoInkKey, string> = {
  mulberry: '#5C2542',
  gold: '#A88340', // --gold-deep
  ink: '#1E2229',
};

// Font-family stacks — all four faces are now loaded in the dashboard chrome
// via next/font/google (app/layout.tsx · owner "yes exact font" 2026-06-03):
// Cormorant = var(--font-display) · Playfair = var(--font-playfair) · Cinzel =
// var(--font-cinzel) · Great Vibes = var(--font-script). So the chrome monogram
// renders in the couple's exact chosen face, matching the onboarding medallion.
// Fallbacks stay for safety.
const MONO_FONT_STACK: Record<
  MonoFontKey,
  { fontFamily: string; fontStyle: 'italic' | 'normal'; letterSpacing: string }
> = {
  cormorant: {
    fontFamily: "var(--font-display), 'Cormorant Garamond', Georgia, serif",
    fontStyle: 'italic',
    letterSpacing: '0.01em',
  },
  playfair: {
    fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
    fontStyle: 'italic',
    letterSpacing: '0.01em',
  },
  cinzel: {
    fontFamily: "var(--font-cinzel), 'Cinzel', Georgia, serif",
    fontStyle: 'normal',
    letterSpacing: '0.04em',
  },
  script: {
    fontFamily: "var(--font-script), 'Great Vibes', 'Snell Roundhand', cursive",
    fontStyle: 'normal',
    letterSpacing: '0.02em',
  },
};

// The frame webps shipped under public/onboarding/mono/. Validate the stored
// frame key before building the <EventMonogram> background URL.
const VALID_FRAMES = new Set<string>([...MONO_DESIGNS.map((d) => d.frame), 'deco_diamond']);

export type MonogramDesignStyle = {
  /** Gold frame webp key (public/onboarding/mono/{frameKey}.webp), or null for
   *  a design that has only a font key. Drives the framed chrome-icon render. */
  frameKey: string | null;
  color: string;
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  letterSpacing: string;
};

/**
 * Resolve the couple's onboarding-designed monogram into CSS for the chrome
 * monogram (event switcher + profile avatar). Returns null when the event has
 * no designed monogram (older or non-onboarding events) — callers fall back to
 * the legacy text+color rendering.
 *
 * frame + font + ink recover the EXACT onboarding design, so the chrome icon is
 * the couple's real framed monogram scaled down. Defensive fallbacks keep it
 * total for any unexpected key value.
 */
export function resolveMonogramDesign(input: {
  monogram_frame_key?: string | null;
  monogram_font_key?: string | null;
}): MonogramDesignStyle | null {
  const frameKey = input.monogram_frame_key ?? null;
  const fontKey = input.monogram_font_key ?? null;
  if (!frameKey && !fontKey) return null;

  const design =
    MONO_DESIGNS.find((d) => d.frame === frameKey && d.font === fontKey) ??
    MONO_DESIGNS.find((d) => d.frame === frameKey) ??
    MONO_DESIGNS.find((d) => d.font === fontKey) ??
    null;

  const ink: MonoInkKey = design?.ink ?? 'mulberry';
  const font: MonoFontKey =
    design?.font ??
    (fontKey === 'playfair' || fontKey === 'cinzel' || fontKey === 'script'
      ? fontKey
      : 'cormorant');
  const stack = MONO_FONT_STACK[font];

  const resolvedFrame =
    frameKey && VALID_FRAMES.has(frameKey) ? frameKey : design?.frame ?? null;

  return {
    frameKey: resolvedFrame,
    color: MONO_INK_HEX[ink],
    fontFamily: stack.fontFamily,
    fontStyle: stack.fontStyle,
    letterSpacing: stack.letterSpacing,
  };
}

/**
 * Build the SVG fragment that composites a monogram into the center of a QR
 * code rendered in module-unit coordinates. The QR generator we use
 * (`qrcode` npm) emits an SVG whose viewBox is in module units (e.g., 41×41
 * for a level-H QR encoding a ~80-char URL).
 *
 * The badge covers ~7×7 modules ≈ 3% of the pattern area — well under the
 * 25% coverage limit that level H (~30% redundancy) can reconstruct.
 */
export function monogramOverlaySvg(opts: {
  viewBoxSize: number;
  monogram: MonogramConfig;
}): string {
  const { viewBoxSize, monogram } = opts;
  const cx = viewBoxSize / 2;
  const cy = viewBoxSize / 2;

  // Badge sizing in module units.
  const padR = Math.max(3, viewBoxSize * 0.08); // outer rounded-rect padding radius
  const circleR = Math.max(2.5, viewBoxSize * 0.135);
  // Font sizing scales with text length so "A & B" and "MJB" both fit.
  const textLen = monogram.text.length;
  const fontSize = textLen <= 1
    ? circleR * 1.4
    : textLen <= 3
      ? circleR * 0.95
      : textLen <= 5
        ? circleR * 0.7
        : circleR * 0.55;

  const safeText = escapeXml(monogram.text);
  const fill = escapeAttr(monogram.bg ?? DEFAULT_BG);
  const stroke = escapeAttr(monogram.color);

  // Layered: rounded-rect clearance (cream) → circle border (terracotta) → text.
  return `
    <rect x="${cx - padR}" y="${cy - padR}" width="${padR * 2}" height="${padR * 2}" rx="${padR * 0.35}" fill="${fill}" />
    <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(0.5, viewBoxSize * 0.018)}" />
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="ui-serif, Georgia, serif" font-style="italic" font-weight="600" font-size="${fontSize}" fill="${stroke}">${safeText}</text>
  `;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}

/**
 * Inject the monogram overlay just before `</svg>` in a QR SVG string.
 * Returns the original string if no `</svg>` is found (defensive).
 */
export function compositeMonogram(qrSvg: string, monogram: MonogramConfig): string {
  const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const size = viewBoxMatch?.[1] ? parseFloat(viewBoxMatch[1]) : 33;
  const overlay = monogramOverlaySvg({ viewBoxSize: size, monogram });
  if (!qrSvg.includes('</svg>')) return qrSvg;
  return qrSvg.replace('</svg>', `${overlay}</svg>`);
}
