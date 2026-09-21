/**
 * lib/monogram-studio/trace.test.ts — "clean" as a MEASUREMENT.
 *
 * Owner 2026-09-20: *"the refinement of the svg from the photo uploaded is not
 * clean. make the curves and the corners clean and the straight lines."*
 *
 * "Clean" is only testable against shapes whose TRUE geometry is known. So each
 * case rasterizes a known shape with sharp (anti-aliased, exactly like a real
 * image), traces it, and checks the result against the truth:
 *
 *   · a square must come back as FOUR straight lines and NO curves, its corners
 *     where the corners are, its edges exactly axis-aligned;
 *   · a rotated square must stay four straight lines meeting at right angles —
 *     straightness is not the same thing as axis-alignment;
 *   · a circle must come back as a FEW curves, never lines, every sampled point
 *     within a fraction of a pixel of the true radius;
 *   · a shape mixing lines and curves must keep both;
 *   · a NOISY photo of a circle (opaque, luminance mode) must still be a circle.
 *
 * Tolerances are in trace pixels. The old tracer emitted `L` segments only, so
 * every "must contain no L / must contain C" assertion below fails against it by
 * construction — which is the point: the representation was the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { traceRgbaToSvg } from './trace';

type Pt = { x: number; y: number };
type Seg = { kind: 'L'; from: Pt; to: Pt } | { kind: 'C'; from: Pt; c1: Pt; c2: Pt; to: Pt };

async function rgba(svg: string, W: number, H: number): Promise<Uint8Array> {
  const { data } = await sharp(Buffer.from(svg)).resize(W, H).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/** The path d of every <path> in the traced svg. */
function pathDs(svg: string): string[] {
  return [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1] as string);
}

/** Split a d string into closed loops of segments. Only M/L/C/Z are emitted. */
function loops(d: string): Seg[][] {
  const out: Seg[][] = [];
  const toks = d.match(/[MLCZ]|-?\d+(?:\.\d+)?/g) ?? [];
  let i = 0;
  let cur: Pt = { x: 0, y: 0 };
  let start: Pt = { x: 0, y: 0 };
  let loop: Seg[] = [];
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    const t = toks[i++];
    if (t === 'M') {
      cur = { x: num(), y: num() };
      start = cur;
      loop = [];
    } else if (t === 'L') {
      const to = { x: num(), y: num() };
      loop.push({ kind: 'L', from: cur, to });
      cur = to;
    } else if (t === 'C') {
      const c1 = { x: num(), y: num() };
      const c2 = { x: num(), y: num() };
      const to = { x: num(), y: num() };
      loop.push({ kind: 'C', from: cur, c1, c2, to });
      cur = to;
    } else if (t === 'Z') {
      if (Math.hypot(cur.x - start.x, cur.y - start.y) > 1e-6) loop.push({ kind: 'L', from: cur, to: start });
      out.push(loop);
    }
  }
  return out;
}

function sample(s: Seg, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    if (s.kind === 'L') {
      out.push({ x: s.from.x + u * (s.to.x - s.from.x), y: s.from.y + u * (s.to.y - s.from.y) });
    } else {
      const a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3;
      out.push({
        x: a * s.from.x + b * s.c1.x + c * s.c2.x + d * s.to.x,
        y: a * s.from.y + b * s.c1.y + c * s.c2.y + d * s.to.y,
      });
    }
  }
  return out;
}

