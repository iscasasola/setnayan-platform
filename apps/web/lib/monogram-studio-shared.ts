/**
 * apps/web/lib/monogram-studio-shared.ts
 *
 * Vector Monogram Studio — shared, client-safe config model + sanitizers
 * (no IO, importable from both the client editor and the server action).
 *
 * Phase 5 of the monogram overhaul. The studio composes the couple's real
 * font outlines into ONE designed mark (per-crossing boolean interlock ·
 * mirrored fountain-pen frame · stamped symbols) and saves:
 *   · the rendered SVG  → events.monogram_custom_svg  (the single canonical
 *     mark every surface reads — chrome icon, QR centre, landing hero,
 *     save-the-date, PDFs, social cards), and
 *   · this config       → events.monogram_studio_config  (re-editable source).
 *
 * The studio's exported SVG is PURE PATHS (opentype outlines baked to geometry,
 * combined with paper.js booleans) — no webfonts, no scripts — so it renders
 * crisp via an inert data-URI <img> anywhere, exactly like the Cipher mark.
 *
 * Because the studio engine (opentype.js + paper.js boolean ops) needs a
 * browser canvas, the mark is rendered CLIENT-SIDE and the server cannot
 * cheaply re-render it from config (unlike Cipher's pure renderer). So the
 * server SANITIZES the client SVG with a strict reject-don't-repair allowlist
 * — the same defense the bespoke (AI) path uses for externally-produced SVG —
 * and stores it as an inert data-URI source. sanitizeStudioConfig independently
 * clamps the re-editable config so a drifted/hand-edited row can never feed the
 * editor garbage.
 */

export const STUDIO_FONT_KEYS = [
  'cardo',
  'gilda',
  'playfairsc',
  'marcellus',
  'yeseva',
  'cinzeldec',
  'script',
  'pinyon',
] as const;
export type StudioFontKey = (typeof STUDIO_FONT_KEYS)[number];

export const STUDIO_FONTS: { key: StudioFontKey; label: string; file: string }[] = [
  { key: 'cardo', label: 'Cardo', file: 'Cardo-Italic.ttf' },
  { key: 'gilda', label: 'Gilda', file: 'GildaDisplay-Regular.ttf' },
  { key: 'playfairsc', label: 'Playfair', file: 'PlayfairDisplaySC-Regular.ttf' },
  { key: 'marcellus', label: 'Marcellus', file: 'Marcellus-Regular.ttf' },
  { key: 'yeseva', label: 'Yeseva', file: 'YesevaOne-Regular.ttf' },
  { key: 'cinzeldec', label: 'Cinzel Dec', file: 'CinzelDecorative-Regular.ttf' },
  { key: 'script', label: 'Vibes', file: 'GreatVibes-Regular.ttf' },
  { key: 'pinyon', label: 'Pinyon', file: 'PinyonScript-Regular.ttf' },
];

/** Public path the client engine fetches a face from (self-hosted, OFL). */
export function studioFontUrl(file: string): string {
  return `/monogram-studio/fonts/${file}`;
}

