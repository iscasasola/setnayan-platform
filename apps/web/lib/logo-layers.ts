/**
 * 🅻 THE LAYERED LOGO — the Maker's Logo page as a stack of elements (owner
 * 2026-09-27, DECISION_LOG "THE LOGO MAKER IS A FULL-SCREEN LAYERED EDITOR").
 *
 * Owner, verbatim: *"on left they can add a text or upload an image, or frame"*
 * · *"image will act as a single element. so uploading to layers of image will
 * create an exact top on top effect"* · *"i want to be able to upload my 2 layer
 * image so each letter gets its own animation. to make our exact logo"*.
 *
 * PURE — no DOM, no fonts, no IO — so node tests hold every rule here:
 *
 *   · A logo is a SQUARE FRAME (`LOGO_FRAME` units) holding layers, bottom → top.
 *     The list order IS the stack: SVG paints later children over earlier ones,
 *     so the composed file draws them in exactly that order — the navigator
 *     shows the same list top-first.
 *   · Each layer owns its shapes (`body`, in its own `w × h` box), its place in
 *     the frame (centre `x`/`y` + `scale`, where 1 = fills the frame), its colour
 *     and its MOTION. An image traced from a 2000×2000 upload fills the frame at
 *     scale 1 — so two uploads drawn on the same canvas land exactly on top of
 *     each other with no positioning (the owner's two-letter logo).
 *   · RAILS ON: a layer never leaves the frame (`clampToFrame`), and it snaps to
 *     the centre and the edges (`snapInFrame`). No free offsets outside it.
 *   · The COMPOSED FILE is what every surface shows — pure paths inside one
 *     `<g data-logo-layer>` per layer, carrying that layer's motion as data-*
 *     (the SVG sanitizer is a blocklist: groups and data attributes pass; images,
 *     hrefs, scripts and styles do not). `parseLogoSvg` reads each layer's shapes
 *     back from it, so the config stores metadata only.
 *
 * Images are TRACED to vector in the browser (`lib/monogram-studio/upload.ts`,
 * the repo's own tracer): black ink on white comes back as paths, the white is
 * simply not ink — "remove white background" is what tracing already does, and
 * `keepWhite` puts a white card back under the layer for a couple who wants it.
 */

import { sanitizeHubFontKey, type HubFontKey } from './hub-fonts';
import { LOGO_FONT_OUTLINE_ITALIC, LOGO_LEGACY_FONT } from './logo-fonts';
import { flattenSvgMark, parseTransform, partsBounds } from './print-mark';

/** The logo's square frame, in SVG units. */
export const LOGO_FRAME = 1000;

export const LOGO_LAYER_KINDS = ['image', 'text', 'frame'] as const;
export type LogoLayerKind = (typeof LOGO_LAYER_KINDS)[number];
export const LOGO_LAYER_KIND_LABEL: Record<LogoLayerKind, string> = { image: 'Image', text: 'Text', frame: 'Frame' };

/* ── HOW ONE LAYER MOVES ─────────────────────────────────────────────────────
   The Maker's own element words (In · During — `lib/element-style.ts`'s
   Rise · Fade · None and Drift · Still), plus "Draw on". The logo plays once,
   so there is no Out. The DELAY is per layer, in seconds, so letter 2 follows
   letter 1.

   ✍ DRAW ON FOLLOWS THE HAND THAT WROTE IT (owner 2026-09-27, of his C: *"it
   loops to the left goes up makes the c and ends with a curl"*). Not a wipe:
   the couple traces the letter ONCE, in writing order ("Show how it's
   written"), and that centreline — the layer's WRITING PATH, the engine's
   `strokes` shape `{ w, pts }` — decides WHEN each bit of ink appears: the
   moment the pen reaches the point of the path nearest to it
   (`writeRevealCells`).

   🔑 NOT A BRUSH (owner 2026-09-28: *"the trace does not follow properly"*).
   The first build dragged a fixed-width mask brush along the path. Anything
   inside the brush appeared early however far along the letter it belonged,
   and anything the brush missed — a thick bowl, a finger trace a few pixels
   off the line — stayed hidden and POPPED in when the mask came off (measured
   on the owner's C: 29% of the ink). The cells split the WHOLE layer box by
   nearest pen position, so every bit of ink has exactly one moment and none
   is left for the end.

   ✍ NO WRITING PATH → THE OUTLINE TRACES ON (owner 2026-09-28: *"logo
   animation lost its trace effect"*). The first build made a layer with no
   writing path Fade instead, and made that the default — so every uploaded
   letter lost the studio's trace. Draw on without a path strokes the letter's
   own outline on and inks the fill in (the studio's Handwriting), and it is
   what a new layer does until the couple picks something else. */
