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
export const LOGO_IN_LABEL: Record<LogoIn, string> = { draw: 'Draw on', rise: 'Rise', fade: 'Fade', none: 'None' };
export const LOGO_DURING = ['still', 'drift'] as const;
export type LogoDuring = (typeof LOGO_DURING)[number];
export const LOGO_DURING_LABEL: Record<LogoDuring, string> = { still: 'Still', drift: 'Drift' };
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
export const LOGO_OUT_LABEL: Record<LogoOut, string> = { none: 'None', fade: 'Fade', sink: 'Sink' };
/** How long the finished logo rests before a layer goes Out, and how long it takes. */
export const LOGO_OUT_HOLD_SECONDS = 1.2;
export const LOGO_OUT_SECONDS = 0.8;

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
export const LOGO_FRAME_LABEL: Record<LogoFrameKind, string> = {
  ring: 'Ring',
  'double-ring': 'Double ring',
  'open-ring': 'Open ring',
  diamond: 'Diamond',
  arch: 'Arch',
  cartouche: 'Cartouche',
  scallop: 'Scallop',
};

/** The colours offered (the studio's inks + white). `null` on an image = its own. */
export const LOGO_INKS = ['#1E2229', '#5C2542', '#8C6932', '#C5A059', '#2A3A5E', '#6E7B66', '#B07A86', '#FFFFFF'] as const;
export const LOGO_DEFAULT_INK = '#5C2542';

/**
 * 🎨 What Colour offers: the shipped eight inks, or — in the new Maker — the five
 * main colours (owner 2026-10-06: "Colour offers the five main colours (today 8
 * fixed inks)"). A layer already in a colour that is not one of the five keeps
 * it on the row, chosen, so opening the row never repaints anything.
 */
export function logoColourChoices(studio: { five: readonly string[] } | null, current: string | null): string[] {
  if (!studio || studio.five.length === 0) return [...LOGO_INKS];
  const five = [...new Set(studio.five.map((c) => c.toUpperCase()))];
  return current && !five.includes(current.toUpperCase()) ? [...five, current] : five;
}

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

/** What a layer actually plays. Draw on always plays now — along the writing
 *  path when there is one, along the letter's own outline when there is not. */
export function effectiveIn(l: { motion: Pick<LogoMotion, 'in'> }): LogoIn {
  return l.motion.in;
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

/** How far along the path (0 … 1) the pen is at time `u` (0 … 1) of the In:
 *  a gentle start and finish, like a hand. */
export function penProgress(u: number): number {
  const c = Math.min(1, Math.max(0, u));
  return (1 - Math.cos(Math.PI * c)) / 2;
}
/** …and its inverse: at what time (0 … 1) the pen reaches progress `t`. */
export function penTime(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return Math.acos(1 - 2 * c) / Math.PI;
}

/** The writing path resampled every `step` units along its length, each
 *  sample carrying how far along the path it is (`t`, 0 … 1). */
function resampleWrite(write: LogoWritePath, samples: number): Array<{ x: number; y: number; t: number }> {
  const pts = write.pts;
  const total = writePathLength(write);
  if (total <= 0) return [{ ...(pts[0] as { x: number; y: number }), t: 0 }];
  const n = Math.max(2, samples);
  const out: Array<{ x: number; y: number; t: number }> = [];
  let seg = 1;
  let segStart = 0;
  for (let i = 0; i < n; i++) {
    const at = (i / (n - 1)) * total;
    while (seg < pts.length - 1) {
      const a = pts[seg - 1] as { x: number; y: number };
      const b = pts[seg] as { x: number; y: number };
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (segStart + len >= at) break;
      segStart += len;
      seg++;
    }
    const a = pts[seg - 1] as { x: number; y: number };
    const b = pts[seg] as { x: number; y: number };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const f = len > 0 ? Math.min(1, Math.max(0, (at - segStart) / len)) : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: i / (n - 1) });
  }
  return out;
}

/** Keep the part of a convex polygon on the side of the bisector nearer to `p`
 *  than to `q` (a half-plane clip — one step of a Voronoi cell). */
function clipNearer(poly: Array<[number, number]>, p: { x: number; y: number }, q: { x: number; y: number }): Array<[number, number]> {
  const nx = q.x - p.x;
  const ny = q.y - p.y;
  const c = (nx * (p.x + q.x) + ny * (p.y + q.y)) / 2;
  const side = (v: [number, number]) => nx * v[0] + ny * v[1] - c; // ≤ 0 = nearer p
  const out: Array<[number, number]> = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as [number, number];
    const b = poly[(i + 1) % poly.length] as [number, number];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const f = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  return out;
}

