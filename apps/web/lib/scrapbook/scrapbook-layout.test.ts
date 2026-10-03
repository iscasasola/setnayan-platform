/**
 * The scrapbook's geometry and mask rules — the parts that decide what a finger
 * picks up and what a cut-out keeps, tested without a canvas.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_W,
  edgeAlpha,
  handlePoint,
  overBin,
  hitTest,
  maskBounds,
  pageHeight,
  pickMaskAt,
  readGesture,
  reshape,
  scatterPhotos,
  seeded,
  turnAndResize,
  unionMasks,
  type ScrapLayer,
  type ScrapPage,
} from './scrapbook-layout';

const layer = (o: Partial<ScrapLayer> & Pick<ScrapLayer, 'id' | 'kind'>): ScrapLayer => ({
  x: 500,
  y: 500,
  w: 200,
  rot: 0,
  seed: 1,
  ...o,
});
const square = () => ({ w: 200, h: 200 });

test('a finger picks the TOPMOST layer, the one it can see', () => {
  const under = layer({ id: 'under', kind: 'photo' });
  const over = layer({ id: 'over', kind: 'sticker' });
  assert.equal(hitTest([under, over], square, { x: 500, y: 500 })?.id, 'over');
  assert.equal(hitTest([over, under], square, { x: 500, y: 500 })?.id, 'under');
  assert.equal(hitTest([under, over], square, { x: 900, y: 900 }), null);
});

test('a turned layer is hit inside its turned box, not its old one', () => {
  // 200 × 40, turned 90° — now tall and thin.
  const bar = layer({ id: 'bar', kind: 'tape', rot: 90 });
  const size = () => ({ w: 200, h: 40 });
  assert.equal(hitTest([bar], size, { x: 500, y: 590 }, 0)?.id, 'bar', 'inside the turned box');
  assert.equal(hitTest([bar], size, { x: 590, y: 500 }, 0), null, 'where it used to reach');
});

test('the handle sits on the turned bottom-right corner', () => {
  const p = handlePoint({ x: 0, y: 0, rot: 90 }, { w: 200, h: 100 });
  assert.ok(Math.abs(p.x - -50) < 1e-9 && Math.abs(p.y - 100) < 1e-9, JSON.stringify(p));
});

test('turn-and-resize scales by distance and turns by the swing, within bounds', () => {
  const r = turnAndResize({ w: 200, rot: 10, dist: 100, angle: 0 }, { dist: 200, angle: Math.PI / 2 });
  assert.equal(r.w, 400);
  assert.equal(Math.round(r.rot), 100);
  assert.equal(turnAndResize({ w: 200, rot: 0, dist: 100, angle: 0 }, { dist: 1, angle: 0 }).w, 50);
});

test('scatter moves only the PHOTOS, onto the page, and keeps the rest on top', () => {
  const layers = [
    layer({ id: 't', kind: 'words', x: 10, y: 10 }),
    ...Array.from({ length: 7 }, (_, i) => layer({ id: `p${i}`, kind: 'photo', x: 0, y: 0 })),
    layer({ id: 'c', kind: 'cut', x: 33, y: 44 }),
  ];
  const h = pageHeight('4:5');
  const out = scatterPhotos(layers, h, seeded(3));
  assert.equal(out.length, layers.length);
  const photos = out.filter((l) => l.kind === 'photo');
  for (const p of photos) assert.ok(p.x >= 0 && p.x <= PAGE_W && p.y >= 0 && p.y <= h, `${p.id} left the page`);
  assert.deepEqual(out.slice(-2).map((l) => l.id), ['t', 'c'], 'words and cut-outs go back on top');
  assert.equal(out.find((l) => l.id === 'c')!.x, 33, 'a cut-out keeps its place');
  assert.equal(layers[1]!.x, 0, 'the input is untouched');
});

test('changing the page shape keeps each layer at the same height fraction', () => {
  const page: ScrapPage = { shape: '4:5', background: { kind: 'paper', paper: 'kraft' }, fade: 0, layers: [layer({ id: 'a', kind: 'photo', y: 625 })] };
  const sq = reshape(page, '1:1');
  assert.equal(sq.layers[0]!.y, 500);
  assert.equal(page.layers[0]!.y, 625);
});

test('the mask kept is the one confident AT THE TAP', () => {
  const w = 2;
  const h = 1;
  const left = new Float32Array([0.9, 0.1]);
  const right = new Float32Array([0.1, 0.9]);
  assert.deepEqual([...pickMaskAt([left, right], w, h, { x: 1, y: 0 })], [...right]);
  assert.deepEqual([...pickMaskAt([left, right], w, h, { x: 0, y: 0 })], [...left]);
});

test('a single mask that is NOT confident at the tap is the background — flipped', () => {
  const bg = new Float32Array([0.0, 1.0]);
  const out = pickMaskAt([bg], 2, 1, { x: 0, y: 0 });
  assert.deepEqual([...out], [1, 0]);
  assert.deepEqual([...bg], [0, 1], 'the model output is not mutated');
});

test('several taps make one cut-out', () => {
  const u = unionMasks([new Float32Array([1, 0, 0]), new Float32Array([0, 0, 0.8])])!;
  assert.deepEqual([...u].map((v) => Math.round(v * 10) / 10), [1, 0, 0.8]);
  assert.equal(unionMasks([]), null);
});

test('mask bounds cover the kept pixels, and nothing kept is null', () => {
  const data = new Float32Array(16);
  data[1 * 4 + 2] = 0.9;
  data[3 * 4 + 1] = 0.9;
  assert.deepEqual(maskBounds({ data, w: 4, h: 4 }), { x0: 1, y0: 1, x1: 2, y1: 3 });
  assert.equal(maskBounds({ data: new Float32Array(16), w: 4, h: 4 }), null);
});

test('the soft edge: gone below 0.3, kept above 0.7', () => {
  assert.equal(edgeAlpha(0.2), 0);
  assert.equal(edgeAlpha(0.8), 1);
  assert.ok(edgeAlpha(0.5) > 0.4 && edgeAlpha(0.5) < 0.6);
});

test('the bin catches a finger near it, and a bin that is not on screen catches nothing', () => {
  const bin = { left: 100, top: 500, right: 154, bottom: 554 };
  assert.equal(overBin(bin, 127, 527), true);
  assert.equal(overBin(bin, 90, 527), true, 'within the slop');
  assert.equal(overBin(bin, 60, 527), false);
  assert.equal(overBin({ left: 0, top: 0, right: 0, bottom: 0 }, 0, 0), false, 'a hidden bin measures zero');
});

test('a finger that barely moved is a tap; one that drew a line is a scribble', () => {
  assert.equal(readGesture([{ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }], 400, 400).kind, 'tap');
  const line = Array.from({ length: 90 }, (_, i) => ({ x: 0.5, y: i / 100 }));
  const g = readGesture(line, 400, 400);
  assert.equal(g.kind, 'scribble');
  if (g.kind === 'scribble') assert.ok(g.points.length <= 30, `${g.points.length} points`);
});
