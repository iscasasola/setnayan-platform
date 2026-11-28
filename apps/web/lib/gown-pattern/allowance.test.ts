/**
 * 👗 SEAM ALLOWANCES (plan step B11; owner D29: on by default, editable; D30: centimetres). The cut line sits at the
 * set distance from every sewing edge — none on a fold, the zip allowance on the centre back, the hem allowance on a
 * skirt's or sleeve's hem — and a net pattern has no cut line at all.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/allowance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startingGownBody, startingGownConfig, type GownMeasures } from '../gown-config';
import { gownOrderBlocks } from './order';
import { GOWN_SEAM_ALLOWANCE_DEFAULT, gownCutLine, gownEdgeKinds, sanitizeGownSeamAllowance, type GownSeamAllowance } from './allowance';
import type { GownBlockPiece, GownPoint } from './skirt';

const measures: GownMeasures = { waistHip: { cm: 22, from: 'typed' }, waistFloor: { cm: 100, from: 'typed' } };
const skirt = (sil: 'sheath' | 'aline' | 'ball') => {
  const b = gownOrderBlocks({ ...startingGownConfig(), sil }, startingGownBody(), measures);
  assert.ok(b.skirt.ok, `the ${sil} skirt did not draft`);
  return b.skirt.ok ? b.skirt.pieces : [];
};

/** How far out from a point, straight along a direction, the cut line is (the nearest crossing). */
function rayTo(poly: readonly GownPoint[], p: GownPoint, dir: GownPoint): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, ex = b[0] - a[0], ey = b[1] - a[1];
    const den = dir[0] * ey - dir[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * dir[1] - (a[1] - p[1]) * dir[0]) / den;
    if (t >= -1e-6 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return best;
}
const signedArea = (o: readonly GownPoint[]) => o.reduce((s, a, i) => { const b = o[(i + 1) % o.length]!; return s + a[0] * b[1] - b[0] * a[1]; }, 0);

/** Straight out from every edge's midpoint, the cut line sits at that edge's own allowance (within 0.5 mm). */
function assertAtDistance(p: GownBlockPiece, sa: GownSeamAllowance) {
  const cut = gownCutLine(p, sa);
  assert.ok(cut, 'no cut line');
  const kinds = gownEdgeKinds(p), o = p.outline;
  const want = { fold: 0, zip: sa.zipCm * 10, hem: sa.hemCm * 10, seam: sa.seamCm * 10 };
  kinds.forEach((k, i) => {
    const a = o[i]!, b = o[(i + 1) % o.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 20) return; // a tiny edge between two curves: its corner rules it
    const mid: GownPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]), sg = signedArea(o) > 0 ? 1 : -1;
    const d = rayTo(cut!, mid, [(sg * (b[1] - a[1])) / L, (-sg * (b[0] - a[0])) / L]);
    assert.ok(Math.abs(d - want[k]) <= 0.5, `${p.name} edge ${i} (${k}): ${d.toFixed(2)} mm, want ${want[k]}`);
  });
  return kinds;
}

test('1 · the skirt front: no allowance on the fold, the seam allowance on the waist and side, the hem allowance on the hem', () => {
  const [front] = skirt('sheath');
  const kinds = assertAtDistance(front!, GOWN_SEAM_ALLOWANCE_DEFAULT);
  assert.ok(kinds.includes('fold') && kinds.includes('hem') && kinds.includes('seam'));
  assert.ok(!kinds.includes('zip'), 'a piece cut on the fold has no zip');
});

test('2 · the skirt back, cut as a pair: the zip allowance on the centre back', () => {
  const [, back] = skirt('sheath');
  const kinds = assertAtDistance(back!, GOWN_SEAM_ALLOWANCE_DEFAULT);
  assert.equal(kinds.filter((k) => k === 'zip').length, 1);
  assert.ok(!kinds.includes('fold'));
});

test('3 · an A-line (a curved hem) and a circle skirt (hem on the big arc, both straight sides are seams) at any allowance', () => {
  const sa = { on: true, seamCm: 1, hemCm: 5, zipCm: 2.5 };
  for (const p of skirt('aline')) assertAtDistance(p, sa);
  const [quarter] = skirt('ball');
  const kinds = assertAtDistance(quarter!, sa);
  assert.ok(kinds.filter((k) => k === 'hem').length > 10, 'the circle hem is not the big arc');
  assert.ok(!kinds.includes('fold') && !kinds.includes('zip'), 'a quarter circle is cut 4: its straight sides are seams');
});

test('4 · the cut line is outside the sewing line, and a net pattern has none', () => {
  const [front] = skirt('aline');
  const cut = gownCutLine(front!, GOWN_SEAM_ALLOWANCE_DEFAULT)!;
  const area = (o: readonly GownPoint[]) => Math.abs(o.reduce((s, a, i) => { const b = o[(i + 1) % o.length]!; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  assert.ok(area(cut) > area(front!.outline), 'the cut line is inside the block');
  assert.equal(gownCutLine(front!, { ...GOWN_SEAM_ALLOWANCE_DEFAULT, on: false }), null);
});

test('5 · the allowances she can set: cm from 0 to 10, a tenth of a cm, anything else refused', () => {
  assert.deepEqual(sanitizeGownSeamAllowance({ on: true, seamCm: 1.25, hemCm: 0, zipCm: 2 }), { on: true, seamCm: 1.3, hemCm: 0, zipCm: 2 });
  for (const bad of [null, {}, { on: 'yes', seamCm: 1, hemCm: 1, zipCm: 1 }, { on: true, seamCm: -1, hemCm: 1, zipCm: 1 }, { on: true, seamCm: 11, hemCm: 1, zipCm: 1 }, { on: true, seamCm: 1, hemCm: Number.NaN, zipCm: 1 }])
    assert.equal(sanitizeGownSeamAllowance(bad), null, JSON.stringify(bad));
  assert.equal(GOWN_SEAM_ALLOWANCE_DEFAULT.on, true, 'allowances are on by default (owner D29)');
});

test('6 · a very sharp point (a dart tip, a narrow gore) is squared off, never thrown far out', () => {
  const gore: GownBlockPiece = { name: 'Gore', cut: 'Cut 2', outline: [[0, 0], [400, 10], [0, 20]], darts: [], marks: [], points: [], grain: [[0, 10], [300, 10]], vent: 0 };
  const cut = gownCutLine(gore, GOWN_SEAM_ALLOWANCE_DEFAULT)!;
  const far = Math.max(...cut.filter((q) => q[0] > 200).map((q) => Math.hypot(q[0] - 400, q[1] - 10)));
  assert.ok(far <= 4 * 15 + 1, `the point reaches ${far.toFixed(1)} mm out`);
  assert.ok(cut.length >= 4, 'the sharp point was not squared off');
});