export const STUDIO_INKS = ['#5C2542', '#8C6932', '#1E2229'] as const;
export const STUDIO_BGS = ['#FBFBFA', '#ffffff', '#e7dcc2', '#1E2229', 'transparent'] as const;
const STROKE_STYLES = ['broad', 'pointed', 'monoline', 'brush'] as const;
const MIRROR_MODES = ['off', 'v', 'h', '4'] as const;
const SYM_KINDS = ['dot', 'ring', 'diamond', 'triangle', 'star', 'sparkle', 'heart', 'leaf'] as const;
const CROSS_ACTIONS = ['cut', 'merge', 'delete'] as const;
// Parametric frame patterns (council verdict 2026-07-17 §4/§6): every frame is
// a compact RECIPE the engine's frameBuilder turns into filled paper.js
// geometry at render/export time — recipes, never baked stroke data, so frames
// stay re-editable and the SVG-sanitizer path is unchanged. 12 kinds; the two
// corner-* kinds are the "corner set" class, everything else is an enclosure
// (stack rule: ≤ MAX_FRAMES, at most one of each class — enforced in the
// engine's shelf; the sanitizer only bounds). sampaguita + laurel are the
// unconditional Filipino-identity keeps.
export const FRAME_KINDS = [
  'ring',
  'double-ring',
  'open-ring',
  'diamond',
  'cartouche',
  'arch',
  'scallop',
  'laurel',
  'wreath',
  'sampaguita',
  'corner-lines',
  'corner-flourish',
  // accent class (owner 2026-07-17 "accent frames also") — small ornaments that
  // layer WITH an enclosure + corners, not instead of them.
  'sprigs',
  'cardinal-marks',
  'sparkle-duo',
] as const;
export type StudioFrameKind = (typeof FRAME_KINDS)[number];
// Owner override 2026-07-17 ("frames that can intertwine"): up to TWO
// enclosures (weavable where their bands cross) + one corner set + one accent.
export const MAX_FRAMES = 4;
// Starting-point presets (council verdict §3) — provenance ONLY: `preset`
// records which card seeded the design (analytics/`Duo repaired` etc.);
// rendering never reads it. One field, not two (absorbed the separate
// `layout?` proposal).
export const PRESET_KEYS = ['duo', 'interlocked', 'stacked', 'framed-duo', 'solo-ring', 'blank'] as const;
export type StudioPresetKey = (typeof PRESET_KEYS)[number];
// The reveal-animation kinds offered in the studio's "Animate the reveal" panel.
// Exported so the live player (app/_components/studio-reveal-player.tsx) imports
// the ONE allowlist. handwriting/trace/droplet = paper.js/SVG draw-on; gold =
// flowing-gold turn (CSS GoldMonogramReveal); molten = WebGL MoltenMonogramReveal.
// (owner 2026-06-23 — gold/molten are reveal KINDS in this panel, not a separate feature.)
export const ANIM_KINDS = ['handwriting', 'trace', 'droplet', 'gold', 'molten'] as const;
export type StudioAnimKind = (typeof ANIM_KINDS)[number];
// Reveal tempo presets (council verdict §5.4): named chips that WRITE
// dur/smooth/delay — the stored numbers stay canonical (wire format
// untouched); `preset` only remembers which chip is lit ('custom' after any
// fine-tune slider touch).
export const ANIM_TEMPOS = ['quick', 'classic', 'ceremonial', 'custom'] as const;
export type StudioAnimTempo = (typeof ANIM_TEMPOS)[number];

export type StudioLetterState = {
  tx: number;
  ty: number;
  scale: number;
  gap: number;
  outline: number;
  clean: boolean;
  strength: number;
};
export type StudioStrokePoint = { x: number; y: number; pr: number };
export type StudioStroke = {
  w: number;
  nib: number;
  style: (typeof STROKE_STYLES)[number];
  c: string;
  mode: (typeof MIRROR_MODES)[number];
  pts: StudioStrokePoint[];
};
export type StudioSymbol = {
  kind: (typeof SYM_KINDS)[number];
  tx: number;
  ty: number;
  scale: number;
  rot: number;
  mode: (typeof MIRROR_MODES)[number];
  c: string;
};
export type StudioFrame = {
  kind: StudioFrameKind;
  /** Frame colour — defaults to the mark's outline colour in the shelf UI. */
  c: string;
  /** Breathing room between the letter bounds and the frame (auto-fit inset). */
  inset: number;
  /** Multiplier on the auto-fit size (1 = exact auto-fit). */
  scale: number;
  /** Config-only in v1 — no drag handles yet; kept so handles can land later
   *  without a data-model delta (council verdict §8.19). */
  tx: number;
  ty: number;
  /** Band/rule thickness. */
  thick: number;
  /** Repeat count (leaves · petals · scallop bumps); ignored by plain rules. */
  count: number;
  /** Pattern-specific gap (open-ring opening · double-ring spacing · corner size). */
  gap: number;
  /** Double variant where the pattern supports it. */
  dbl: boolean;
  /** Intertwine (owner 2026-07-17): where two enclosure BANDS cross, weave
   *  them over/under alternately — the letters' cut-gap trick applied frame
   *  to frame. Meaningful only while two band enclosures are applied. */
  weave?: boolean;
};
export type StudioConfig = {
  text: string;
  font: StudioFontKey;
  ink: string;
  /** Global outline-ring colour: a hex, or 'none' (no outline drawn). */
  outlineColor: string;
  bg: string;
  st: StudioLetterState[];
  order: number[];
  pstate: Record<string, (typeof CROSS_ACTIONS)[number]>;
  strokes: StudioStroke[];
  syms: StudioSymbol[];
  frames?: StudioFrame[];
  /** Starting-point provenance — which preset card seeded this design. */
  preset?: StudioPresetKey;
  anim?: { kind: (typeof ANIM_KINDS)[number]; dur: number; smooth: number; delay: number; preset?: StudioAnimTempo };
};

// Bounds — generous but finite; the studio works around a 150-unit glyph size
// centred on the origin, so a few thousand units of pan is the realistic span.
const MAX_TEXT = 80;
const MAX_LETTERS = 8;
const MAX_STROKES = 120;
const MAX_PTS = 600;
const MAX_SYMS = 60;
const COORD = 12000;
const MAX_CONFIG_BYTES = 260_000;

