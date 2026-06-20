export type MonogramConfig = {
  text: string;       // e.g., "M & J"
  color: string;      // terracotta or whatever the couple picked
  bg?: string;        // monogram badge background; defaults to cream
  // Present only when the caller passes the design columns (font/style/frame)
  // into resolveMonogram — lets type-rendered surfaces (e.g. the landing hero)
  // draw the mark in the couple's EXACT chosen face instead of a generic serif.
  fontFamily?: string;
  fontStyle?: 'italic' | 'normal';
  // Full chosen-lockup design (populated when resolveMonogram is given the
  // design columns) — lets string-SVG surfaces like the QR center draw the
  // couple's actual LOCKUP, not just initials. `inkColor` is the lockup ink
  // (mulberry / gold), distinct from `color` (the couple's accent used for the
  // badge ring + the legacy initials).
  style?: MonoStyle | null;
  letterSpacing?: string;
  inkColor?: string;
  frameKey?: string | null;
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

/**
 * Pull the two lockup initials out of a resolved monogram label. The label is
 * "A & B" for couples (deriveMonogram / monogram_text), or a single "S" for
 * one-name events. Returns ['', ''] when there isn't a clean pair so callers
 * can fall back to the letters-forward badge. Shared by the dashboard chip
 * (EventMonogram), the landing hero (HeroMonogram), and the QR-center overlay.
 */
export function splitInitials(text: string): [string, string] {
  const parts = text.split('&').map((s) => s.trim()).filter(Boolean);
  const a = (parts[0]?.charAt(0) ?? '').toUpperCase();
  const b = (parts[1]?.charAt(0) ?? '').toUpperCase();
  return [a, b];
}

export function resolveMonogram(event: {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  // Optional design columns — callers that select them get fontFamily/fontStyle
  // resolved into the config (callers that don't are unchanged).
  monogram_font_key?: string | null;
  monogram_style?: string | null;
  monogram_frame_key?: string | null;
}): MonogramConfig {
  const design =
    event.monogram_font_key != null ||
    event.monogram_style != null ||
    event.monogram_frame_key != null
      ? resolveMonogramDesign(event)
      : null;
  return {
    text: (event.monogram_text?.trim() || deriveMonogram(event.display_name)).slice(0, 12),
    color: event.monogram_color ?? '#C97B4B',
    bg: DEFAULT_BG,
    ...(design
      ? {
          fontFamily: design.fontFamily,
          fontStyle: design.fontStyle,
          style: design.style,
          letterSpacing: design.letterSpacing,
          inkColor: design.color,
          frameKey: design.frameKey,
        }
      : {}),
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

export type MonoStyle = 'bar' | 'script' | 'duo' | 'framed' | 'infinity';
// 2026-06-11 expansion (owner font-specimen picks): libre_caslon · tangerine ·
// luxurious · vidaloka join the original four. Each key needs (1) a stack entry
// below and (2) its face loaded in app/layout.tsx (next/font → CSS var).
type MonoFontKey =
  | 'cormorant'
  | 'playfair'
  | 'cinzel'
  | 'script'
  | 'libre_caslon'
  | 'tangerine'
  | 'luxurious'
  | 'vidaloka';
type MonoInkKey = 'mulberry' | 'gold' | 'ink';

// The 5 live-typography lockups (owner 2026-06-04) — MUST mirror MONO_DESIGNS in
// app/onboarding/wedding/_components/onboarding-shell.tsx. `frame` is null for the
// four type-only lockups; only `framed` carries the ornate gold filigree frame.
// `ink` drives the chrome icon color (letters-forward at switcher size). A single
// shared source is a later refactor.
const MONO_DESIGNS: { style: MonoStyle; frame: string | null; font: MonoFontKey; ink: MonoInkKey }[] = [
  { style: 'bar', frame: null, font: 'cormorant', ink: 'mulberry' },
  { style: 'script', frame: null, font: 'script', ink: 'mulberry' },
  { style: 'duo', frame: null, font: 'playfair', ink: 'mulberry' },
  { style: 'framed', frame: 'filigree', font: 'cinzel', ink: 'gold' },
  { style: 'infinity', frame: null, font: 'cormorant', ink: 'mulberry' },
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
  {
    fontFamily: string;
    fontStyle: 'italic' | 'normal';
    letterSpacing: string;
    /** Small-size fallback (2026-06-12): hero-only hairline scripts are
     *  illegible at chrome size (~28–36px) — tiny surfaces render this face
     *  instead. Absent = the face holds up small (the original four + the
     *  sturdy serifs), preserving the owner's "exact font in chrome" lock. */
    smallFallback?: MonoFontKey;
  }
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
  // 2026-06-11 expansion — owner picks from the font-specimen session.
  libre_caslon: {
    fontFamily: "var(--font-libre-caslon), 'Libre Caslon Display', Georgia, serif",
    fontStyle: 'normal',
    letterSpacing: '0.02em',
  },
  tangerine: {
    fontFamily: "var(--font-tangerine), 'Tangerine', 'Snell Roundhand', cursive",
    fontStyle: 'normal',
    letterSpacing: '0.02em',
    // Featherweight hairlines vanish at chrome size — fall back to the
    // established small-tolerated script (same romantic register).
    smallFallback: 'script',
  },
  luxurious: {
    fontFamily: "var(--font-luxurious), 'Luxurious Script', 'Snell Roundhand', cursive",
    fontStyle: 'normal',
    letterSpacing: '0.02em',
    smallFallback: 'script',
  },
  vidaloka: {
    fontFamily: "var(--font-vidaloka), 'Vidaloka', Georgia, serif",
    fontStyle: 'normal',
    letterSpacing: '0.02em',
  },
};

/** Is this stored key a face in the registry? New faces (2026-06-11) have no
 *  MONO_DESIGNS row, so the stored font key must win over design derivation. */
function isMonoFontKey(k: string | null): k is MonoFontKey {
  return k != null && Object.prototype.hasOwnProperty.call(MONO_FONT_STACK, k);
}

// Frame assets shipped under public/onboarding/mono/. Kept EXHAUSTIVE (legacy
// 10-preset frames + the 2026-06-04 filigree frame) so already-onboarded couples
// whose events stored a legacy frame key still render their framed chrome icon.
// Validate the stored frame key before building the <EventMonogram> background URL.
const VALID_FRAMES = new Set<string>([
  'wreath', 'oval', 'crest', 'botanical', 'laurel', 'ribbon',
  'flourish', 'square', 'art_deco', 'baroque', 'deco_diamond',
  'filigree',
]);

/**
 * Public URL for a monogram frame asset. Legacy frames ship as raster .webp;
 * the 2026-06-04 filigree frame ships as a crisp transparent .svg.
 */
export function monogramFrameAssetUrl(frameKey: string): string {
  return frameKey === 'filigree'
    ? '/onboarding/mono/filigree.svg'
    : `/onboarding/mono/${frameKey}.webp`;
}

export type MonogramDesignStyle = {
  /** The chosen lockup style (bar · script · duo · framed · infinity), or null
   *  for legacy events resolved only by frame+font. Lets bigger surfaces render
   *  the exact lockup; the chrome icon stays letters-forward regardless. */
  style: MonoStyle | null;
  /** Frame asset key — pass to monogramFrameAssetUrl() for the URL (.webp legacy
   *  / .svg filigree). null for the four type-only lockups. */
  frameKey: string | null;
  color: string;
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  letterSpacing: string;
  /** Small-surface face (2026-06-12): equal to fontFamily/fontStyle for faces
   *  that hold up tiny; the registry's smallFallback stack for hero-only
   *  hairline scripts (Tangerine · Luxurious Script). Chrome-size consumers
   *  (event switcher / profile avatar) render THESE; hero/medallion/maker
   *  keep the exact chosen face. */
  smallFontFamily: string;
  smallFontStyle: 'italic' | 'normal';
  smallLetterSpacing: string;
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
  monogram_style?: string | null;
}): MonogramDesignStyle | null {
  const frameKey = input.monogram_frame_key ?? null;
  const fontKey = input.monogram_font_key ?? null;
  const styleKey = input.monogram_style ?? null;
  if (!frameKey && !fontKey && !styleKey) return null;

  // Prefer the persisted style (authoritative since 2026-06-04). Fall back to
  // frame+font matching for events onboarded before monogram_style existed.
  const design =
    (styleKey ? MONO_DESIGNS.find((d) => d.style === styleKey) : undefined) ??
    MONO_DESIGNS.find((d) => d.frame === frameKey && d.font === fontKey) ??
    MONO_DESIGNS.find((d) => d.frame === frameKey) ??
    MONO_DESIGNS.find((d) => d.font === fontKey) ??
    null;

  const ink: MonoInkKey = design?.ink ?? 'mulberry';
  // The stored font key is authoritative when valid (the Maker's typeface
  // picker can override the lockup's default since 2026-06-11) — the design
  // only supplies the font for legacy rows with no/unknown font key.
  const font: MonoFontKey = isMonoFontKey(fontKey)
    ? fontKey
    : design?.font ?? 'cormorant';
  const stack = MONO_FONT_STACK[font];

  const resolvedFrame =
    frameKey && VALID_FRAMES.has(frameKey) ? frameKey : design?.frame ?? null;

  // Small-surface stack: the registry's fallback face for hairline scripts,
  // the exact face for everything else.
  const smallStack = stack.smallFallback ? MONO_FONT_STACK[stack.smallFallback] : stack;

  return {
    style: design?.style ?? null,
    frameKey: resolvedFrame,
    color: MONO_INK_HEX[ink],
    fontFamily: stack.fontFamily,
    fontStyle: stack.fontStyle,
    letterSpacing: stack.letterSpacing,
    smallFontFamily: smallStack.fontFamily,
    smallFontStyle: smallStack.fontStyle,
    smallLetterSpacing: smallStack.letterSpacing,
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
/**
 * Build the inner SVG for one type-only lockup (bar · duo · script · infinity),
 * normalized to a tight viewBox. STRING twin of the React `MonogramMark`
 * (app/_components/monogram-mark.tsx) — identical geometry, kept in sync by hand
 * (lib/ is framework-agnostic and can't import the JSX component). Used by the
 * QR-center overlay so a scanned/printed QR carries the couple's real mark, not
 * just their initials.
 */
function lockupMarkSvg(opts: {
  style: 'bar' | 'duo' | 'script' | 'infinity';
  a: string;
  b: string;
  fontFamily: string;
  fontStyle: 'italic' | 'normal';
  letterSpacing: string;
  ink: string;
}): { viewBox: string; inner: string } {
  const { style, a, b, fontFamily, fontStyle, letterSpacing, ink } = opts;
  const A = escapeXml(a);
  const B = escapeXml(b);
  const g =
    `fill="${ink}" font-family="${escapeAttr(fontFamily)}" font-style="${fontStyle}" ` +
    `letter-spacing="${escapeAttr(letterSpacing)}" font-weight="600" text-anchor="middle"`;
  if (style === 'bar') {
    return {
      viewBox: '6 14 120 70',
      inner:
        `<text x="28" y="72" font-size="64" ${g}>${A}</text>` +
        `<line x1="66" y1="16" x2="66" y2="42" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<line x1="66" y1="66" x2="66" y2="82" stroke="${ink}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<text x="66" y="60" font-size="22" ${g}>&amp;</text>` +
        `<text x="104" y="72" font-size="64" ${g}>${B}</text>`,
    };
  }
  if (style === 'duo') {
    return {
      viewBox: '-4 18 110 62',
      inner:
        `<text x="34" y="72" font-size="66" ${g}>${A}</text>` +
        `<text x="68" y="72" font-size="66" ${g}>${B}</text>`,
    };
  }
  if (style === 'script') {
    return {
      viewBox: '8 6 168 90',
      inner:
        `<text x="42" y="78" font-size="74" ${g}>${A}</text>` +
        `<text x="92" y="76" font-size="46" ${g}>&amp;</text>` +
        `<text x="142" y="78" font-size="74" ${g}>${B}</text>`,
    };
  }
  // infinity — gold ∞ + caps. The gradient id is fixed: every ∞ mark on a page
  // (e.g. a print sheet of guest QRs) shares one identical gradient, so the
  // duplicate <defs> are harmless (the browser resolves url(#…) to the first).
  return {
    viewBox: '18 8 164 76',
    inner:
      `<defs><linearGradient id="sn-mono-gold" x1="0" y1="0" x2="1" y2="0">` +
      `<stop offset="0" stop-color="#A88340"/><stop offset="0.5" stop-color="#E4C77E"/>` +
      `<stop offset="1" stop-color="#A88340"/></linearGradient></defs>` +
      `<path d="M100 46 C76 14 26 14 26 46 C26 78 76 78 100 46 C124 14 174 14 174 46 C174 78 124 78 100 46 Z" ` +
      `fill="none" stroke="url(#sn-mono-gold)" stroke-width="6" stroke-linecap="round"/>` +
      `<text x="56" y="56" font-size="30" ${g}>${A}</text>` +
      `<text x="140" y="56" font-size="30" ${g}>${B}</text>`,
  };
}

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
  const fill = escapeAttr(monogram.bg ?? DEFAULT_BG);
  const stroke = escapeAttr(monogram.color);

  // When the couple chose a type-only lockup, draw their REAL mark inside the
  // cream clearance circle (owner 2026-06-14) — same footprint as the old
  // initials badge, so QR scannability (level-H, ~3% coverage) is unchanged.
  const lockStyle = monogram.style;
  const [a, b] = splitInitials(monogram.text);
  const isLockup =
    (lockStyle === 'bar' || lockStyle === 'duo' || lockStyle === 'script' || lockStyle === 'infinity') &&
    Boolean(a) &&
    Boolean(b);

  let inner: string;
  if (isLockup) {
    const mark = lockupMarkSvg({
      style: lockStyle,
      a,
      b,
      fontFamily: monogram.fontFamily ?? "ui-serif, Georgia, serif",
      fontStyle: monogram.fontStyle ?? 'italic',
      letterSpacing: monogram.letterSpacing ?? '0',
      ink: monogram.inkColor ?? monogram.color,
    });
    // Square fit-box inside the circle; the wide marks letterbox within it.
    const box = circleR * 1.5;
    inner =
      `<svg x="${cx - box / 2}" y="${cy - box / 2}" width="${box}" height="${box}" ` +
      `viewBox="${mark.viewBox}" preserveAspectRatio="xMidYMid meet">${mark.inner}</svg>`;
  } else {
    // Legacy / framed / single-name → initials, now in the couple's CHOSEN face
    // (was a hardcoded serif italic) so even the fallback matches their site.
    const textLen = monogram.text.length;
    const fontSize =
      textLen <= 1 ? circleR * 1.4 : textLen <= 3 ? circleR * 0.95 : textLen <= 5 ? circleR * 0.7 : circleR * 0.55;
    const ff = monogram.fontFamily ? escapeAttr(monogram.fontFamily) : 'ui-serif, Georgia, serif';
    const fStyle = monogram.fontStyle ?? 'italic';
    const inkText = escapeAttr(monogram.inkColor ?? monogram.color);
    inner = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="${ff}" font-style="${fStyle}" font-weight="600" font-size="${fontSize}" fill="${inkText}">${escapeXml(monogram.text)}</text>`;
  }

  // Layered: rounded-rect clearance (cream) → circle (cream fill + accent ring)
  // → the couple's mark (lockup or initials).
  return `
    <rect x="${cx - padR}" y="${cy - padR}" width="${padR * 2}" height="${padR * 2}" rx="${padR * 0.35}" fill="${fill}" />
    <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="${fill}" stroke="${stroke}" stroke-width="${Math.max(0.5, viewBoxSize * 0.018)}" />
    ${inner}
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
