/**
 * Kwento scrapbook — the page model and its geometry (owner 2026-10-03: "it can
 * compile multiple photos with background and/or lifted subject, to create a
 * cool scrapbook like collage"; option A — unlimited pages, download free, a
 * page saved to the gallery counts like one photo; guests AND the couple).
 *
 * Pure and DOM-free so the rules that decide where a finger lands, what a
 * scatter does and how a cut-out's mask is read are testable without a canvas.
 * The drawing lives in `scrapbook-draw.ts`, the on-device cut-out in
 * `scrapbook-cutout.ts`.
 *
 * Units: a page is PAGE_W page-units wide whatever its pixel size, so the edit
 * stage and the exported JPEG agree exactly (the same fraction trick the
 * single-photo decorator uses, kept in one unit instead of two).
 */

export const PAGE_W = 1000;

export const PAGE_SHAPES = [
  { id: '4:5', name: 'Portrait 4:5', height: 1250 },
  { id: '9:16', name: 'Story 9:16', height: 1778 },
  { id: '1:1', name: 'Square', height: 1000 },
] as const;
export type PageShape = (typeof PAGE_SHAPES)[number]['id'];

export function pageHeight(shape: PageShape): number {
  return PAGE_SHAPES.find((s) => s.id === shape)?.height ?? 1250;
}

export const PAPERS = [
  { id: 'kraft', name: 'Kraft' },
  { id: 'grid', name: 'Grid' },
  { id: 'dots', name: 'Dots' },
  { id: 'linen', name: 'Linen' },
  { id: 'blush', name: 'Blush' },
  { id: 'sage', name: 'Sage' },
  { id: 'night', name: 'Night' },
] as const;
export type PaperId = (typeof PAPERS)[number]['id'];

export const FRAMES = [
  { id: 'polaroid', name: 'Instant print' },
  { id: 'taped', name: 'Taped print' },
  { id: 'torn', name: 'Torn paper' },
  { id: 'stamp', name: 'Postage stamp' },
  { id: 'round', name: 'Round' },
  { id: 'plain', name: 'No frame' },
] as const;
export type FrameId = (typeof FRAMES)[number]['id'];

export const EDGES = [
  { id: 'white', name: 'White edge' },
  { id: 'thin', name: 'Thin edge' },
  { id: 'none', name: 'No edge' },
] as const;
export type EdgeId = (typeof EDGES)[number]['id'];

export const TAPES = [
  { id: 'gold', name: 'Gold', fill: 'rgba(214,178,104,0.78)', pattern: 'plain' },
  { id: 'blush', name: 'Blush', fill: 'rgba(232,170,170,0.75)', pattern: 'dots' },
  { id: 'sage', name: 'Sage', fill: 'rgba(160,184,150,0.78)', pattern: 'stripes' },
  { id: 'sky', name: 'Sky', fill: 'rgba(150,186,214,0.75)', pattern: 'grid' },
  { id: 'lace', name: 'Lace', fill: 'rgba(246,238,220,0.85)', pattern: 'dots' },
  { id: 'ink', name: 'Ink', fill: 'rgba(48,52,62,0.8)', pattern: 'stripes' },
] as const;
export type TapeId = (typeof TAPES)[number]['id'];

/** Only faces the app already ships (`app/layout.tsx`, local files) — no new font downloads. */
export const LETTERINGS = [
  { id: 'script', name: 'Script' },
  { id: 'serif', name: 'Serif' },
  { id: 'calligraphy', name: 'Calligraphy' },
  { id: 'clean', name: 'Clean' },
] as const;
export type LetteringId = (typeof LETTERINGS)[number]['id'];

export const WORD_COLORS = [
  { id: '#2a2622', name: 'Ink' },
  { id: '#ffffff', name: 'White' },
  { id: '#a8432f', name: 'Brick' },
  { id: '#b07a2a', name: 'Gold' },
  { id: '#3f5d4a', name: 'Forest' },
] as const;

export const STICKERS = ['💍', '💐', '🥂', '✨', '❤️', '🤍', '🕊️', '🌸', '🎉', '💌', '📸', '🌙', '⭐', '🫶', '😍', '🥹'] as const;

