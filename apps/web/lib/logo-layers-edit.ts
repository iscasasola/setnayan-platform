/**
 * 🅻 THE LOGO EDITOR'S HALF OF THE LAYER MODEL — everything only the Maker's Logo
 * page (`launch/_components/maker-logo.tsx`) and the tests use: the editor's
 * labels and inks, placement (rails, snapping, the stack), the frames drawn, and
 * composing / reading back the saved file.
 *
 * MOVED OUT OF `lib/logo-layers.ts` (2026-10-10), code unchanged. That file is
 * on the Maker's FIRST load (`couple-logo-plays`, `monogram-studio-shared` and
 * `monogram-svg-safe` need only the sanitiser, `logoHasMotion` and
 * `centreLogoOnItsInk`); this half is lazy-only, so it must never be imported
 * from a first-load module — it travels with `maker-logo`'s own chunk.
 */

import {
  defaultMotion,
  LOGO_DELAY_MAX,
  LOGO_DEFAULT_INK,
  LOGO_FRAME,
  LOGO_MAX_LAYERS,
  LOGO_SCALE_MAX,
  LOGO_SCALE_MIN,
  type LogoDuring,
  type LogoFrameKind,
  type LogoIn,
  type LogoLayer,
  type LogoLayerKind,
  type LogoLayerMeta,
  type LogoMotion,
  type LogoOut,
  type LogoWritePath,
  R,
  sanitizeRotate,
} from './logo-layers';
import { LOGO_WRITE_CELLS, penAlong, resampleWrite } from './logo-layers-player';


/** What each kind of layer is called (L5 moved it here from the first-load `logo-layers.ts`; it equals
 *  `logoKindName`, which a guard holds). */
export const LOGO_LAYER_KIND_LABEL: Record<LogoLayerKind, string> = { image: 'Image', text: 'Text', frame: 'Frame', ornament: 'Ornament' };

export const LOGO_IN_LABEL: Record<LogoIn, string> = { draw: 'Draw on', rise: 'Rise', fade: 'Fade', none: 'None' };
export const LOGO_DURING_LABEL: Record<LogoDuring, string> = { still: 'Still', drift: 'Drift' };
export const LOGO_OUT_LABEL: Record<LogoOut, string> = { none: 'None', fade: 'Fade', sink: 'Sink' };
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

/** What a layer actually plays. Draw on always plays now — along the writing
 *  path when there is one, along the letter's own outline when there is not. */
