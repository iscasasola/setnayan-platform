/**
 * lib/monogram-studio/trace.ts
 *
 * Dependency-free raster → vector tracer for the "upload your own mark" flow
 * (owner 2026-07-17: "upload your own png/svg/eps file and we will decypher it
 * and create elements of each item and help them animate it").
 *
 * Pipeline: a CONTINUOUS ink field (alpha, or darkness for opaque scans),
 * lightly blurred → threshold for TOPOLOGY only (connected components +
 * marching squares) → each boundary point placed BETWEEN pixels where the
 * field crosses the threshold → trace-fit.ts turns each loop into exact lines,
 * real Bézier curves and sharp corners → one evenodd compound <path> PER
 * COMPONENT, coloured by the component's average pixel colour.
 *
 * ── REBUILT 2026-09-20 ────────────────────────────────────────────────────
 * Owner, on a logo traced from a photo: *"the refinement of the svg from the
 * photo uploaded is not clean. make the curves and the corners clean and the
 * straight lines."* The previous version could not have been tuned into that:
 *   · it made every pixel 0 or 1, discarding the anti-aliasing that says where
 *     an edge really runs between two pixels;
 *   · it put every boundary point on a pixel-edge MIDPOINT, so a smooth
 *     diagonal became a staircase;
 *   · it simplified with RDP, which keeps the staircase corners as vertices;
 *   · and it emitted straight `L` segments only — not one curve in the file.
 * Each of those is gone. The binary mask survives only to decide WHICH pixels
 * are ink; WHERE the boundary lies now comes from the field.
 *
 * "Elements of each item": every connected piece of the artwork becomes its
 * own <path>, so Bloom / Petal Fall / Handwriting / the Medallion animate the
 * uploaded mark piece-by-piece exactly like a studio-built one. Deterministic,
 * no dependencies, no server round-trip.
 */

import { fitLoop, type Pt } from './trace-fit';

/** Trace resolution CAP (never an upscale). Raised from 560: at 560 a
 *  photographed logo's thin serifs were a pixel or two wide, and no fitting can
 *  recover a shape the grid could not hold. */
const MAX_TRACE_EDGE = 1024;
const MIN_COMPONENT_FRAC = 0.0006; // drop specks below 0.06% of the canvas
const MAX_COMPONENTS = 40;

/**
 * Trace a binary ink mask into closed loops via marching squares + chaining.
 * Grid is (W+1)×(H+1) lattice points; each loop is a list of lattice points.
 */
function traceLoops(ink: Uint8Array, W: number, H: number): { keys: number[][]; stride: number } {
  // segments keyed by their start lattice point → end lattice point.
  // Lattice coords are DOUBLED (edge midpoints live on half-integers), so the
  // key stride must cover 0..2W+3 — a stride of W+2 collides distinct points
  // and merges loops (the "3 pieces traced as 1" bug).
  const S = 2 * (W + 2);
  const segs = new Map<number, number>();
  const key = (x: number, y: number) => y * S + x;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : (ink[y * W + x] as number));
  for (let y = -1; y < H; y++) {
    for (let x = -1; x < W; x++) {
      const tl = at(x, y),
        tr = at(x + 1, y),
        bl = at(x, y + 1),
        br = at(x + 1, y + 1);
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (c === 0 || c === 15) continue;
      // edge midpoints of the 2×2 cell, in lattice coords (cell corner = x+1,y+1)
      const T = key(2 * (x + 1) + 1, 2 * (y + 1)); // top edge
      const R = key(2 * (x + 1) + 2, 2 * (y + 1) + 1); // right
      const B = key(2 * (x + 1) + 1, 2 * (y + 1) + 2); // bottom
      const L = key(2 * (x + 1), 2 * (y + 1) + 1); // left
      // directed segments keeping ink on the LEFT of travel
      const add = (a: number, b: number) => segs.set(a, b);
      switch (c) {
        case 1: add(B, L); break;
        case 2: add(R, B); break;
        case 3: add(R, L); break;
        case 4: add(T, R); break;
        case 5: add(T, L); add(B, R); break; // ambiguous — resolve as separate
        case 6: add(T, B); break;
        case 7: add(T, L); break;
        case 8: add(L, T); break;
        case 9: add(B, T); break;
        case 10: add(L, B); add(R, T); break; // ambiguous
        case 11: add(R, T); break;
        case 12: add(L, R); break;
        case 13: add(B, R); break;
        case 14: add(L, B); break;
      }
    }
  }
  const loops: number[][] = [];
  while (segs.size) {
    const first = segs.keys().next().value as number;
    const loop: number[] = [];
    let cur: number | undefined = first;
    let guard = segs.size + 4;
    while (cur !== undefined && guard-- > 0) {
      loop.push(cur);
      const nxt: number | undefined = segs.get(cur);
      segs.delete(cur);
      cur = nxt;
      if (cur === first) break;
    }
    if (loop.length >= 6) loops.push(loop);
  }
  return { keys: loops, stride: S };
}