/** One thing on the page. `src` names a photo or a cut-out by id. */
export type ScrapLayer = {
  id: string;
  kind: 'photo' | 'cut' | 'sticker' | 'words' | 'tape';
  /** Centre, in page units. */
  x: number;
  y: number;
  /** Width in page units; the height follows the drawn tile's shape. */
  w: number;
  /** Degrees. */
  rot: number;
  /** Fixes the torn edges and grain, so a redraw never re-tears the paper. */
  seed: number;
  src?: string;
  frame?: FrameId;
  caption?: string;
  edge?: EdgeId;
  text?: string;
  lettering?: LetteringId;
  color?: string;
  label?: boolean;
  tape?: TapeId;
};

export type ScrapBackground = { kind: 'paper'; paper: PaperId } | { kind: 'photo'; src: string };

export type ScrapPage = {
  shape: PageShape;
  background: ScrapBackground;
  /** 0..0.7 — a cream wash over a photo background. */
  fade: number;
  layers: ScrapLayer[];
};

export const MIN_W = 50;
export const MAX_W = 2400;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Seeded PRNG (mulberry32) — the same seed draws the same torn edge every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The centred crop of a `w × h` source to `aspect` (width / height). */
export function centreCrop(w: number, h: number, aspect: number) {
  let sw = w;
  let sh = h;
  if (sw / sh > aspect) sw = sh * aspect;
  else sh = sw / aspect;
  return { sx: (w - sw) / 2, sy: (h - sh) / 2, sw, sh };
}

type Pt = { x: number; y: number };
/** The drawn width/height (page units) of a layer, as the renderer measured it. */
export type Size = { w: number; h: number };

/** A page-space point in the layer's own, unrotated frame (origin at its centre). */
export function toLocal(l: Pick<ScrapLayer, 'x' | 'y' | 'rot'>, p: Pt): Pt {
  const a = -toRad(l.rot);
  const dx = p.x - l.x;
  const dy = p.y - l.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

/**
 * The TOPMOST layer under the point, or null. Layers paint in array order, so
 * the search runs back to front — the one you can see is the one you get.
 * `slop` widens every box a little: a fingertip is not a cursor.
 */
export function hitTest(
  layers: readonly ScrapLayer[],
  sizeOf: (l: ScrapLayer) => Size | null,
  p: Pt,
  slop = 10,
): ScrapLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    const s = sizeOf(l);
    if (!s) continue;
    const q = toLocal(l, p);
    if (Math.abs(q.x) <= s.w / 2 + slop && Math.abs(q.y) <= s.h / 2 + slop) return l;
  }
  return null;
}

/** Where the turn-and-resize handle sits: the layer's bottom-right corner, rotated. */
export function handlePoint(l: Pick<ScrapLayer, 'x' | 'y' | 'rot'>, s: Size): Pt {
  const a = toRad(l.rot);
  const hx = s.w / 2;
  const hy = s.h / 2;
  return { x: l.x + hx * Math.cos(a) - hy * Math.sin(a), y: l.y + hx * Math.sin(a) + hy * Math.cos(a) };
}

/**
 * The handle (or two fingers) turns and resizes around the layer's centre:
 * the width scales by how far the finger moved from the centre, the angle by
 * how far it swung around it.
 */
export function turnAndResize(
  start: { w: number; rot: number; dist: number; angle: number },
  now: { dist: number; angle: number },
): { w: number; rot: number } {
  return {
    w: clamp((start.w * now.dist) / Math.max(1, start.dist), MIN_W, MAX_W),
    rot: start.rot + ((now.angle - start.angle) * 180) / Math.PI,
  };
}

/**
 * "Scatter the photos" — every PHOTO lands in its own cell of a loose grid with
 * a little tilt, so a pile of pins becomes a page. Stickers, words, tape and
 * cut-outs keep their places and go back on top: they were put somewhere on
 * purpose. Returns a new layer list; the input is untouched.
 */