export function effectiveIn(l: { motion: Pick<LogoMotion, 'in'> }): LogoIn {
  return l.motion.in;
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

/** The writing path as SVG path data (a polyline, in the layer's own box). */
export function writePathD(write: LogoWritePath): string {
  return write.pts.map((p, i) => `${i ? 'L' : 'M'}${R(p.x)} ${R(p.y)}`).join('');
}

/** The default brush: wide enough to cover a thick stroke of the letter. */
export function defaultWriteWidth(w: number, h: number): number {
  return Math.round(Math.max(w, h) * 0.09);
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

/** Move one layer to a place in the stack (0 = bottom) — the layer carousel's hold-and-drag (L2). Out of range = unchanged. */
export function moveLayerTo<T extends { id: string }>(layers: T[], id: string, to: number): T[] {
  const i = layers.findIndex((l) => l.id === id);
  if (i < 0 || to < 0 || to >= layers.length || to === i) return layers;
  const next = layers.slice();
  const [m] = next.splice(i, 1);
  next.splice(to, 0, m as T);
  return next;
}

/** How far a copy sits from its original, in frame units — down and right, so both stay seen. */
export const LOGO_COPY_OFFSET = 40;

/**
 * ⧉ DUPLICATE (L2, the card's ⋯): the layer again, named "<name> copy", a little down and right (on the rails),
 * placed straight ABOVE its original. Shown and free even when the original was hidden or locked — the copy is the one
 * being worked on. Unchanged when the logo is full (`LOGO_MAX_LAYERS`) or the id is not there.
 */
export function duplicateLayer(layers: LogoLayer[], id: string, newId: string): LogoLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  const o = layers[i];
  if (!o || layers.length >= LOGO_MAX_LAYERS) return layers;
  const { hidden: _h, locked: _l, ...rest } = o;
  const at = clampToFrame(o, o.x + LOGO_COPY_OFFSET, o.y + LOGO_COPY_OFFSET);
  const copy: LogoLayer = { ...rest, id: newId, name: `${o.name} copy`.slice(0, 40), ...at };
  const next = layers.slice();
  next.splice(i + 1, 0, copy);
  return next;
}

/** One letter of a word, as the face sets it: its shapes in its own box, and its box's middle in the WORD's box. */
export type LogoGlyphCut = { ch: string; body: string; w: number; h: number; cx: number; cy: number };

/** How far each letter's start follows the one before it, in seconds (the prototype's Split: a quarter second). */
export const LOGO_SPLIT_STEP = 0.25;

/**
 * ✂ SPLIT INTO LETTERS (L4; owner 2026-09-27 *"each letter gets its own animation"*): one text layer becomes one
 * layer per letter (spaces dropped), each EXACTLY where and as big as it stood in the word — its middle mapped from the
 * word's box into the frame (turned with the word), its scale such that its own box draws at the word's size — in the
 * word's face, colour, look and motion, each starting a step after the one before (`LOGO_SPLIT_STEP`, a delay the
 * couple now owns). Unchanged when it is not a text layer, has fewer than two letters, or would pass `LOGO_MAX_LAYERS`.
 */
export function splitIntoLetters(
  layers: LogoLayer[],
  id: string,
  word: { w: number; h: number },
  cuts: readonly LogoGlyphCut[],
  newId: () => string,
): LogoLayer[] {
  const i = layers.findIndex((l) => l.id === id);
  const o = layers[i];
  const letters = cuts.filter((c) => c.ch.trim() && c.body);
  if (!o || o.kind !== 'text' || letters.length < 2 || layers.length - 1 + letters.length > LOGO_MAX_LAYERS) return layers;
  const k = fitFactor(word.w, word.h) * o.scale;
  const turn = ((o.rotate ?? 0) * Math.PI) / 180;
  const made = letters.map((c, n): LogoLayer => {
    const dx = (c.cx - word.w / 2) * k;
    const dy = (c.cy - word.h / 2) * k;
    const scale = Number(Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, k / fitFactor(c.w, c.h))).toFixed(4));
    const { spacing: _s, write: _w, ...rest } = o;
    return {
      ...rest,
      id: newId(),
      name: c.ch,
      text: c.ch,
      body: c.body,
      w: c.w,
      h: c.h,
      scale,
      x: Math.round(o.x + dx * Math.cos(turn) - dy * Math.sin(turn)),
      y: Math.round(o.y + dx * Math.sin(turn) + dy * Math.cos(turn)),
      motion: { ...o.motion, delay: Number(Math.min(LOGO_DELAY_MAX, o.motion.delay + n * LOGO_SPLIT_STEP).toFixed(1)) },
      autoDelay: false,
    };
  });
  const next = layers.slice();
  next.splice(i, 1, ...made);
  return next;
}

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

/* ── looks (L4: Solid · Outline · Shadow — a text layer's) ─────────────────── */

export const LOGO_LOOKS = ['solid', 'outline', 'shadow'] as const;
export type LogoLook = (typeof LOGO_LOOKS)[number];
export const LOGO_LOOK_LABEL: Record<LogoLook, string> = { solid: 'Solid', outline: 'Outline', shadow: 'Shadow' };
/** The shadow's ink — the prototype's soft gold (`--gold-soft`), a hard offset copy behind the letters, never a blur. */
export const LOGO_SHADOW_INK = '#E6D8BE';

const OUTLINE_ATTRS = (color: string, w: number) => ` fill="none" stroke="${color}" stroke-width="${R(w)}" stroke-linejoin="round" data-look-outline=""`;
const OUTLINE_RE = / fill="none" stroke="#[0-9a-fA-F]{6}" stroke-width="[\d.]+" stroke-linejoin="round" data-look-outline=""/g;
const SHADOW_RE = /^<g data-look-shadow="" transform="[^"]*">[\s\S]*?<\/g>/;

/** A layer's shapes as drawn: recoloured when it has a colour, on its white
 *  card when an image keeps it; a text layer in its look — OUTLINE = the letters'
 *  edges only (a stroke, no fill), SHADOW = a soft offset copy behind them. Pure
 *  paths and a group, so every surface (the player, print, the ink box) draws it. */