export const LOGO_IN = ['draw', 'rise', 'fade', 'none'] as const;
export type LogoIn = (typeof LOGO_IN)[number];
export const LOGO_DURING = ['still', 'drift'] as const;
export type LogoDuring = (typeof LOGO_DURING)[number];
export const LOGO_DELAY_MAX = 4;
export const LOGO_DELAY_STEP = 0.1;
/** How long one layer's In takes, in seconds, until the couple sets its speed. */
export const LOGO_IN_SECONDS: Record<LogoIn, number> = { draw: 2, rise: 0.9, fade: 0.8, none: 0 };

/* ⏱ EACH LAYER SETS ITS OWN SPEED (owner 2026-09-28: *"also the animation can
   set it speed"*): `dur` is how long its In takes, in seconds. Absent = the
   In's own default above, so every logo saved before keeps its timing. */
export const LOGO_DUR_MIN = 0.3;
export const LOGO_DUR_MAX = 8;
export const LOGO_DUR_STEP = 0.1;

/* 🚪 OUT (owner 2026-09-27, asked; built 2026-10-07 — DECISION_LOG 2026-10-06
   "THE LOGO MAKER IS THE SHIPPED LAYERED EDITOR … PLUS THREE OF THE OWNER'S OWN
   UNBUILT ASKS"): how a layer LEAVES once the whole logo has played and held
   (`LOGO_OUT_HOLD_SECONDS`). Absent = None, so every logo saved before stays
   exactly as it plays today. */
export const LOGO_OUT = ['none', 'fade', 'sink'] as const;
export type LogoOut = (typeof LOGO_OUT)[number];

export type LogoMotion = { in: LogoIn; during: LogoDuring; delay: number; dur?: number; out?: Exclude<LogoOut, 'none'> };

/** How long a layer's In actually takes, in seconds. */
export function logoInSeconds(m: Pick<LogoMotion, 'in' | 'dur'>): number {
  if (m.in === 'none') return 0;
  return typeof m.dur === 'number' ? m.dur : LOGO_IN_SECONDS[m.in];
}

/** The centreline the couple traced, in the layer's own box, and the width of
 *  the brush that reveals along it. The studio engine's stroke shape. */
export type LogoWritePath = { w: number; pts: Array<{ x: number; y: number }> };
export const LOGO_WRITE_MAX_PTS = 400;

/* ── FRAMES — a closed set, never free drawing ───────────────────────────────
   The studio's own band frames (`FRAME_DEFS` in the engine), drawn here as
   plain evenodd paths so no canvas is needed. */
export const LOGO_FRAME_KINDS = ['ring', 'double-ring', 'open-ring', 'diamond', 'arch', 'cartouche', 'scallop'] as const;
export type LogoFrameKind = (typeof LOGO_FRAME_KINDS)[number];
export const LOGO_DEFAULT_INK = '#5C2542';

export const LOGO_MAX_LAYERS = 12;
export const LOGO_SCALE_MIN = 0.1;
export const LOGO_SCALE_MAX = 1.5;
const MAX_NAME = 40;
const MAX_TEXT = 40;

/** What the config stores for a layer (its shapes live in the composed SVG). */
export type LogoLayerMeta = {
  id: string;
  kind: LogoLayerKind;
  name: string;
  /** Centre in the frame, 0 … LOGO_FRAME. */
  x: number;
  y: number;
  /** 1 = the layer's box fits the frame exactly. */
  scale: number;
  /** ↻ Degrees, −180 … 180, about the layer's centre (owner 2026-10-06, "a Rotate slider in Size and place"). Absent = upright. */
  rotate?: number;
  /** A hex, or null = the image's own colours (text/frame always carry one). */
  color: string | null;
  motion: LogoMotion;
  /** Text: the words, and the face they are set in — a key of the stages'
   *  own font list (`lib/logo-fonts.ts`). */
  text?: string;
  font?: HubFontKey;
  /** Text: set in the face's italic. Only a logo made before the stage list
   *  carries it (the studio's Cardo was Cardo Italic) — always a boolean once
   *  saved, so an upright Cardo never reads back as the old italic. */
  italic?: boolean;
  /** Frame: which one. */
  frame?: LogoFrameKind;
  /** Image: keep a white card under it (default: the white is gone). */
  keepWhite?: boolean;
  /** How it is written (image · text) — the path "Draw on" reveals along. */
  write?: LogoWritePath;
};