const SVG = (W: number, H: number, body: string, bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${body}</svg>`;

test('a square comes back as FOUR straight lines, no curves, sharp corners, axis-aligned', async () => {
  const W = 400;
  const out = traceRgbaToSvg(await rgba(SVG(W, W, '<rect x="100" y="100" width="200" height="200" fill="#111"/>'), W, W), W, W);
  assert.ok(out, 'something must be traced');
  const ds = pathDs(out.svg);
  assert.equal(ds.length, 1, 'one piece');
  const [loop] = loops(ds[0] as string);
  const ls = (loop as Seg[]).filter((s) => s.kind === 'L');
  const cs = (loop as Seg[]).filter((s) => s.kind === 'C');
  assert.equal(cs.length, 0, `a square has NO curves — found ${cs.length}`);
  assert.equal(ls.length, 4, `a square has FOUR edges — found ${ls.length}`);

  // Every corner within half a pixel of the true corner.
  const truth = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }];
  for (const s of ls) {
    const near = Math.min(...truth.map((c) => Math.hypot(c.x - s.to.x, c.y - s.to.y)));
    assert.ok(near <= 0.5, `corner (${s.to.x}, ${s.to.y}) is ${near.toFixed(2)}px from a true corner`);
  }
  // Every edge EXACTLY horizontal or vertical — snapped, not 0.3° off.
  for (const s of ls) {
    const dx = Math.abs(s.to.x - s.from.x);
    const dy = Math.abs(s.to.y - s.from.y);
    assert.ok(Math.min(dx, dy) < 1e-9, `edge (${s.from.x},${s.from.y})→(${s.to.x},${s.to.y}) is not axis-aligned`);
  }
});

test('a ROTATED square stays four straight lines meeting at right angles', async () => {
  const W = 400;
  const body = '<rect x="120" y="120" width="160" height="160" fill="#111" transform="rotate(20 200 200)"/>';
  const out = traceRgbaToSvg(await rgba(SVG(W, W, body), W, W), W, W);
  assert.ok(out);
  const [loop] = loops(pathDs(out.svg)[0] as string);
  const segs = loop as Seg[];
  assert.equal(segs.filter((s) => s.kind === 'C').length, 0, 'a rotated square still has no curves');
  assert.equal(segs.length, 4, `four edges — found ${segs.length}`);
  // Straight is not the same as axis-aligned: these must NOT have been snapped.
  for (let i = 0; i < 4; i++) {
    const a = segs[i] as Seg;
    const b = segs[(i + 1) % 4] as Seg;
    const va = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
    const vb = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
    const cos = (va.x * vb.x + va.y * vb.y) / (Math.hypot(va.x, va.y) * Math.hypot(vb.x, vb.y));
    const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    assert.ok(Math.abs(deg - 90) < 2, `corner ${i} turns ${deg.toFixed(2)}°, not 90°`);
  }
});

test('a circle comes back as a FEW curves, no lines, within half a pixel of the true radius', async () => {
  const W = 400;
  const r = 120;
  const out = traceRgbaToSvg(await rgba(SVG(W, W, `<circle cx="200" cy="200" r="${r}" fill="#111"/>`), W, W), W, W);
  assert.ok(out);
  const [loop] = loops(pathDs(out.svg)[0] as string);
  const segs = loop as Seg[];
  assert.equal(segs.filter((s) => s.kind === 'L').length, 0, 'a circle has no straight lines');
  const cs = segs.filter((s) => s.kind === 'C');
  assert.ok(cs.length >= 2 && cs.length <= 12, `a circle should be a handful of curves, got ${cs.length}`);
  let worst = 0;
  for (const s of cs) for (const p of sample(s)) worst = Math.max(worst, Math.abs(Math.hypot(p.x - 200, p.y - 200) - r));
  assert.ok(worst < 0.5, `worst radial error ${worst.toFixed(3)}px`);
});

test('lines and curves together: a stadium keeps its straights straight and its ends round', async () => {
  const W = 480;
  // Two horizontal straights joined by two semicircles.
  const body = '<rect x="100" y="160" width="280" height="160" rx="80" ry="80" fill="#111"/>';
  const out = traceRgbaToSvg(await rgba(SVG(W, W, body), W, W), W, W);
  assert.ok(out);
  const segs = loops(pathDs(out.svg)[0] as string)[0] as Seg[];
  const ls = segs.filter((s) => s.kind === 'L');
  assert.ok(segs.some((s) => s.kind === 'C'), 'the round ends must be curves');
  // The two long straights must survive as exact horizontal lines at y=160/320.
  const horizontals = ls.filter((s) => Math.abs(s.to.y - s.from.y) < 1e-9 && Math.abs(s.to.x - s.from.x) > 100);
  assert.equal(horizontals.length, 2, `expected 2 long exact horizontals, got ${horizontals.length}`);
  for (const h of horizontals) {
    const y = h.from.y;
    assert.ok(Math.abs(y - 160) < 0.5 || Math.abs(y - 320) < 0.5, `straight at y=${y}, expected 160 or 320`);
  }
});

test('a NOISY PHOTO of a circle (opaque, dark ink on paper) is still a clean circle', async () => {
  const W = 400;
  const r = 110;
  const base = await rgba(SVG(W, W, `<circle cx="200" cy="200" r="${r}" fill="#1a1a1a"/>`, `<rect width="${W}" height="${W}" fill="#f4f1ea"/>`), W, W);
  // Deterministic sensor-like noise, ±18 levels — what made the old outline shiver.
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < base.length; i += 4) {
    for (let c = 0; c < 3; c++) base[i + c] = Math.max(0, Math.min(255, (base[i + c] as number) + Math.round(rnd() * 18)));
    base[i + 3] = 255; // opaque → luminance mode
  }
  const out = traceRgbaToSvg(base, W, W);
  assert.ok(out);
  const ds = pathDs(out.svg);
  assert.equal(ds.length, 1, `noise must not become specks: ${ds.length} pieces`);
  const segs = loops(ds[0] as string)[0] as Seg[];
  const cs = segs.filter((s) => s.kind === 'C');
  assert.ok(cs.length >= 2 && cs.length <= 16, `a noisy circle should still be a handful of curves, got ${cs.length}`);
  let worst = 0;
  for (const s of segs) for (const p of sample(s)) worst = Math.max(worst, Math.abs(Math.hypot(p.x - 200, p.y - 200) - r));
  assert.ok(worst < 1.2, `worst radial error under noise ${worst.toFixed(3)}px`);
});

test('separate pieces stay separate — each is its own animatable element', async () => {
  const W = 400;
  const body = '<rect x="40" y="40" width="120" height="120" fill="#111"/><circle cx="280" cy="280" r="70" fill="#111"/>';
  const out = traceRgbaToSvg(await rgba(SVG(W, W, body), W, W), W, W);
  assert.ok(out);
  assert.equal(out.elements, 2, 'two pieces → two elements');
  assert.equal(pathDs(out.svg).length, 2);
});

test('a PHOTO is not fattened — the edge sits midway between paper and ink', async () => {
  /* The tracer used to draw a photo's edge where darkness crossed a fixed
   * "luminance 200" — near the PAPER, not the edge — so every letter came out a
   * fraction of a pixel fat. Measured on a noisy photo of a Didone "IC": 0.9px
   * average error before the threshold was taken from the image (Otsu), 0.12px
   * after. A square's edges show the bias directly: they must sit where the
   * square is, not outside it. */
  const W = 400;
  const base = await rgba(
    SVG(W, W, '<rect x="100" y="100" width="200" height="200" fill="#1a1a1a"/>', `<rect width="${W}" height="${W}" fill="#f3efe6"/>`),
    W,
    W,
  );
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < base.length; i += 4) {
    for (let c = 0; c < 3; c++) base[i + c] = Math.max(0, Math.min(255, (base[i + c] as number) + Math.round(rnd() * 18)));
    base[i + 3] = 255;
  }
  const out = traceRgbaToSvg(base, W, W);
  assert.ok(out);
  const segs = loops(pathDs(out.svg)[0] as string)[0] as Seg[];
  assert.equal(segs.filter((s) => s.kind === 'C').length, 0, 'a photographed square still has no curves');
  const xs = segs.flatMap((s) => [s.from.x, s.to.x]);
  const ys = segs.flatMap((s) => [s.from.y, s.to.y]);
  const bounds = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const truth = [100, 300, 100, 300];
  bounds.forEach((v, i) =>
    assert.ok(Math.abs(v - (truth[i] as number)) <= 0.4, `edge ${i} at ${v.toFixed(2)}, true edge ${truth[i]} — the photo was fattened`),
  );
});
