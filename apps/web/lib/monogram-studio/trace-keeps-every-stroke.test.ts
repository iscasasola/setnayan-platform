/**
 * lib/monogram-studio/trace-keeps-every-stroke.test.ts
 *
 * Owner 2026-09-27, on his own monogram uploaded into the Event Hub Maker's
 * Logo editor: *"the image is incomplete fix this"*. A 2000px black-on-white
 * script "C" came back with one stroke simply gone.
 *
 * Measured on his file (never committed — it is his brand art): the bar
 * between the C's bowl and a crossing gap was its own piece, 0.05% of the
 * canvas, and the tracer's flat "anything under 0.06% is a speck" rule deleted
 * it — 100% of that stroke missing. Building this fixture found two more ways
 * a stroke vanished: a lone 2px swash is tiny in AREA and was dropped the same
 * way, and a thin STRAIGHT stroke traced to a zero-width path (trace-fit.ts,
 * "HAIRPIN"). And the old 1024px cap halved every hairline before tracing, so
 * thin strokes came back fattened (IoU 94.5% on this fixture at 1024).
 *
 * So this is a FIDELITY test, not a geometry one (trace.test.ts owns "clean"):
 * a synthetic 2000×2000 two-tone mark — one bold stroke, five hairlines 2–6px
 * wide, a short stroke fragment cut off by a crossing gap, and a dot — is traced
 * exactly as the browser would (resampled to traceSize, then the real tracer),
 * drawn back at 2000px, and compared pixel for pixel with the original.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { traceRgbaToSvg, traceSize } from './trace';

const N = 2000;
const BG = `<rect width="${N}" height="${N}" fill="#fff"/>`;
const svgDoc = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${N}" height="${N}" viewBox="0 0 ${N} ${N}">${BG}${body}</svg>`;
const stroke = (d: string, w: number) =>
  `<path d="${d}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round"/>`;

/** Each hairline on its own, so its survival can be measured on its own. */
const HAIRLINES: { name: string; body: string }[] = [
  { name: '3px sweeping top loop', body: stroke('M 150 150 C 600 40 1400 40 1850 170', 3) },
  /* Far from every other stroke and tiny in AREA (≈0.03% of the canvas) — it
   * survives only because it is drawn as a line, not because of a neighbour. */
  { name: '2px lone swash, far from everything', body: stroke('M 300 400 C 500 300 700 500 900 300', 2) },
  { name: '4px straight diagonal', body: stroke('M 150 1880 L 880 1120', 4) },
  {
    name: '5px oval swash',
    body: '<ellipse cx="1450" cy="1400" rx="380" ry="220" fill="none" stroke="#000" stroke-width="5"/>',
  },
  { name: '6px S-curve tail', body: stroke('M 150 900 C 350 700 600 1100 850 950', 6) },
];
/** The bold down-stroke, and the short bar a crossing gap cut off beside it:
 *  120×14px ≈ 0.04% of the canvas — under the old flat speck floor. */
const BOLD = stroke('M 1000 230 L 1000 800', 60);
const FRAGMENT = { name: 'stroke fragment beside a crossing gap', body: stroke('M 1052 500 L 1165 500', 14) };
/** A DOT beside the down-stroke (an "i"'s dot, a full stop): compact, not a line,
 *  and ≈0.01% of the canvas — kept ONLY because it sits beside the drawing. */
const DOT = { name: 'dot beside a stroke', body: '<circle cx="1057" cy="700" r="12" fill="#000"/>' };

async function grey(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).flatten({ background: '#fff' }).greyscale().raw().toBuffer();
}
const inkOf = (g: Buffer) => {
  const m = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) m[i] = (g[i] as number) < 128 ? 1 : 0;
  return m;
};
function dilate(m: Uint8Array, r: number): Uint8Array {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!m[y * N + x]) continue;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N) o[ny * N + nx] = 1;
        }
    }
  return o;
}

test('an uploaded two-tone mark keeps EVERY stroke — hairlines and crossing fragments included', async () => {
  const all = [...HAIRLINES, FRAGMENT, DOT];
  const source = svgDoc(BOLD + all.map((h) => h.body).join(''));

  // Resample exactly as traceImageToSvg does (canvas drawImage → traceSize).
  const { W, H } = traceSize(N, N);
  const { data } = await sharp(Buffer.from(source))
    .flatten({ background: '#fff' })
    .resize(W, H, { kernel: 'linear' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = traceRgbaToSvg(new Uint8Array(data), W, H);
  assert.ok(out, 'the mark must trace');

  const drawnBack = inkOf(await grey(out.svg.replace('<svg ', `<svg width="${N}" height="${N}" `)));
  const truth = inkOf(await grey(source));

  // 1 — every stroke survives on its own (1px tolerance for where an edge lands).
  const near = dilate(drawnBack, 1);
  for (const h of all) {
    const own = inkOf(await grey(svgDoc(h.body)));
    let n = 0;
    let hit = 0;
    for (let i = 0; i < own.length; i++) {
      if (!own[i]) continue;
      n++;
      if (near[i]) hit++;
    }
    const kept = hit / n;
    assert.ok(kept >= 0.98, `${h.name}: only ${(kept * 100).toFixed(1)}% of it came back (${n}px of ink)`);
  }

  // 2 — and the whole mark, pixel for pixel.
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < truth.length; i++) {
    if (truth[i] && drawnBack[i]) inter++;
    if (truth[i] || drawnBack[i]) uni++;
  }
  const iou = inter / uni;
  assert.ok(iou >= 0.97, `ink IoU ${(iou * 100).toFixed(2)}% — the traced mark is not the uploaded one`);

  // 3 — and it is still pieces, not one blob: bold + fragment + dot + 5 hairlines.
  assert.equal(out.elements, 8, `expected 8 separate pieces, got ${out.elements}`);
});

test('dust far from the drawing is still dropped — keeping fragments did not keep specks', async () => {
  /* Specks are what the speck rule is FOR: a photo's paper grain and dust. The
   * fix keeps small pieces that sit beside the artwork; a small piece far from
   * every stroke must still go. */
  const dust = [
    [1800, 1850],
    [120, 1300],
    [1700, 320],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#000"/>`)
    .join('');
  const source = svgDoc(BOLD + dust);
  const { W, H } = traceSize(N, N);
  const { data } = await sharp(Buffer.from(source))
    .flatten({ background: '#fff' })
    .resize(W, H, { kernel: 'linear' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = traceRgbaToSvg(new Uint8Array(data), W, H);
  assert.ok(out);
  assert.equal(out.elements, 1, `isolated dust must not become pieces — got ${out.elements}`);
});