/** How many pen positions a writing path is split into. */
export const LOGO_WRITE_CELLS = 240;

/**
 * THE PEN'S CELLS — the layer's whole box split by nearest pen position. Cell
 * `i` is every point whose nearest sample along the writing path is sample
 * `i`, and it appears when the pen gets there (`t`, 0 … 1 along the path). The
 * cells tile the box, so every bit of ink appears exactly once, at the moment
 * the pen passes closest to it — never early because a brush was wide, never
 * late because a brush missed it.
 */
export function writeRevealCells(write: LogoWritePath, w: number, h: number): Array<{ t: number; d: string }> {
  return cellsOf(resampleWrite(write, LOGO_WRITE_CELLS), w, h);
}

/**
 * ✂ EACH PART FOLLOWS ONLY THE PEN THAT IS ON IT (owner 2026-09-28: *"we also
 * have each part separated with a small gap, so we know where each part focuses
 * on"*). A letter drawn as parts with small gaps between them traces to one
 * shape per part (`lib/monogram-studio/trace.ts`: one path per connected
 * component). Part `k`'s cells are split among only the pen positions that are
 * ON part `k` (`covers`), so a part appears when the pen reaches IT — never
 * early because the pen passed close by on a neighbouring part — and then
 * follows the pen across it. A part the pen never touches falls back to the
 * whole path's cells: it appears where the pen passes nearest.
 *
 * `covers(k, x, y)` is asked in the layer's own box; the player answers it with
 * the part's real fill (`isPointInFill`, with a finger's tolerance), tests with
 * the rendered pixels.
 */
export function writeRevealPlan(
  write: LogoWritePath,
  w: number,
  h: number,
  parts: number,
  covers: (part: number, x: number, y: number) => boolean,
): Array<Array<{ t: number; d: string }>> {
  const samples = resampleWrite(write, LOGO_WRITE_CELLS);
  let whole: Array<{ t: number; d: string }> | null = null;
  const plan: Array<Array<{ t: number; d: string }>> = [];
  for (let k = 0; k < parts; k++) {
    const on = penAlong(samples, (x, y) => covers(k, x, y));
    plan.push(on.length ? cellsOf(on, w, h) : (whole ??= cellsOf(samples, w, h)));
  }
  return plan;
}

/** A pass this many times shorter than the longest pass over the same part is
 *  the pen CROSSING it, not drawing it. */
export const LOGO_CROSSING_RATIO = 3;

/**
 * ✖ CROSSING IS NOT DRAWING (owner 2026-09-28, of the thin stroke that passes
 * the C's big diagonal: *"i have to pass the big stroke but it cannot build
 * yet. can't you predict the size of the previous stroke and connect them first
 * before we turn and scope that bigger loop?"*). The pen's samples on a part
 * come in RUNS; when the pen crosses a part on its way along another, that run
 * is short — about the part's width — while the pass that draws it runs its
 * length. A run `LOGO_CROSSING_RATIO`× shorter than the part's longest run is
 * dropped, so the big stroke waits for its own pass and the thin stroke carries
 * straight on across its gap. A part with only short runs (a dot, a serif)
 * keeps them all.
 */
