/**
 * ▶ THE LOGO PLAYER'S HALF OF THE LAYER MODEL — everything only
 * `app/_components/layered-logo-player.tsx` (and the tests, and the editor half
 * for the pen's passages) uses: the Out timings, the pen's progress, the writing
 * path's cells and reveal plan, the soft tip, and the allowlist of what the
 * player may put on a page.
 *
 * MOVED OUT OF `lib/logo-layers.ts` (2026-10-10), code unchanged. That file is
 * on the Maker's FIRST load (`couple-logo-plays`, `monogram-studio-shared` and
 * `monogram-svg-safe` need only the sanitiser, `logoHasMotion` and
 * `centreLogoOnItsInk`); this half is lazy-only, so it must never be imported
 * from a first-load module — it travels with the player's own chunk.
 */

import {
  type LogoLayer,
  type LogoWritePath,
  R,
  sanitizeWritePath,
} from './logo-layers';

/** How long the finished logo rests before a layer goes Out, and how long it takes. */
export const LOGO_OUT_HOLD_SECONDS = 1.2;
export const LOGO_OUT_SECONDS = 0.8;

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
export function resampleWrite(write: LogoWritePath, samples: number): Array<{ x: number; y: number; t: number }> {
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
export function penAlong<T extends { t: number }>(samples: T[], on: (x: number, y: number) => boolean): T[] {
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