/** A layer with its shapes: `body` is SVG paths in its own `w × h` box.
 *  `autoDelay` (editor-only, never saved) = its delay is still the default,
 *  which follows the stack (`retimeLayers`). */
export type LogoLayer = LogoLayerMeta & { body: string; w: number; h: number; autoDelay?: boolean };

/* ── sanitising (the config is host-writable; bounds are strict) ─────────── */

const ID_RE = /^[a-z0-9]{1,16}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clampNum(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, n));
}
function pick<T extends readonly string[]>(v: unknown, allow: T, dflt: T[number]): T[number] {
  return typeof v === 'string' && (allow as readonly string[]).includes(v) ? (v as T[number]) : dflt;
}
/** Plain words only — no markup, no control characters. */
function plain(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[<>"'`\u0000-\u001f\u007f]/g, '').slice(0, max);
}

export function sanitizeLogoMotion(raw: unknown, dflt: LogoMotion = defaultMotion(0)): LogoMotion {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const delay = clampNum(o.delay, 0, LOGO_DELAY_MAX, dflt.delay);
  const out: LogoMotion = {
    in: pick(o.in, LOGO_IN, dflt.in),
    during: pick(o.during, LOGO_DURING, dflt.during),
    delay: Number((Math.round(delay / LOGO_DELAY_STEP) * LOGO_DELAY_STEP).toFixed(1)),
  };
  // An Out only when one was chosen — None is the same as never set.
  const leave = pick(o.out, LOGO_OUT, 'none');
  if (leave !== 'none') out.out = leave;
  // A speed only when one was set — a string, NaN or a missing value is "the default".
  if (typeof o.dur === 'number' && Number.isFinite(o.dur)) {
    const dur = clampNum(o.dur, LOGO_DUR_MIN, LOGO_DUR_MAX, LOGO_IN_SECONDS.draw);
    out.dur = Number((Math.round(dur / LOGO_DUR_STEP) * LOGO_DUR_STEP).toFixed(1));
  }
  return out;
}

/** A traced writing path: finite points (at least two), bounded, rounded. */
export function sanitizeWritePath(raw: unknown): LogoWritePath | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.pts)) return undefined;
  const pts: Array<{ x: number; y: number }> = [];
  // Thin a long trace EVENLY — never cut its tail (the first build sliced the
  // first 400 points, so a slow trace lost its end: the owner's closing curl).
  for (const p of evenlyThinned(o.pts, LOGO_WRITE_MAX_PTS)) {
    const q = (p ?? {}) as Record<string, unknown>;
    if (typeof q.x !== 'number' || typeof q.y !== 'number' || !Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
    pts.push({ x: Math.round(clampNum(q.x, -5000, 5000, 0) * 10) / 10, y: Math.round(clampNum(q.y, -5000, 5000, 0) * 10) / 10 });
  }
  if (pts.length < 2) return undefined;
  return { w: Math.round(clampNum(o.w, 1, 2000, 60) * 10) / 10, pts };
}

/** ↻ A turn in whole degrees, −180 … 180; 0 (upright) and anything unreadable are "no turn". */
export const LOGO_ROTATE_MAX = 180;
export function sanitizeRotate(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  const r = Math.round(Math.min(LOGO_ROTATE_MAX, Math.max(-LOGO_ROTATE_MAX, v)));
  return r === 0 ? 0 : r;
}

/** Each layer checked alone; a malformed one is dropped, never the whole logo. */
export function sanitizeLogoLayers(raw: unknown): LogoLayerMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: LogoLayerMeta[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, LOGO_MAX_LAYERS)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' && ID_RE.test(o.id) ? o.id : null;
    if (!id || seen.has(id)) continue;
    const kind = pick(o.kind, LOGO_LAYER_KINDS, 'image');
    if (o.kind !== kind) continue;
    seen.add(id);
    const color = typeof o.color === 'string' && HEX_RE.test(o.color) ? o.color : null;
    const layer: LogoLayerMeta = {
      id,
      kind,
      name: plain(o.name, MAX_NAME) || LOGO_LAYER_KIND_LABEL[kind],
      x: clampNum(o.x, 0, LOGO_FRAME, LOGO_FRAME / 2),
      y: clampNum(o.y, 0, LOGO_FRAME, LOGO_FRAME / 2),
      scale: clampNum(o.scale, LOGO_SCALE_MIN, LOGO_SCALE_MAX, 1),
      ...(sanitizeRotate(o.rotate) ? { rotate: sanitizeRotate(o.rotate) } : {}),
      color: kind === 'image' ? color : (color ?? LOGO_DEFAULT_INK),
      motion: sanitizeLogoMotion(o.motion),
    };
    if (kind === 'text') {
      layer.text = plain(o.text, MAX_TEXT);
      const font = sanitizeHubFontKey(typeof o.font === 'string' ? (LOGO_LEGACY_FONT[o.font] ?? o.font) : null) ?? 'cardo';
      layer.font = font;
      // No `italic` saved = a layer from before the stage list, whose Cardo was
      // the italic; a face with no italic outlines is always upright.
      const italic = typeof o.italic === 'boolean' ? o.italic : font === 'cardo';
      layer.italic = italic && Boolean(LOGO_FONT_OUTLINE_ITALIC[font]);
    }
    if (kind === 'frame') layer.frame = pick(o.frame, LOGO_FRAME_KINDS, 'ring');
    if (kind === 'image' && o.keepWhite === true) layer.keepWhite = true;
    if (kind !== 'frame') {
      const write = sanitizeWritePath(o.write);
      if (write) layer.write = write;
    }
    out.push(layer);
  }
  return out;
}