export function scatterPhotos(
  layers: readonly ScrapLayer[],
  height: number,
  rand: () => number = Math.random,
): ScrapLayer[] {
  const photos = layers.filter((l) => l.kind === 'photo');
  if (photos.length === 0) return layers.slice();
  const n = photos.length;
  const cols = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const order = photos
    .map((l) => ({ l, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map(({ l }) => l);
  const placed = order.map((l, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      ...l,
      x: clamp(PAGE_W * ((c + 0.5) / cols) + (rand() - 0.5) * 70, 0, PAGE_W),
      y: clamp(height * (0.08 + (0.84 * (r + 0.5)) / rows) + (rand() - 0.5) * 60, 0, height),
      w: (PAGE_W / cols) * (0.78 + rand() * 0.2),
      rot: (rand() - 0.5) * 16,
    };
  });
  return [...placed, ...layers.filter((l) => l.kind !== 'photo')];
}

/** Moving the page between shapes keeps every layer at the same height FRACTION. */
export function reshape(page: ScrapPage, shape: PageShape): ScrapPage {
  const k = pageHeight(shape) / pageHeight(page.shape);
  return { ...page, shape, layers: page.layers.map((l) => ({ ...l, y: l.y * k })) };
}

// ── The cut-out's mask (read here so the rule is testable) ───────────────────

/** A confidence mask, row-major, values ~0..1, with its size. */
export type Mask = { data: Float32Array; w: number; h: number };

/**
 * The segmenter answers with one or more confidence masks and does not say
 * which one is "the thing you tapped". So ask the masks: the right one is the
 * one most confident AT THE TAP. A single mask that is NOT confident there is
 * the background's — flip it.
 */
export function pickMaskAt(masks: readonly Float32Array[], w: number, h: number, at: Pt): Float32Array {
  if (masks.length === 0) throw new Error('no mask returned');
  const ix = Math.min(w - 1, Math.max(0, Math.round(at.x * (w - 1))));
  const iy = Math.min(h - 1, Math.max(0, Math.round(at.y * (h - 1))));
  const idx = iy * w + ix;
  let best = masks[0]!;
  let bestV = -Infinity;
  for (const m of masks) {
    const v = m[idx] ?? 0;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  const out = new Float32Array(best);
  if (bestV < 0.5 && masks.length === 1) for (let i = 0; i < out.length; i++) out[i] = 1 - out[i]!;
  return out;
}

/** Several taps make one cut-out: the union keeps each pixel's highest confidence. */
export function unionMasks(masks: readonly Float32Array[]): Float32Array | null {
  if (masks.length === 0) return null;
  const u = new Float32Array(masks[0]!.length);
  for (const m of masks) for (let i = 0; i < u.length; i++) if (m[i]! > u[i]!) u[i] = m[i]!;
  return u;
}

/** Soft edge: below 0.3 is gone, above 0.7 is kept, smooth in between. */
export function edgeAlpha(v: number): number {
  const t = clamp((v - 0.3) / 0.4, 0, 1);
  return t * t * (3 - 2 * t);
}

/** The bounding box of the kept pixels (confidence > 0.5), or null when nothing was kept. */
export function maskBounds(m: Mask): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = m.w;
  let y0 = m.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (m.data[y * m.w + x]! > 0.5) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * A finger that moved is a SCRIBBLE (a line down someone's body), one that
 * barely moved is a TAP. The segmenter takes at most a few dozen scribble
 * points, so a long drag is thinned evenly.
 */
export function readGesture(
  path: readonly Pt[],
  pxW: number,
  pxH: number,
): { kind: 'tap'; at: Pt } | { kind: 'scribble'; points: Pt[] } {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += Math.hypot((path[i]!.x - path[i - 1]!.x) * pxW, (path[i]!.y - path[i - 1]!.y) * pxH);
  }
  if (path.length <= 2 || len <= 24) return { kind: 'tap', at: path[0] ?? { x: 0.5, y: 0.5 } };
  const step = Math.ceil(path.length / 30);
  return { kind: 'scribble', points: path.filter((_, i) => i % step === 0) };
}