export function layerShapes(l: LogoLayer): string {
  const look = l.kind === 'text' ? l.look : undefined;
  const ink = l.color ?? LOGO_DEFAULT_INK;
  const shapes =
    look === 'outline'
      ? l.body.replace(/<path\b/g, `<path${OUTLINE_ATTRS(ink, Math.max(2, l.h * 0.03))}`)
      : l.color
        ? recolourBody(l.body, l.color)
        : l.body;
  const off = R(Math.max(2, l.h * 0.05));
  const shadow = look === 'shadow' ? `<g data-look-shadow="" transform="translate(${off} ${off})">${recolourBody(l.body, LOGO_SHADOW_INK)}</g>` : '';
  const card = l.kind === 'image' && l.keepWhite ? `<rect width="${R(l.w)}" height="${R(l.h)}" fill="#FFFFFF"/>` : '';
  return card + shadow + shapes;
}

/**
 * THE COMPOSED LOGO — one `<g data-logo-layer>` per layer, in stack order
 * (first = bottom). Each carries its motion as data-*, and its shapes inside a
 * `<g data-logo-body="w h">` so `parseLogoSvg` can read them back.
 */
export function composeLogoSvg(layers: LogoLayer[]): string | null {
  const parts: string[] = [];
  /* 🙈 HIDDEN (L3): off the logo on every surface — kept in a leading `<defs>`, which nothing draws (print-mark
     reads defs as non-rendered; the player and the ink box read `data-logo-layer` only), so its shapes survive a
     reload and Show brings it back exactly. */
  const kept: string[] = [];
  for (const l of layers) {
    if (!l.body) continue;
    if (l.hidden) {
      kept.push(`<g data-logo-hidden-layer="${l.id}" data-kind="${l.kind}"><g data-logo-body="${R(l.w)} ${R(l.h)}">${layerShapes(l)}</g></g>`);
      continue;
    }
    const inKind = effectiveIn(l);
    const write = inKind === 'draw' && l.write ? ` data-write="${writePathD(l.write)}" data-write-w="${R(l.write.w)}"` : '';
    const dur = typeof l.motion.dur === 'number' ? ` data-dur="${l.motion.dur}"` : '';
    const leave = l.motion.out ? ` data-out="${l.motion.out}"` : '';
    /* 🔒 A lock is part of the file, so locking alone is a change the save gate sees. */
    const lock = l.locked ? ' data-locked=""' : '';
    parts.push(
      `<g data-logo-layer="${l.id}" data-kind="${l.kind}" data-in="${inKind}" data-during="${l.motion.during}" data-delay="${l.motion.delay}"${dur}${leave}${write}${lock} transform="${layerTransform(l)}">` +
        `<g data-logo-body="${R(l.w)} ${R(l.h)}">${layerShapes(l)}</g></g>`,
    );
  }
  if (!parts.length && !kept.length) return null;
  const hidden = kept.length ? `<defs data-logo-hidden="">${kept.join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_FRAME} ${LOGO_FRAME}" data-logo="layers">${hidden}${parts.join('')}</svg>`;
}

/**
 * Read each layer's shapes back out of a composed file, by id. The body is
 * returned as it was before recolouring or the white card.
 */
export function parseLogoSvg(svg: string): Map<string, { body: string; w: number; h: number }> {
  const out = new Map<string, { body: string; w: number; h: number }>();
  /* Not `isLayeredLogo`: a logo whose every layer is hidden draws nothing, and still holds its layers. */
  if (!svg.includes('data-logo="layers"')) return out;
  const starts: Array<{ id: string; at: number }> = [];
  const re = /<g data-logo-(?:hidden-)?layer="([a-z0-9]{1,16})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) starts.push({ id: m[1] as string, at: m.index });
  const defsEnd = svg.indexOf('</defs>');
  starts.forEach((s, i) => {
    const next = i + 1 < starts.length ? (starts[i + 1] as { at: number }).at : svg.lastIndexOf('</svg>');
    // A hidden layer ends at the close of the defs that keep it.
    const end = defsEnd > s.at && defsEnd < next ? defsEnd : next;
    const chunk = svg.slice(s.at, end);
    const bm = /<g data-logo-body="([\d.]+) ([\d.]+)">/.exec(chunk);
    if (!bm) return;
    // The chunk ends "…BODY</g></g>" — the layer's own two closing tags.
    let inner = chunk.slice(bm.index + bm[0].length).replace(/<\/g><\/g>\s*$/, '');
    inner = inner.replace(/^<rect width="[\d.]+" height="[\d.]+" fill="#FFFFFF"\/>/, '');
    // A text layer's look comes off: the shadow's copy, the outline's stroke.
    inner = inner.replace(SHADOW_RE, '').replace(OUTLINE_RE, '');
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