/* ── defaults ──────────────────────────────────────────────────────────────── */

/** A new layer's motion: it arrives as the layer below it finishes — upload the
 *  I, then the C, and the I comes in first and the C after it. It Draws on:
 *  its outline traces on until the couple shows how it is written, then it
 *  follows the pen. */
export function defaultMotion(indexInStack: number): LogoMotion {
  const delay = Math.min(LOGO_DELAY_MAX, Math.max(0, indexInStack) * LOGO_IN_SECONDS.draw);
  return { in: 'draw', during: 'still', delay: Number(delay.toFixed(1)) };
}

/* ── the writing path ─────────────────────────────────────────────────────── */

/** At most `max` items, taken evenly from first to LAST (the end is kept). */
export function evenlyThinned<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return items.slice();
  if (max < 2) return items.slice(0, max);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round((i * (items.length - 1)) / (max - 1))] as T);
  return out;
}

/** Rounds to a tenth — shared by the editor half (`logo-layers-edit.ts`) and the pen's cells, so it stays here and both import it. */
export const R = (v: number) => Math.round(v * 10) / 10;

/** Does this saved mark carry layers (so it plays each layer's own motion)? */
export function isLayeredLogo(svg: string | null | undefined): boolean {
  return typeof svg === 'string' && svg.includes('data-logo="layers"') && svg.includes('data-logo-layer=');
}

/**
 * ▶ DOES THIS SAVED LOGO MOVE? — a layered logo with at least one layer whose
 * In is not None, or whose During is Drift (owner 2026-09-29: *"all logos
 * should animate if animation is active"*). A layered logo whose every layer is
 * None + Still is a still logo, and draws as one. Read off the saved file's own
 * data-* — the same attributes `LayeredLogoPlayer` plays, run through the same
 * `sanitizeLogoMotion`, so "moves" here and "plays" there cannot disagree.
 */
export function logoHasMotion(svg: string | null | undefined): boolean {
  if (!isLayeredLogo(svg)) return false;
  const re = /<g data-logo-layer="[^"]*"([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg as string))) {
    const attrs = m[1] ?? '';
    const read = (name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
    const motion = sanitizeLogoMotion({ in: read('data-in'), during: read('data-during') });
    if (motion.in !== 'none' || motion.during === 'drift') return true;
  }
  return false;
}

/* ── CENTRED BY ITS INK ─────────────────────────────────────────────────────
   Owner 2026-09-28, showing an "AM" logo sitting left of centre above the
   names on the hero: *"when a logo is created and it is not centered. you
   should automatically center it and not rely on how they aligned it to the
   left"* (DECISION_LOG "A LOGO IS ALWAYS CENTRED BY ITS INK, WHEREVER IT IS
   PLACED IN THE LOGO EDITOR").

   The composed file's viewBox is the editor's whole square artboard, so every
   surface that centres the MARK centred the ARTBOARD — and a logo dragged to
   the left, or an upload whose ink sits off-centre on its canvas, drew off
   centre everywhere. `centreLogoOnItsInk` re-frames the file on what is
   actually drawn: the union of every layer's ink (text and traced images by
   their outlines, measured at each curve's own extrema — an italic swash
   reaches past its advance box and past its control points' hull both ways —
   a kept white card and a frame by the box they paint), plus one even margin.
   The layers themselves are untouched, so the couple's arrangement between
   them is exactly what they made; only the empty artboard around it goes.

   🔑 DERIVED ON READ, NEVER STORED. It runs inside THE resolver
   (`resolveEventMonogramSvg`), so every logo already saved is centred with no
   migration, the editor keeps its artboard, and a surface cannot forget it.
   It is idempotent (it reads the ink, never the old viewBox). The Draw-on
   player works in each layer's own box, so a new viewBox moves nothing in it. */