/**
 * The two pixels a marching-squares boundary key sits between.
 *
 * Keys are on a DOUBLED lattice (edge midpoints are half-integers): an odd X
 * with an even Y is the edge between horizontal neighbours (x,y)–(x+1,y); an
 * even X with an odd Y is between vertical neighbours (x,y)–(x,y+1).
 */
function keyPixels(key: number, S: number): [number, number, number, number] {
  const X = key % S;
  const Y = Math.floor(key / S);
  if (X % 2 === 1) {
    const x = (X - 3) / 2;
    const y = Y / 2 - 1;
    return [x, y, x + 1, y];
  }
  const x = X / 2 - 1;
  const y = (Y - 3) / 2;
  return [x, y, x, y + 1];
}

export type TraceResult = { svg: string; elements: number };

/** The level that separates paper from ink on a [0,1] field: Otsu to find the
 *  two populations, then the midpoint between their averages. */
function otsu(field: Float32Array): number {
  const bins = 256;
  const hist = new Float64Array(bins);
  for (let i = 0; i < field.length; i++) {
    const b = Math.min(bins - 1, Math.max(0, Math.round((field[i] as number) * (bins - 1))));
    hist[b] = (hist[b] ?? 0) + 1;
  }
  const total = field.length;
  let sumAll = 0;
  for (let i = 0; i < bins; i++) sumAll += i * (hist[i] as number);
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestT = 128;
  for (let t = 0; t < bins; t++) {
    wB += hist[t] as number;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * (hist[t] as number);
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  /* ⚠ OTSU ALONE IS NOT ENOUGH FOR CLEAN PRINT. With paper and ink two clean,
   * well-separated populations, the between-class score is FLAT across the
   * whole gap between them, and taking the first maximum picks the value just
   * above the paper — which put every edge half a pixel out into the paper
   * (measured: a photographed 200px square came back 201px wide, all four edges
   * out by 0.5px). So Otsu only seeds it; the isodata refinement then settles
   * on the MIDPOINT between the two class averages, which is where a blurred
   * edge between paper and ink actually is. */
  let T = (bestT + 0.5) / (bins - 1);
  for (let it = 0; it < 12; it++) {
    let lo = 0;
    let nLo = 0;
    let hi = 0;
    let nHi = 0;
    for (let i = 0; i < field.length; i++) {
      const v = field[i] as number;
      if (v < T) {
        lo += v;
        nLo++;
      } else {
        hi += v;
        nHi++;
      }
    }
    if (!nLo || !nHi) break;
    const next = (lo / nLo + hi / nHi) / 2;
    if (Math.abs(next - T) < 1e-4) {
      T = next;
      break;
    }
    T = next;
  }
  return T;
}

/**
 * Trace an image into a pure-paths SVG. Uses the alpha channel when the image
 * has transparency; otherwise a luminance threshold (dark ink on light paper).
 * Returns null when nothing traceable is found.
 */
export function traceImageToSvg(img: CanvasImageSource, srcW: number, srcH: number): TraceResult | null {
  const scale = Math.min(1, MAX_TRACE_EDGE / Math.max(srcW, srcH));
  const W = Math.max(8, Math.round(srcW * scale));
  const H = Math.max(8, Math.round(srcH * scale));
  const cnv = document.createElement('canvas');
  cnv.width = W;
  cnv.height = H;
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  return traceRgbaToSvg(ctx.getImageData(0, 0, W, H).data, W, H);
}

/**
 * The tracer itself, on raw RGBA. DOM-free so node tests can run it against
 * rasterized shapes whose true geometry is known — which is the only honest way
 * to say "clean": a square must come back with four straight edges and four
 * sharp corners, a circle as a handful of curves within a fraction of a pixel.
 */
export function traceRgbaToSvg(data: Uint8ClampedArray | Uint8Array, W: number, H: number): TraceResult | null {
  // transparency present? → alpha field; else darkness field (scanned art)
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if ((data[i] as number) < 250) transparent++;
  const useAlpha = transparent > W * H * 0.02;

  /* The CONTINUOUS ink field in [0,1]. Kept, not thresholded away: an
   * anti-aliased edge pixel at 0.3 says the true edge runs 0.2 px past its
   * centre, and that is the information that makes a boundary smooth. */
  const raw = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (useAlpha) {
      raw[p] = (data[i + 3] as number) / 255;
    } else {
      const lum = 0.2126 * (data[i] as number) + 0.7152 * (data[i + 1] as number) + 0.0722 * (data[i + 2] as number);
      raw[p] = (255 - lum) / 255;
    }
  }
  /* A light 3×3 binomial blur. A photographed logo carries sensor noise and
   * paper grain along every edge — that is what made the old outline shiver.
   * The blur is symmetric, so a straight edge stays exactly where it was; it
   * only rounds corners, and trace-fit rebuilds those as line intersections. */
  const field = new Float32Array(W * H);
  const f = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : (raw[y * W + x] as number));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      field[y * W + x] =
        (f(x - 1, y - 1) + 2 * f(x, y - 1) + f(x + 1, y - 1) +
          2 * f(x - 1, y) + 4 * f(x, y) + 2 * f(x + 1, y) +
          f(x - 1, y + 1) + 2 * f(x, y + 1) + f(x + 1, y + 1)) /
        16;
    }
  }
  /* WHERE THE EDGE IS.
   *
   * Transparent art: halfway up the alpha ramp (0.5), as before.
   *
   * A PHOTO of print: halfway between the PAPER and the INK, found from the
   * image itself (Otsu's method) — not the fixed "luminance < 200" this used
   * to apply. 200 sits near the paper, so every boundary was drawn a fraction
   * of a pixel out into the paper and every letter came out fattened. Measured
   * on a noisy photo of a Didone "IC": the fixed threshold left the outline
   * 0.9px off on average; the midpoint is where the edge actually is. Clamped
   * so a pathological image (almost all ink, or blank) cannot pick something
   * absurd. */
  const iso = useAlpha ? 128 / 255 : Math.min(185 / 255, Math.max(40 / 255, otsu(field)));
  const ink = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) ink[p] = (field[p] as number) > iso ? 1 : 0;
  const fieldAt = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : (field[y * W + x] as number));

  // connected components (4-neighbour BFS)
  const label = new Int32Array(W * H).fill(-1);
  const comps: { area: number; r: number; g: number; b: number; minX: number }[] = [];
  const qx = new Int32Array(W * H);
  const qy = new Int32Array(W * H);
  for (let y0 = 0; y0 < H; y0++) {
    for (let x0 = 0; x0 < W; x0++) {
      const p0 = y0 * W + x0;
      if (!ink[p0] || label[p0] !== -1) continue;
      const id = comps.length;
      const comp = { area: 0, r: 0, g: 0, b: 0, minX: x0 };
      let head = 0,
        tail = 0;
      qx[tail] = x0;
      qy[tail++] = y0;
      label[p0] = id;
      while (head < tail) {
        const x = qx[head] as number,
          y = qy[head] as number;
        head++;
        const p = y * W + x;
        comp.area++;
        const i4 = p * 4;
        comp.r += data[i4] as number;
        comp.g += data[i4 + 1] as number;
        comp.b += data[i4 + 2] as number;
        if (x < comp.minX) comp.minX = x;
        const nb: [number, number][] = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const np = ny * W + nx;
          if (ink[np] && label[np] === -1) {
            label[np] = id;
            qx[tail] = nx;
            qy[tail++] = ny;
          }
        }
      }
      comps.push(comp);
    }
  }
  if (!comps.length) return null;

  // trace ALL loops once, then assign each loop to the component whose ink it borders
  const { keys: loopKeys, stride } = traceLoops(ink, W, H);
  if (!loopKeys.length) return null;
  const byComp = new Map<number, Pt[][]>();
  loopKeys.forEach((keys) => {
    /* Which piece does this outline belong to? Every boundary key sits between
     * one ink pixel and one non-ink pixel, so the key ITSELF names the piece —
     * no probing around a guessed midpoint. */
    const [ax, ay, bx, by] = keyPixels(keys[0] as number, stride);
    const aInk = ax >= 0 && ay >= 0 && ax < W && ay < H && ink[ay * W + ax];
    const px = aInk ? ax : bx;
    const py = aInk ? ay : by;
    if (px < 0 || py < 0 || px >= W || py >= H || !ink[py * W + px]) return;
    const id = label[py * W + px] as number;
    if (id < 0) return;

    /* Each point placed where the field actually crosses the threshold along
     * its edge — linear interpolation between the two pixel centres, which sit
     * at (x+0.5, y+0.5). The old tracer put every point on the edge MIDPOINT
     * and also sat pixel centres on integers, half a pixel off. */
    const pts: Pt[] = keys.map((k) => {
      const [x0, y0, x1, y1] = keyPixels(k, stride);
      const fa = fieldAt(x0, y0);
      const fb = fieldAt(x1, y1);
      let t = fb !== fa ? (iso - fa) / (fb - fa) : 0.5;
      t = Math.min(0.999, Math.max(0.001, t));
      return { x: x0 + 0.5 + t * (x1 - x0), y: y0 + 0.5 + t * (y1 - y0) };
    });
    const arr = byComp.get(id) ?? [];
    arr.push(pts);
    byComp.set(id, arr);
  });

  const minArea = W * H * MIN_COMPONENT_FRAC;
  const paths: string[] = [];
  const kept = [...byComp.entries()]
    .filter(([id]) => (comps[id] as { area: number }).area >= minArea)
    .sort((a2, b2) => (comps[b2[0]] as { area: number }).area - (comps[a2[0]] as { area: number }).area)
    .slice(0, MAX_COMPONENTS);
  kept.forEach(([id, compLoops]) => {
    const c = comps[id] as { area: number; r: number; g: number; b: number };
    const col = `rgb(${Math.round(c.r / c.area)},${Math.round(c.g / c.area)},${Math.round(c.b / c.area)})`;
    const d = compLoops.map((loop) => fitLoop(loop)).filter(Boolean).join('');
    if (d) paths.push(`<path d="${d}" fill="${col}" fill-rule="evenodd"/>`);
  });
  if (!paths.length) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><g data-mlayer="letters">${paths.join('')}</g></svg>`;
  return { svg, elements: paths.length };
}