function num(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
}
function hex(v: unknown, dflt: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : dflt;
}
function oneOf<T extends readonly string[]>(v: unknown, allow: T, dflt: T[number]): T[number] {
  return typeof v === 'string' && (allow as readonly string[]).includes(v) ? (v as T[number]) : dflt;
}

/**
 * Validate + clamp a re-editable studio config. Returns null only when the
 * shape is unusable; otherwise drops malformed sub-entries rather than the
 * whole design (lenient on detail, strict on bounds).
 */
export function sanitizeStudioConfig(input: unknown): StudioConfig | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;

  const text = typeof o.text === 'string' ? o.text.slice(0, MAX_TEXT) : '';
  const font = oneOf(o.font, STUDIO_FONT_KEYS, 'cardo');
  const ink = hex(o.ink, '#5C2542');
  const outlineColor = o.outlineColor === 'none' ? 'none' : hex(o.outlineColor, '#C5A059');
  const bg =
    o.bg === 'transparent' ? 'transparent' : hex(o.bg, STUDIO_BGS.includes(o.bg as never) ? (o.bg as string) : '#FBFBFA');

  const stRaw = Array.isArray(o.st) ? o.st.slice(0, MAX_LETTERS) : [];
  const st: StudioLetterState[] = stRaw.map((s) => {
    const e = (s ?? {}) as Record<string, unknown>;
    return {
      tx: num(e.tx, -COORD, COORD, 0),
      ty: num(e.ty, -COORD, COORD, 0),
      scale: num(e.scale, 0.05, 12, 1),
      gap: num(e.gap, 0, 60, 6),
      outline: num(e.outline, 0, 60, 3),
      clean: Boolean(e.clean),
      strength: num(e.strength, 0, 1, 0.3),
    };
  });

  const n = st.length;
  const orderRaw = Array.isArray(o.order) ? o.order : [];
  const seen = new Set<number>();
  const order: number[] = [];
  for (const v of orderRaw) {
    const i = typeof v === 'number' ? v : NaN;
    if (Number.isInteger(i) && i >= 0 && i < n && !seen.has(i)) {
      seen.add(i);
      order.push(i);
    }
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) order.push(i); // backfill any missing

  const pstate: Record<string, (typeof CROSS_ACTIONS)[number]> = {};
  if (o.pstate && typeof o.pstate === 'object') {
    for (const [k, v] of Object.entries(o.pstate as Record<string, unknown>)) {
      if (/^\d{1,2}-\d{1,2}$/.test(k) && typeof v === 'string' && (CROSS_ACTIONS as readonly string[]).includes(v)) {
        pstate[k] = v as (typeof CROSS_ACTIONS)[number];
      }
    }
  }

  const strokesRaw = Array.isArray(o.strokes) ? o.strokes.slice(0, MAX_STROKES) : [];
  const strokes: StudioStroke[] = [];
  for (const s of strokesRaw) {
    const e = (s ?? {}) as Record<string, unknown>;
    const ptsRaw = Array.isArray(e.pts) ? e.pts.slice(0, MAX_PTS) : [];
    const pts: StudioStrokePoint[] = ptsRaw.map((p) => {
      const q = (p ?? {}) as Record<string, unknown>;
      return { x: num(q.x, -COORD, COORD, 0), y: num(q.y, -COORD, COORD, 0), pr: num(q.pr, -1, 1, -1) };
    });
    if (pts.length < 1) continue;
    strokes.push({
      w: num(e.w, 1, 60, 14),
      nib: num(e.nib, 0, 90, 40),
      style: oneOf(e.style, STROKE_STYLES, 'broad'),
      c: hex(e.c, ink),
      mode: oneOf(e.mode, MIRROR_MODES, 'v'),
      pts,
    });
  }

  const symsRaw = Array.isArray(o.syms) ? o.syms.slice(0, MAX_SYMS) : [];
  const syms: StudioSymbol[] = symsRaw.map((s) => {
    const e = (s ?? {}) as Record<string, unknown>;
    return {
      kind: oneOf(e.kind, SYM_KINDS, 'dot'),
      tx: num(e.tx, -COORD, COORD, 0),
      ty: num(e.ty, -COORD, COORD, 0),
      scale: num(e.scale, 0.05, 12, 1),
      rot: num(e.rot, -360, 360, 0),
      mode: oneOf(e.mode, MIRROR_MODES, 'off'),
      c: hex(e.c, ink),
    };
  });

  const framesRaw = Array.isArray(o.frames) ? o.frames.slice(0, MAX_FRAMES) : [];
  const frames: StudioFrame[] = framesRaw
    .filter((f) => f && typeof f === 'object')
    .map((f) => {
      const e = f as Record<string, unknown>;
      return {
        kind: oneOf(e.kind, FRAME_KINDS, 'ring'),
        c: hex(e.c, outlineColor === 'none' ? '#C5A059' : outlineColor),
        inset: num(e.inset, -60, 200, 24),
        scale: num(e.scale, 0.05, 12, 1),
        tx: num(e.tx, -COORD, COORD, 0),
        ty: num(e.ty, -COORD, COORD, 0),
        thick: num(e.thick, 1, 40, 6),
        count: num(e.count, 3, 96, 12),
        gap: num(e.gap, 0, 160, 24),
        dbl: Boolean(e.dbl),
        ...(e.weave ? { weave: true } : {}),
      };
    });

  const preset =
    typeof o.preset === 'string' && (PRESET_KEYS as readonly string[]).includes(o.preset)
      ? (o.preset as StudioPresetKey)
      : undefined;

  let anim: StudioConfig['anim'];
  if (o.anim && typeof o.anim === 'object') {
    const a = o.anim as Record<string, unknown>;
    anim = {
      kind: oneOf(a.kind, ANIM_KINDS, 'handwriting'),
      dur: num(a.dur, 1, 15, 6),
      smooth: num(a.smooth, 0, 1, 0.9),
      delay: num(a.delay, 0, 2, 0.3),
      ...(typeof a.preset === 'string' && (ANIM_TEMPOS as readonly string[]).includes(a.preset)
        ? { preset: a.preset as StudioAnimTempo }
        : {}),
    };
  }

  const cfg: StudioConfig = {
    text,
    font,
    ink,
    outlineColor,
    bg,
    st,
    order,
    pstate,
    strokes,
    syms,
    ...(frames.length ? { frames } : {}),
    ...(preset ? { preset } : {}),
    ...(anim ? { anim } : {}),
  };
  if (JSON.stringify(cfg).length > MAX_CONFIG_BYTES) return null;
  return cfg;
}