/** The even margin around the ink, as a share of its longer side. */
export const LOGO_INK_MARGIN = 0.04;

export type LogoInkBox = { x: number; y: number; w: number; h: number };

/** A shape with something to draw — an empty `<path d="">` (a text layer
 *  with no words yet) is no ink at all. */
const HAS_SHAPE = /<(?:rect|circle|ellipse|polygon|polyline|line|image|text|use)\b|<path\b[^>]*\sd="[^"]*\d/i;

/**
 * The bounds of what the composed logo actually draws, in frame units — or
 * null when it is not a layered logo or a layer's place cannot be read.
 */
export function logoInkBox(svg: string): LogoInkBox | null {
  if (!isLayeredLogo(svg)) return null;
  const starts: number[] = [];
  const re = /<g data-logo-layer="[a-z0-9]{1,16}"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) starts.push(m.index);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const add = (b: LogoInkBox) => {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  };
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? (starts[i + 1] as number) : svg.lastIndexOf('</svg>');
    const chunk = svg.slice(starts[i], end);
    if (!HAS_SHAPE.test(chunk)) continue;
    // The layer's own outlines, its transform baked in (`lib/print-mark.ts`).
    const flat = flattenSvgMark(`<svg xmlns="http://www.w3.org/2000/svg">${chunk}</svg>`);
    const ink = flat ? partsBounds(flat.parts) : null;
    if (ink) {
      add(ink);
      continue;
    }
    // Not outlines (a raster, a stroke-only flourish): the box the layer is
    // drawn in — never smaller than what it can paint.
    const open = /^<g\b[^>]*>/.exec(chunk)?.[0] ?? '';
    const t = parseTransform(/\stransform="([^"]*)"/.exec(open)?.[1] ?? null);
    const body = /<g data-logo-body="([\d.]+) ([\d.]+)">/.exec(chunk);
    if (!t || !body) return null;
    const w = Number(body[1]);
    const h = Number(body[2]);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [px, py] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
      xs.push(t[0] * px + t[2] * py + t[4]);
      ys.push(t[1] * px + t[3] * py + t[5]);
    }
    add({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
  }
  if (!(x1 > x0) || !(y1 > y0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const inkCache = new Map<string, string>();
const INK_CACHE_MAX = 32;

/**
 * THE LOGO, FRAMED ON ITS INK — the composed file with its viewBox set to the
 * ink box plus `LOGO_INK_MARGIN` on every side, so any surface that centres
 * the mark centres what is drawn. Anything that is not a layered logo, or
 * whose ink cannot be measured, comes back exactly as it went in.
 */
export function centreLogoOnItsInk(svg: string | null): string | null {
  if (!svg || !isLayeredLogo(svg)) return svg;
  const hit = inkCache.get(svg);
  if (hit !== undefined) return hit;
  let out = svg;
  const box = logoInkBox(svg);
  const open = /^\s*<svg\b[^>]*>/.exec(svg);
  if (box && open && /\sviewBox="[^"]*"/.test(open[0])) {
    const pad = Math.max(box.w, box.h) * LOGO_INK_MARGIN;
    // Outward to the hundredth, so rounding can never shave the ink.
    const lo = (v: number) => Math.floor(v * 100) / 100;
    const hi = (v: number) => Math.ceil(v * 100) / 100;
    const x = lo(box.x - pad);
    const y = lo(box.y - pad);
    const w = Math.round((hi(box.x + box.w + pad) - x) * 100) / 100;
    const h = Math.round((hi(box.y + box.h + pad) - y) * 100) / 100;
    const tag = open[0].replace(/\sviewBox="[^"]*"/, ` viewBox="${x} ${y} ${w} ${h}"`);
    out = tag + svg.slice(open[0].length);
  }
  if (inkCache.size >= INK_CACHE_MAX) inkCache.delete(inkCache.keys().next().value as string);
  inkCache.set(svg, out);
  return out;
}

/* ── motion, timed ─────────────────────────────────────────────────────────── */

/** When each layer starts and ends its In, in stack order. */
export function logoTimeline(layers: Array<Pick<LogoLayerMeta, 'id' | 'motion'>>): Array<{ id: string; start: number; end: number }> {
  return layers.map((l) => ({ id: l.id, start: l.motion.delay, end: l.motion.delay + logoInSeconds(l.motion) }));
}