function penAlong<T extends { t: number }>(samples: T[], on: (x: number, y: number) => boolean): T[] {
  const runs: T[][] = [];
  let run: T[] = [];
  for (const q of samples as Array<T & { x: number; y: number }>) {
    if (on(q.x, q.y)) run.push(q);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  const span = (r: T[]) => (r.length > 1 ? (r[r.length - 1] as T).t - (r[0] as T).t : 0) + 1 / LOGO_WRITE_CELLS;
  const longest = Math.max(0, ...runs.map(span));
  return runs.filter((r) => span(r) * LOGO_CROSSING_RATIO >= longest).flat();
}

/**
 * 🔢 WHERE THE PEN MEETS EACH PART (owner 2026-09-28: *"the flow should have
 * started on the top of the C. maybe highlight or identify each part to detect
 * its start and end point of the trace?"*). For each part: where the pen first
 * reaches it and where it leaves it, with `order` = the order the parts start
 * drawing (1 = first). A part the pen never touches has no passage — it
 * appears where the pen passes nearest, and the editor says so by leaving it
 * unnumbered.
 */
export function writePartPassages(
  write: LogoWritePath,
  parts: number,
  covers: (part: number, x: number, y: number) => boolean,
): Array<{ order: number; start: { x: number; y: number; t: number }; end: { x: number; y: number; t: number } } | null> {
  const samples = resampleWrite(write, LOGO_WRITE_CELLS);
  const raw = Array.from({ length: parts }, (_, k) => {
    const on = penAlong(samples, (x, y) => covers(k, x, y));
    return on.length ? { start: on[0] as { x: number; y: number; t: number }, end: on[on.length - 1] as { x: number; y: number; t: number } } : null;
  });
  const byStart = raw
    .map((r, k) => ({ r, k }))
    .filter((o) => o.r)
    .sort((a, b) => (a.r as { start: { t: number } }).start.t - (b.r as { start: { t: number } }).start.t);
  const order = new Map(byStart.map((o, i) => [o.k, i + 1]));
  return raw.map((r, k) => (r ? { order: order.get(k) as number, ...r } : null));
}

/** One colour per part, while the couple traces — distinct, never the ink. */
export const LOGO_PART_TINTS = ['#C0392B', '#2471A3', '#1E8449', '#7D3C98', '#B9770E', '#117A65', '#BA4A00', '#34495E'] as const;

/** A layer's shapes with each PART in its own colour (`LOGO_PART_TINTS`, in
 *  drawing order — the order `logoParts` finds them). Editor only; never saved. */
export function tintParts(shapes: string): string {
  let k = 0;
  return shapes.replace(/<(path|circle|ellipse|polygon)\b/g, (m) => `${m} style="fill:${LOGO_PART_TINTS[k++ % LOGO_PART_TINTS.length]}"`);
}

/** The writing path the other way round — for a trace drawn from the wrong end. */
export function reversedWrite(write: LogoWritePath): LogoWritePath {
  return { w: write.w, pts: write.pts.slice().reverse() };
}

function cellsOf(samples: Array<{ x: number; y: number; t: number }>, w: number, h: number): Array<{ t: number; d: string }> {
  const m = Math.max(w, h) * 0.05;
  const box: Array<[number, number]> = [
    [-m, -m],
    [w + m, -m],
    [w + m, h + m],
    [-m, h + m],
  ];
  const cells: Array<{ t: number; d: string }> = [];
  samples.forEach((p, i) => {
    // Nearest neighbours first; once a neighbour is more than twice the cell's
    // reach away, its bisector cannot cut the cell and neither can any further.
    const others = samples
      .map((q, j) => ({ q, j, d: Math.hypot(q.x - p.x, q.y - p.y) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d);
    let poly = box;
    for (const o of others) {
      if (o.d < 1e-6) {
        // Two samples on one spot (a pen that paused): the earlier one owns it.
        if (o.j < i) {
          poly = [];
          break;
        }
        continue;
      }
      let reach = 0;
      for (const v of poly) reach = Math.max(reach, Math.hypot(v[0] - p.x, v[1] - p.y));
      if (o.d > 2 * reach) break;
      poly = clipNearer(poly, p, o.q);
      if (poly.length < 3) break;
    }
    if (poly.length >= 3) cells.push({ t: p.t, d: `M${poly.map((v) => `${R(v[0])} ${R(v[1])}`).join('L')}Z` });
  });
  return cells;
}

/** The writing path as SVG path data (a polyline, in the layer's own box). */
export function writePathD(write: LogoWritePath): string {
  return write.pts.map((p, i) => `${i ? 'L' : 'M'}${R(p.x)} ${R(p.y)}`).join('');
}

/** Read a writing path back from its path data (the file's `data-write`). */
export function parseWritePathD(d: string | null | undefined, w: number): LogoWritePath | undefined {
  if (!d) return undefined;
  const pts = [...d.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
  return sanitizeWritePath({ w, pts });
}

/** Its length (the dash that draws it on). */
export function writePathLength(write: LogoWritePath): number {
  let len = 0;
  for (let i = 1; i < write.pts.length; i++) {
    const a = write.pts[i - 1] as { x: number; y: number };
    const b = write.pts[i] as { x: number; y: number };
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** The default brush: wide enough to cover a thick stroke of the letter. */
export function defaultWriteWidth(w: number, h: number): number {
  return Math.round(Math.max(w, h) * 0.09);
}

/* 🧈 ONE SHAPE PER PART, GROWING — NEVER A CELL PER ANIMATION (owner
   2026-09-28: *"i see unsmooth effects"*). The first build gave every cell its
   own fade: ~240 animations per part (1,400+ for the owner's C), each
   re-rasterising the mask — a phone dropped frames — and while they faded,
   neighbouring cells sat at different opacities with hairline seams between
   them, so the letter drew in STRIPES. Now the cells the pen has passed are
   ONE path (`revealD`): abutting polygons of one path share their edges, so
   there is no seam to see, and the player changes one `d` per part per frame.
   The pen's tip is soft (`LOGO_WRITE_FEATHER`): the next few cells show faintly
   ahead of it, so the front glides instead of stepping. */

/** How far ahead of the pen (0 … 1 of the path) the soft tip reaches. */
export const LOGO_WRITE_FEATHER = 0.035;

/** The cells from progress `from` (exclusive) to `to` (inclusive), as ONE path.
 *  `cells` are in pen order, as `writeRevealCells`/`writeRevealPlan` give them. */
export function revealD(cells: ReadonlyArray<{ t: number; d: string }>, from: number, to: number): string {
  let out = '';
  for (const c of cells) {
    if (c.t > to) break;
    if (c.t > from) out += c.d;
  }
  return out;
}

/** The reveal at progress `p`: the solid part the pen has passed, and the two
 *  fainter bands of its soft tip ahead of it. */
export function revealLayersAt(cells: ReadonlyArray<{ t: number; d: string }>, p: number): { solid: string; near: string; far: string } {
  const f = LOGO_WRITE_FEATHER;
  if (p >= 1) return { solid: revealD(cells, -1, 2), near: '', far: '' };
  if (p <= 0) return { solid: '', near: '', far: '' };
  return { solid: revealD(cells, -1, p), near: revealD(cells, p, p + f / 2), far: revealD(cells, p + f / 2, p + f) };
}

/** The soft tip's two bands, as opacity. */
export const LOGO_WRITE_TIP_OPACITY = { near: 0.5, far: 0.2 } as const;

/**
 * THE REVEAL WHEN THE PEN IS `p` OF THE WAY ALONG (0 … 1) — the same one path
 * (and soft tip) the player draws at that moment. Tests render this at a fixed
 * `p` to prove the letter appears in the order it was written, and that
 * nothing is left for the end.
 */
export function writeMaskMarkup(id: string, l: Pick<LogoLayer, 'w' | 'h'> & { write: LogoWritePath }, p: number): string {
  const r = revealLayersAt(writeRevealCells(l.write, l.w, l.h), p);
  const band = (d: string, o: number) => (d ? `<path d="${d}" fill="#FFFFFF" fill-opacity="${o}"/>` : '');
  return (
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="${R(-l.w)}" y="${R(-l.h)}" width="${R(l.w * 3)}" height="${R(l.h * 3)}">` +
    band(r.solid, 1) +
    band(r.near, LOGO_WRITE_TIP_OPACITY.near) +
    band(r.far, LOGO_WRITE_TIP_OPACITY.far) +
    `</mask>`
  );
}

/** Frame units → a point in the layer's own box (inverse of `layerTransform`). */
export function frameToLayer(l: Pick<LogoLayer, 'w' | 'h' | 'x' | 'y' | 'scale'>, fx: number, fy: number): { x: number; y: number } {
  const k = fitFactor(l.w, l.h) * l.scale;
  return { x: (fx - l.x) / k + l.w / 2, y: (fy - l.y) / k + l.h / 2 };
}
/** A point in the layer's own box → frame units (`layerTransform`). */
export function layerToFrame(l: Pick<LogoLayer, 'w' | 'h' | 'x' | 'y' | 'scale'>, lx: number, ly: number): { x: number; y: number } {
  const k = fitFactor(l.w, l.h) * l.scale;
  return { x: (lx - l.w / 2) * k + l.x, y: (ly - l.h / 2) * k + l.y };
}

/** A short random id for a new layer. */
export function newLayerId(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)];
  return s;
}

/* ── placement: fit, rails, snapping ──────────────────────────────────────── */

/** The factor that makes a `w × h` box fit the frame. */
export function fitFactor(w: number, h: number): number {
  return LOGO_FRAME / Math.max(1, w, h);
}

/** Half the layer's drawn width/height in frame units. */
export function halfExtent(layer: Pick<LogoLayer, 'w' | 'h' | 'scale'>): { hx: number; hy: number } {
  const k = fitFactor(layer.w, layer.h) * layer.scale;
  return { hx: (layer.w * k) / 2, hy: (layer.h * k) / 2 };
}

/** RAILS: the centre moves only as far as keeps the whole layer inside the
 *  frame (a layer wider than the frame stays centred on that axis). */
export function clampToFrame(layer: Pick<LogoLayer, 'w' | 'h' | 'scale'>, x: number, y: number): { x: number; y: number } {
  const { hx, hy } = halfExtent(layer);
  const c = LOGO_FRAME / 2;
  const cx = hx >= c ? c : Math.min(LOGO_FRAME - hx, Math.max(hx, x));
  const cy = hy >= c ? c : Math.min(LOGO_FRAME - hy, Math.max(hy, y));
  return { x: Math.round(cx), y: Math.round(cy) };
}

/** How close (frame units) a move must come to a guide to snap onto it. */
export const LOGO_SNAP = 16;

/** Snap the centre onto the frame's centre lines, and the layer's edges onto
 *  the frame's edges, then keep it on the rails. */
export function snapInFrame(layer: Pick<LogoLayer, 'w' | 'h' | 'scale'>, x: number, y: number): { x: number; y: number } {
  const { hx, hy } = halfExtent(layer);
  const c = LOGO_FRAME / 2;
  const snap1 = (v: number, h: number) => {
    const guides = [c, h, LOGO_FRAME - h];
    for (const g of guides) if (Math.abs(v - g) <= LOGO_SNAP) return g;
    return v;
  };
  return clampToFrame(layer, snap1(x, hx), snap1(y, hy));
}

/** How close (a share of the slider's range) a DRAG must come to the middle of
 *  the Across / Up and down sliders to land on it (owner 2026-09-28, of those
 *  two sliders: *"allow snap to center here"*). */
export const LOGO_SLIDER_SNAP = 0.03;

/** A dragged slider value, snapped onto the exact centre of its range when it
 *  comes within `band` of it — the true centre (500 of 0 … 1000), never 498.
 *  Outside the band the value is the couple's own, unchanged. The arrow keys
 *  never call this: a step from the keyboard moves freely. */
export function snapSliderToCentre(v: number, min: number, max: number, band: number = LOGO_SLIDER_SNAP): number {
  const mid = (min + max) / 2;
  return Math.abs(v - mid) <= (max - min) * band ? mid : v;
}

/* ── the stack ─────────────────────────────────────────────────────────────── */

/** Move one layer up (towards the top of the stack) or down. */
/** Move one layer to a place in the stack (0 = bottom) — the carousel's drag. Out of range = unchanged. */
export function moveLayerTo<T extends { id: string }>(layers: T[], id: string, to: number): T[] {
  const i = layers.findIndex((l) => l.id === id);
  if (i < 0 || to < 0 || to >= layers.length || to === i) return layers;
  const next = layers.slice();
  const [m] = next.splice(i, 1);
  next.splice(to, 0, m as T);
  return next;
}

export function moveLayer<T extends { id: string }>(layers: T[], id: string, dir: 'up' | 'down'): T[] {
  const i = layers.findIndex((l) => l.id === id);
  const j = dir === 'up' ? i + 1 : i - 1;
  if (i < 0 || j < 0 || j >= layers.length) return layers;
  const next = layers.slice();
  [next[i], next[j]] = [next[j] as T, next[i] as T];
  return next;
}

/* ── frames, drawn ─────────────────────────────────────────────────────────── */

const R = (v: number) => Math.round(v * 10) / 10;
function circle(cx: number, cy: number, r: number): string {
  return `M${R(cx - r)} ${R(cy)}a${R(r)} ${R(r)} 0 1 0 ${R(2 * r)} 0a${R(r)} ${R(r)} 0 1 0 ${R(-2 * r)} 0Z`;
}
function band(outer: string, inner: string): string {
  return `<path fill-rule="evenodd" d="${outer}${inner}"/>`;
}
function diamondPath(c: number, r: number): string {
  return `M${R(c)} ${R(c - r)}L${R(c + r)} ${R(c)}L${R(c)} ${R(c + r)}L${R(c - r)} ${R(c)}Z`;
}
/** An arch: straight sides and floor, a half circle for its top. */
function archPath(x0: number, y0: number, x1: number, y1: number): string {
  const r = (x1 - x0) / 2;
  return `M${R(x0)} ${R(y1)}L${R(x0)} ${R(y0 + r)}A${R(r)} ${R(r)} 0 0 1 ${R(x1)} ${R(y0 + r)}L${R(x1)} ${R(y1)}Z`;
}
/** A stadium (rounded ends top and bottom). */
function stadiumPath(x0: number, y0: number, x1: number, y1: number): string {
  const r = (x1 - x0) / 2;
  return `M${R(x0)} ${R(y1 - r)}L${R(x0)} ${R(y0 + r)}A${R(r)} ${R(r)} 0 0 1 ${R(x1)} ${R(y0 + r)}L${R(x1)} ${R(y1 - r)}A${R(r)} ${R(r)} 0 0 1 ${R(x0)} ${R(y1 - r)}Z`;
}

/** The frame's shapes in a `LOGO_FRAME` square (pure paths, evenodd bands). */
export function frameBody(kind: LogoFrameKind): { body: string; w: number; h: number } {
  const S = LOGO_FRAME;
  const c = S / 2;
  const t = 22; // band thickness
  let body: string;
  switch (kind) {
    case 'ring':
      body = band(circle(c, c, 480), circle(c, c, 480 - t));
      break;
    case 'double-ring':
      body = band(circle(c, c, 480), circle(c, c, 480 - t)) + band(circle(c, c, 440), circle(c, c, 440 - t / 2));
      break;
    case 'open-ring': {
      // A ring with its foot left open (60° gap at the bottom).
      const ro = 480;
      const ri = ro - t;
      const a0 = (120 * Math.PI) / 180;
      const a1 = (60 * Math.PI) / 180;
      const p = (r: number, a: number) => `${R(c + r * Math.cos(a))} ${R(c + r * Math.sin(a))}`;
      body = `<path d="M${p(ro, a0)}A${ro} ${ro} 0 1 1 ${p(ro, a1)}L${p(ri, a1)}A${ri} ${ri} 0 1 0 ${p(ri, a0)}Z"/>`;
      break;
    }
    case 'diamond':
      body = band(diamondPath(c, 490), diamondPath(c, 490 - t * 1.41));
      break;
    case 'arch':
      body = band(archPath(170, 30, 830, 970), archPath(170 + t, 30 + t, 830 - t, 970 - t));
      break;
    case 'cartouche':
      body = band(stadiumPath(230, 20, 770, 980), stadiumPath(230 + t, 20 + t, 770 - t, 980 - t));
      break;
    case 'scallop': {
      // A ring whose outer edge is 24 little arcs.
      const n = 24;
      const ro = 470;
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const b = ((i + 1) / n) * Math.PI * 2;
        const x0 = c + ro * Math.cos(a);
        const y0 = c + ro * Math.sin(a);
        const x1 = c + ro * Math.cos(b);
        const y1 = c + ro * Math.sin(b);
        const br = (ro * Math.PI) / n;
        d += `${i === 0 ? `M${R(x0)} ${R(y0)}` : ''}A${R(br)} ${R(br)} 0 0 1 ${R(x1)} ${R(y1)}`;
      }
      body = band(`${d}Z`, circle(c, c, ro - t * 1.5));
      break;
    }
  }
  return { body, w: S, h: S };
}

/* ── composing the file every surface shows ───────────────────────────────── */

/** Replace every fill in a body with one colour (text, frames, a recoloured
 *  image). Fills that were there are kept in `data-of` so the image's own
 *  colours come back when the couple switches the recolour off. */
export function recolourBody(body: string, color: string): string {
  return body
    .replace(/\sfill="([^"]*)"/g, (_m, f: string) => ` fill="${color}" data-of="${f}"`)
    .replace(/<path(?![^>]*\sfill=)/g, `<path fill="${color}"`);
}
/** Undo `recolourBody` — the image's own colours again. */
export function originalColours(body: string): string {
  return body.replace(/\sfill="[^"]*" data-of="([^"]*)"/g, ' fill="$1"').replace(/<path fill="#[0-9a-fA-F]{6}"(?![^>]*data-of)/g, '<path');
}

/** Where a layer sits in the frame — the SAME transform the editor canvas and
 *  the saved file use, so the editor shows exactly what guests get. */
export function layerTransform(layer: Pick<LogoLayer, 'w' | 'h' | 'x' | 'y' | 'scale'> & { rotate?: number }): string {
  const k = fitFactor(layer.w, layer.h) * layer.scale;
  /* ↻ Turned about its own centre — between the move and the size, so it turns where it stands. */
  const turn = sanitizeRotate(layer.rotate);
  return `translate(${R(layer.x)} ${R(layer.y)})${turn ? ` rotate(${turn})` : ''} scale(${Number(k.toFixed(5))}) translate(${R(-layer.w / 2)} ${R(-layer.h / 2)})`;
}

/** A layer's shapes as drawn: recoloured when it has a colour, on its white
 *  card when an image keeps it. */
export function layerShapes(l: LogoLayer): string {
  const shapes = l.color ? recolourBody(l.body, l.color) : l.body;
  const card = l.kind === 'image' && l.keepWhite ? `<rect width="${R(l.w)}" height="${R(l.h)}" fill="#FFFFFF"/>` : '';
  return card + shapes;
}

/**
 * THE COMPOSED LOGO — one `<g data-logo-layer>` per layer, in stack order
 * (first = bottom). Each carries its motion as data-*, and its shapes inside a
 * `<g data-logo-body="w h">` so `parseLogoSvg` can read them back.
 */
export function composeLogoSvg(layers: LogoLayer[]): string | null {
  const parts: string[] = [];
  for (const l of layers) {
    if (!l.body) continue;
    const inKind = effectiveIn(l);
    const write = inKind === 'draw' && l.write ? ` data-write="${writePathD(l.write)}" data-write-w="${R(l.write.w)}"` : '';
    const dur = typeof l.motion.dur === 'number' ? ` data-dur="${l.motion.dur}"` : '';
    const leave = l.motion.out ? ` data-out="${l.motion.out}"` : '';
    parts.push(
      `<g data-logo-layer="${l.id}" data-kind="${l.kind}" data-in="${inKind}" data-during="${l.motion.during}" data-delay="${l.motion.delay}"${dur}${leave}${write} transform="${layerTransform(l)}">` +
        `<g data-logo-body="${R(l.w)} ${R(l.h)}">${layerShapes(l)}</g></g>`,
    );
  }
  if (!parts.length) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_FRAME} ${LOGO_FRAME}" data-logo="layers">${parts.join('')}</svg>`;
}

/** Does this saved mark carry layers (so it plays each layer's own motion)? */
export function isLayeredLogo(svg: string | null | undefined): boolean {
  return typeof svg === 'string' && svg.includes('data-logo="layers"') && svg.includes('data-logo-layer=');
}

/**
 * 🔒 WHAT THE PLAYER WILL PUT ON A PAGE. A playing logo cannot be a data-URI
 * `<img>` — its layers must be live SVG for each to move — so every surface
 * that plays it (guests, the vendor's client page, the Maker) builds a real
 * tree from a mark that is host-writable through PostgREST (SEC-3). The read
 * gate (`safeMonogramSvg`) is a DENYLIST; this is the ALLOWLIST behind it, so a
 * playing logo never depends on that denylist being complete. The player
 * parses into an inert `<template>` and checks the PARSED tree (the browser's
 * own parse — no parser disagreement), and refuses the whole logo on any miss:
 * the caller then draws the still `<img>`, exactly as before. Reject, never
 * repair — only inert metadata is dropped, and dropping can add nothing.
 */
export const LOGO_PLAYABLE_ELEMENTS: ReadonlySet<string> = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern',
  'symbol', 'marker', 'switch', 'title', 'desc', 'text', 'tspan',
  'filter', 'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite', 'feconvolvematrix',
  'fediffuselighting', 'fedisplacementmap', 'fedistantlight', 'fedropshadow', 'feflood',
  'fefunca', 'fefuncb', 'fefuncg', 'fefuncr', 'fegaussianblur', 'femerge', 'femergenode',
  'femorphology', 'feoffset', 'fepointlight', 'fespecularlighting', 'fespotlight', 'fetile',
  'feturbulence',
]);

/** May the player keep an element with this local name? */
export function logoElementPlayable(localName: string): boolean {
  return LOGO_PLAYABLE_ELEMENTS.has(localName.toLowerCase());
}

/** May the player keep this attribute? Never a handler, never a link, never a
 *  URL that leaves the document (a `url(#grad)` fragment is fine). */
export function logoAttributePlayable(name: string, value: string): boolean {
  const n = name.toLowerCase();
  const local = n.includes(':') ? n.slice(n.lastIndexOf(':') + 1) : n;
  if (local.startsWith('on') || local === 'href' || local === 'src' || local === 'formaction') return false;
  if (/(?:java|vb)script\s*:/i.test(value) || /data\s*:/i.test(value)) return false;
  if (/url\s*\(\s*['"]?\s*(?!#)/i.test(value)) return false;
  return true;
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

/**
 * Read each layer's shapes back out of a composed file, by id. The body is
 * returned as it was before recolouring or the white card.
 */
export function parseLogoSvg(svg: string): Map<string, { body: string; w: number; h: number }> {
  const out = new Map<string, { body: string; w: number; h: number }>();
  if (!isLayeredLogo(svg)) return out;
  const starts: Array<{ id: string; at: number }> = [];
  const re = /<g data-logo-layer="([a-z0-9]{1,16})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) starts.push({ id: m[1] as string, at: m.index });
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? (starts[i + 1] as { at: number }).at : svg.lastIndexOf('</svg>');
    const chunk = svg.slice(s.at, end);
    const bm = /<g data-logo-body="([\d.]+) ([\d.]+)">/.exec(chunk);
    if (!bm) return;
    // The chunk ends "…BODY</g></g>" — the layer's own two closing tags.
    let inner = chunk.slice(bm.index + bm[0].length).replace(/<\/g><\/g>\s*$/, '');
    inner = inner.replace(/^<rect width="[\d.]+" height="[\d.]+" fill="#FFFFFF"\/>/, '');
    out.set(s.id, { body: originalColours(inner), w: Number(bm[1]), h: Number(bm[2]) });
  });
  return out;
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

/**
 * A plain (non-layered) mark as one image layer's shapes — the couple's
 * existing logo opens as a layer of its own, so nothing they had is lost. Its
 * viewBox origin is moved to 0,0 inside the body.
 */
export function svgAsLayerBody(svg: string): { body: string; w: number; h: number } | null {
  const vb = /viewBox\s*=\s*"\s*(-?[\d.]+)\s+(-?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s*"/i.exec(svg);
  if (!vb) return null;
  const [x, y, w, h] = [Number(vb[1]), Number(vb[2]), Number(vb[3]), Number(vb[4])];
  if (!(w > 0 && h > 0)) return null;
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const body = x || y ? `<g transform="translate(${R(-x)} ${R(-y)})">${inner}</g>` : inner;
  return { body, w, h };
}

/** The layers of a saved logo: metadata from the config, shapes from the file.
 *  A layer whose shapes are missing is dropped rather than drawn empty. */
export function layersFromSaved(metas: LogoLayerMeta[], svg: string | null): LogoLayer[] {
  const bodies = svg ? parseLogoSvg(svg) : new Map<string, { body: string; w: number; h: number }>();
  const out: LogoLayer[] = [];
  for (const m of metas) {
    if (m.kind === 'frame') {
      out.push({ ...m, ...frameBody(m.frame ?? 'ring') });
      continue;
    }
    const b = bodies.get(m.id);
    if (b) out.push({ ...m, ...b });
  }
  return out;
}

/** The metadata of a layer (what the config stores). */
export function metaOf(l: LogoLayer): LogoLayerMeta {
  const { body: _b, w: _w, h: _h, autoDelay: _a, ...meta } = l;
  return meta;
}

/** Layers whose delay is still the default follow the stack: bottom first,
 *  each arriving as the one below it finishes. A delay the couple set is theirs. */
export function retimeLayers(layers: LogoLayer[]): LogoLayer[] {
  return layers.map((l, i) =>
    l.autoDelay && l.motion.delay !== defaultMotion(i).delay
      ? { ...l, motion: { ...l.motion, delay: defaultMotion(i).delay } }
      : l,
  );
}

/* ── motion, timed ─────────────────────────────────────────────────────────── */

/** When each layer starts and ends its In, in stack order. */
export function logoTimeline(layers: Array<Pick<LogoLayerMeta, 'id' | 'motion'>>): Array<{ id: string; start: number; end: number }> {
  return layers.map((l) => ({ id: l.id, start: l.motion.delay, end: l.motion.delay + logoInSeconds(l.motion) }));
}