/* ──────────────────────────────────────────────────────────────────────────
 * SVG sanitation — strict allowlist; REJECT, don't repair. Mirrors
 * lib/bespoke-monogram-engine.ts sanitizeBespokeSvg (the AI-SVG defense),
 * adapted for studio output: the studio emits a tight viewBox with a possibly
 * non-zero origin and never bakes a full-canvas background, so the viewBox
 * regex is relaxed and the background-strip is dropped.
 * ──────────────────────────────────────────────────────────────────────── */

const MAX_SVG_BYTES = 400_000;

// Any of these anywhere → reject. paper.js exportSVG emits plain <path>/<g>
// (+ basic shapes) with solid `fill`; none of these belong in the mark.
const FORBIDDEN: RegExp[] = [
  /<script/i,
  /<foreignobject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<image/i,
  /<use\b/i,
  /<style/i,
  /<animate/i,
  /<set[\s>]/i,
  /<a\b/i,
  /\son\w+\s*=/i, // inline event handlers (onclick, onload, …)
  /javascript:/i,
  // Only fragment refs (#id, e.g. an internal clip) are inert. Any external
  // reference (http, protocol-relative //, data:, blob:) → reject.
  /(?:href|src)\s*=\s*["'](?!#)/i,
  /url\(\s*["']?(?!#)/i,
];

/**
 * Returns the sanitized SVG string, or null if the input fails the allowlist.
 * Normalizations: strip the XML prolog + strip fixed width/height/style off the
 * root tag (CSS owns display size; viewBox drives scaling).
 */
export function sanitizeStudioSvg(raw: string): string | null {
  if (!raw || raw.length > MAX_SVG_BYTES) return null;
  let svg = raw.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
  if (!svg.toLowerCase().startsWith('<svg')) return null;
  if (!svg.toLowerCase().endsWith('</svg>')) return null;
  for (const re of FORBIDDEN) {
    if (re.test(svg)) return null;
  }

  // viewBox is required for responsive scaling. The studio exports a tight box,
  // so x/y may be negative/decimal; only w/h must be positive.
  const vb = svg.match(/viewBox\s*=\s*"\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*"/i);
  if (!vb) return null;
  if (!(parseFloat(vb[3] ?? '0') > 0) || !(parseFloat(vb[4] ?? '0') > 0)) return null;

  // Drop fixed pixel dimensions + style from the root tag; CSS owns display size.
  svg = svg.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(?:width|height)="[^"]*"/gi, '').replace(/\sstyle="[^"]*"/gi, '');
    return `<svg${cleaned}>`;
  });

  return svg;
}
