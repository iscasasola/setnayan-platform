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

import { STUDIO_FONT_KEYS, type StudioFontKey } from './monogram-studio-fonts';

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
   loops to the left goes up makes the c and ends with a curl"*). Not a wipe,
   and not the outline being stroked (the studio's Handwriting): the couple
   traces the letter ONCE, in writing order ("Show how it's written"), and that
   centreline — the layer's WRITING PATH, the engine's `strokes` shape `{ w, pts }`
   — becomes a thick mask drawn along its length, revealing the real letterform
   in the order it was written. A layer with no writing path cannot Draw on; it
   Fades (`effectiveIn`). */
export const LOGO_IN = ['draw', 'rise', 'fade', 'none'] as const;
export type LogoIn = (typeof LOGO_IN)[number];
export const LOGO_IN_LABEL: Record<LogoIn, string> = { draw: 'Draw on', rise: 'Rise', fade: 'Fade', none: 'None' };
export const LOGO_DURING = ['still', 'drift'] as const;
export type LogoDuring = (typeof LOGO_DURING)[number];
export const LOGO_DURING_LABEL: Record<LogoDuring, string> = { still: 'Still', drift: 'Drift' };
export const LOGO_DELAY_MAX = 4;
export const LOGO_DELAY_STEP = 0.1;
/** How long one layer's In takes, in seconds. */
export const LOGO_IN_SECONDS: Record<LogoIn, number> = { draw: 2, rise: 0.9, fade: 0.8, none: 0 };

export type LogoMotion = { in: LogoIn; during: LogoDuring; delay: number };

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
  /** A hex, or null = the image's own colours (text/frame always carry one). */
  color: string | null;
  motion: LogoMotion;
  /** Text: the words, and the face they are set in. */
  text?: string;
  font?: StudioFontKey;
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
  return {
    in: pick(o.in, LOGO_IN, dflt.in),
    during: pick(o.during, LOGO_DURING, dflt.during),
    delay: Number((Math.round(delay / LOGO_DELAY_STEP) * LOGO_DELAY_STEP).toFixed(1)),
  };
}

/** A traced writing path: finite points (at least two), bounded, rounded. */
export function sanitizeWritePath(raw: unknown): LogoWritePath | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.pts)) return undefined;
  const pts: Array<{ x: number; y: number }> = [];
  for (const p of o.pts.slice(0, LOGO_WRITE_MAX_PTS)) {
    const q = (p ?? {}) as Record<string, unknown>;
    if (typeof q.x !== 'number' || typeof q.y !== 'number' || !Number.isFinite(q.x) || !Number.isFinite(q.y)) continue;
    pts.push({ x: Math.round(clampNum(q.x, -5000, 5000, 0) * 10) / 10, y: Math.round(clampNum(q.y, -5000, 5000, 0) * 10) / 10 });
  }
  if (pts.length < 2) return undefined;
  return { w: Math.round(clampNum(o.w, 1, 2000, 60) * 10) / 10, pts };
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
      color: kind === 'image' ? color : (color ?? LOGO_DEFAULT_INK),
      motion: sanitizeLogoMotion(o.motion),
    };
    if (kind === 'text') {
      layer.text = plain(o.text, MAX_TEXT);
      layer.font = pick(o.font, STUDIO_FONT_KEYS, 'cardo');
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
 *  I, then the C, and the I comes in first and the C after it. It Fades until
 *  the couple shows how it is written; then it can Draw on. */
export function defaultMotion(indexInStack: number): LogoMotion {
  const delay = Math.min(LOGO_DELAY_MAX, Math.max(0, indexInStack) * LOGO_IN_SECONDS.draw);
  return { in: 'fade', during: 'still', delay: Number(delay.toFixed(1)) };
}

/** What a layer actually plays: Draw on needs a writing path, else it Fades. */
export function effectiveIn(l: Pick<LogoLayerMeta, 'write'> & { motion: Pick<LogoMotion, 'in'> }): LogoIn {
  return l.motion.in === 'draw' && !(l.write && l.write.pts.length >= 2) ? 'fade' : l.motion.in;
}

/* ── the writing path ─────────────────────────────────────────────────────── */

/** The writing path as SVG path data (a polyline, in the layer's own box). */
export function writePathD(write: LogoWritePath): string {
  return write.pts.map((p, i) => `${i ? 'L' : 'M'}${R(p.x)} ${R(p.y)}`).join('');
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

/**
 * THE REVEAL AT PROGRESS `p` (0 … 1) — a mask that shows the layer only under
 * the first `p` of its writing path, drawn with the brush. The player animates
 * exactly this (`stroke-dashoffset` from the length to 0); tests render it at a
 * fixed `p` to prove the letter appears in the order it was written.
 */
export function writeMaskMarkup(id: string, l: Pick<LogoLayer, 'w' | 'h'> & { write: LogoWritePath }, p: number): string {
  const len = writePathLength(l.write);
  const off = len * (1 - Math.min(1, Math.max(0, p)));
  return (
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="${R(-l.w)}" y="${R(-l.h)}" width="${R(l.w * 3)}" height="${R(l.h * 3)}">` +
    `<path d="${writePathD(l.write)}" fill="none" stroke="#FFFFFF" stroke-width="${R(l.write.w)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${R(len + 1)} ${R(len + 1)}" stroke-dashoffset="${R(off)}"/>` +
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

/* ── the stack ─────────────────────────────────────────────────────────────── */

/** Move one layer up (towards the top of the stack) or down. */
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
export function layerTransform(layer: Pick<LogoLayer, 'w' | 'h' | 'x' | 'y' | 'scale'>): string {
  const k = fitFactor(layer.w, layer.h) * layer.scale;
  return `translate(${R(layer.x)} ${R(layer.y)}) scale(${Number(k.toFixed(5))}) translate(${R(-layer.w / 2)} ${R(-layer.h / 2)})`;
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
    parts.push(
      `<g data-logo-layer="${l.id}" data-kind="${l.kind}" data-in="${inKind}" data-during="${l.motion.during}" data-delay="${l.motion.delay}"${write} transform="${layerTransform(l)}">` +
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
  return layers.map((l) => ({ id: l.id, start: l.motion.delay, end: l.motion.delay + LOGO_IN_SECONDS[l.motion.in] }));
}
