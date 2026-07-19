/**
 * lib/monogram-studio/trace.ts
 *
 * Dependency-free raster → vector tracer for the "upload your own mark" flow
 * (owner 2026-07-17: "upload your own png/svg/eps file and we will decypher it
 * and create elements of each item and help them animate it").
 *
 * Pipeline: alpha (or luminance, for opaque scans) threshold → connected-
 * component labeling → marching-squares contour extraction → segment chaining
 * into closed loops → RDP simplification → one evenodd compound <path> PER
 * COMPONENT, coloured by the component's average pixel colour.
 *
 * "Elements of each item": every connected piece of the artwork becomes its
 * own <path>, so Bloom / Petal Fall / Handwriting / the Medallion animate the
 * uploaded mark piece-by-piece exactly like a studio-built one. Deterministic,
 * no dependencies, no server round-trip.
 */

type Pt = { x: number; y: number };

const MAX_TRACE_EDGE = 560; // trace resolution cap — quality/size balance
const MIN_COMPONENT_FRAC = 0.0006; // drop specks below 0.06% of the canvas
const RDP_EPSILON = 1.35; // px — smooths the pixel staircase without mush
const MAX_COMPONENTS = 40;

/** Ramer–Douglas–Peucker polyline simplification (closed loops welcome). */
function rdp(points: Pt[], eps: number): Pt[] {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const seg = stack.pop() as [number, number];
    const a = seg[0],
      b = seg[1];
    const pa = points[a] as Pt,
      pb = points[b] as Pt;
    let maxD = 0,
      idx = -1;
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i] as Pt;
      const d = Math.abs((p.x - pa.x) * dy - (p.y - pa.y) * dx) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i] as Pt);
  return out;
}

/**
 * Trace a binary ink mask into closed loops via marching squares + chaining.
 * Grid is (W+1)×(H+1) lattice points; each loop is a list of lattice points.
 */
function traceLoops(ink: Uint8Array, W: number, H: number): Pt[][] {
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
  const loops: Pt[][] = [];
  const un = (k: number): Pt => ({ x: (k % S) / 2 - 1, y: Math.floor(k / S) / 2 - 1 });
  while (segs.size) {
    const first = segs.keys().next().value as number;
    const loop: Pt[] = [];
    let cur: number | undefined = first;
    let guard = segs.size + 4;
    while (cur !== undefined && guard-- > 0) {
      loop.push(un(cur));
      const nxt: number | undefined = segs.get(cur);
      segs.delete(cur);
      cur = nxt;
      if (cur === first) break;
    }
    if (loop.length >= 6) loops.push(loop);
  }
  return loops;
}

export type TraceResult = { svg: string; elements: number };

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
  const data = ctx.getImageData(0, 0, W, H).data;

  // transparency present? → alpha mask; else luminance mask (scanned art)
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if ((data[i] as number) < 250) transparent++;
  const useAlpha = transparent > W * H * 0.02;
  const ink = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (useAlpha) {
      ink[p] = (data[i + 3] as number) > 128 ? 1 : 0;
    } else {
      const lum = 0.2126 * (data[i] as number) + 0.7152 * (data[i + 1] as number) + 0.0722 * (data[i + 2] as number);
      ink[p] = lum < 200 ? 1 : 0;
    }
  }

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
  const loops = traceLoops(ink, W, H);
  if (!loops.length) return null;
  const byComp = new Map<number, Pt[][]>();
  loops.forEach((loop) => {
    const m = loop[Math.floor(loop.length / 2)] as Pt;
    // probe the 4 pixels around the loop point for an ink label
    let id = -1;
    for (const [dx2, dy2] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ] as [number, number][]) {
      const px = Math.round(m.x) + dx2,
        py = Math.round(m.y) + dy2;
      if (px >= 0 && py >= 0 && px < W && py < H && ink[py * W + px]) {
        id = label[py * W + px] as number;
        break;
      }
    }
    if (id < 0) return;
    const arr = byComp.get(id) ?? [];
    arr.push(loop);
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
    const d = compLoops
      .map((loop) => {
        const pts = rdp(loop, RDP_EPSILON);
        if (pts.length < 3) return '';
        const R2 = (v: number) => Math.round(v * 10) / 10;
        return (
          'M' +
          pts.map((q) => `${R2(q.x)} ${R2(q.y)}`).join('L') +
          'Z'
        );
      })
      .filter(Boolean)
      .join('');
    if (d) paths.push(`<path d="${d}" fill="${col}" fill-rule="evenodd"/>`);
  });
  if (!paths.length) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><g data-mlayer="letters">${paths.join('')}</g></svg>`;
  return { svg, elements: paths.length };
}
