/**
 * 👗 SEAM ALLOWANCES (plan step B11; drawing v205; owner D29 + D30). Held to the prototype's OWN `patGeom`: on every
 * golden skirt (42) and bodice (7), at the usual allowances, at an odd set and as a net pattern, the port's cut line,
 * allowance per edge and notches equal v205's to the micron (prototype-v205.golden.json, scripts/gown-pattern-golden.mjs).
 * Then the cut line's own promise, measured: straight out from every stitching edge it sits at that edge's allowance.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/allowance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import golden from './prototype-v205.golden.json';
import { draftSkirt, type GownBlockPiece, type GownPoint } from './skirt';
import { draftBodice } from './bodice';
import { GOWN_SEAM_ALLOW_DEFAULT, GOWN_SEAM_KINDS, gownPieceGeom, gownSeamAllowClean, type GownSeamAllow } from './allowance';
import type { GownDraftOrder } from './inputs';

type Geo = { C: number[][] | null; N: number[][]; D: number[] };
type GoldenInput = { vals: Record<string, number>; sil?: string; hem?: string; estimate: Record<string, number>; ease: { part: string; ease: number }[] };
const G = golden as unknown as {
  skirts: { input: GoldenInput }[];
  bodices: { input: GoldenInput }[];
  saDefault: GownSeamAllow;
  saOdd: GownSeamAllow;
  geom: { skirts: { usual: Geo; odd: Geo; net: Geo }[][]; bodices: { usual: Geo; odd: Geo; net: Geo }[][] };
  saMost: GownSeamAllow;
  geomMost: Geo[][];
  gore: GownBlockPiece;
  goreGeom: Geo;
  scoop: GownBlockPiece;
  scoopGeom: Geo;
};

/** The golden input as the port's draft order (estimates only, as the prototype ran them). */
const orderOf = (i: GoldenInput): GownDraftOrder =>
  ({
    vals: i.vals,
    sil: i.sil ?? 'aline',
    hem: i.hem ?? 'floor',
    measures: Object.fromEntries(Object.entries(i.estimate).map(([k, cm]) => [k, { cm, from: 'estimate' }])),
    ease: i.ease.map((e) => ({ part: e.part, ease: e.ease })),
  }) as unknown as GownDraftOrder;

function near(a: unknown, b: unknown, path: string) {
  if (typeof a === 'number' && typeof b === 'number') return assert.ok(Math.abs(a - b) <= 0.002, `${path}: ${a} ≠ ${b}`);
  if (a === null || b === null) return assert.equal(a, b, path);
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, `${path}: length ${a.length} ≠ ${b.length}`);
    return a.forEach((x, i) => near(x, b[i], `${path}[${i}]`));
  }
  assert.deepEqual(a, b, path);
}
function sameGeom(pieces: readonly GownBlockPiece[], want: { usual: Geo; odd: Geo; net: Geo }[], path: string) {
  assert.equal(pieces.length, want.length, `${path}: pieces`);
  pieces.forEach((p, i) => {
    for (const [k, sa, net] of [['usual', G.saDefault, false], ['odd', G.saOdd, false], ['net', G.saDefault, true]] as const) {
      const g = gownPieceGeom(p, sa, net);
      near(g.D, want[i]![k].D, `${path}.${p.name}.${k}.D`);
      near(g.C, want[i]![k].C, `${path}.${p.name}.${k}.C`);
      near(g.N, want[i]![k].N, `${path}.${p.name}.${k}.N`);
    }
  });
}

test('the usual allowances are the drawing’s: seams 1.5, hem 2.5, zip 2.0, necklines and armholes 1.0 cm', () => {
  assert.deepEqual(GOWN_SEAM_ALLOW_DEFAULT, G.saDefault);
  assert.deepEqual(GOWN_SEAM_ALLOW_DEFAULT, { seam: 1.5, hem: 2.5, zip: 2, neck: 1 });
  assert.deepEqual(GOWN_SEAM_KINDS.map((k) => k[1]), ['Seams', 'Hem', 'Zip', 'Necklines and armholes']);
});

test('1 · 42 skirts: cut line, allowance per edge and notches equal the prototype’s, to the micron', () => {
  G.skirts.forEach((s, i) => {
    const d = draftSkirt(orderOf(s.input), {});
    assert.ok(d.ok, `skirt ${i} did not draft`);
    if (d.ok) sameGeom(d.pieces, G.geom.skirts[i]!, `skirt ${i} (${s.input.sil})`);
  });
});

test('2 · 7 bodices (necklines, armholes, the zip, the fold, the bust dart’s mouth) equal the prototype’s', () => {
  G.bodices.forEach((b, i) => {
    const d = draftBodice(orderOf(b.input), {});
    assert.ok(d.ok, `bodice ${i} did not draft`);
    if (d.ok) sameGeom(d.pieces, G.geom.bodices[i]!, `bodice ${i}`);
  });
});

test('2b · stress: the largest allowances on every bodice (loops cut off) and a needle-sharp gore (squared off) equal the prototype’s', () => {
  G.bodices.forEach((b, i) => {
    const d = draftBodice(orderOf(b.input), {});
    assert.ok(d.ok);
    if (!d.ok) return;
    d.pieces.forEach((p, k) => {
      const g = gownPieceGeom(p, G.saMost, false), w = G.geomMost[i]![k]!;
      near(g.C, w.C, `bodice ${i}.${p.name}.most.C`);
      near(g.N, w.N, `bodice ${i}.${p.name}.most.N`);
    });
  });
  const g = gownPieceGeom(G.gore, G.saMost, false);
  near(g.C, G.goreGeom.C, 'gore.C');
  near(g.N, G.goreGeom.N, 'gore.N');
  const s = gownPieceGeom(G.scoop, G.saMost, false);
  near(s.C, G.scoopGeom.C, 'scoop.C');
  assert.ok(s.C!.length < G.scoop.outline.length + 4, 'the loop the tight curve makes was not cut off');
});

/** How far out from a point, straight along a direction, the cut line is (the nearest crossing). */
function rayTo(poly: readonly GownPoint[], p: GownPoint, dir: GownPoint): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!, ex = b[0] - a[0], ey = b[1] - a[1], den = dir[0] * ey - dir[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * dir[1] - (a[1] - p[1]) * dir[0]) / den;
    if (t >= -1e-6 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return best;
}

test('3 · measured: straight out from the middle of every long stitching edge, the cut line is at that edge’s allowance', () => {
  const sa: GownSeamAllow = { seam: 1.2, hem: 4, zip: 2.5, neck: 0.8 };
  const all = [...G.skirts.map((s) => draftSkirt(orderOf(s.input), {})), ...G.bodices.map((b) => draftBodice(orderOf(b.input), {}))];
  let edges = 0;
  for (const d of all) {
    if (!d.ok) continue;
    for (const p of d.pieces) {
      const g = gownPieceGeom(p, sa, false), o = p.outline;
      let A = 0;
      for (let i = 0; i < o.length; i++) { const a = o[i]!, b = o[(i + 1) % o.length]!; A += a[0] * b[1] - b[0] * a[1]; }
      const sg = A > 0 ? 1 : -1;
      g.roles.forEach((r, i) => {
        const a = o[i]!, b = o[(i + 1) % o.length]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 60) return; // short edges on a curve: the corner rules them
        const mid: GownPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const got = rayTo(g.C!, mid, [(sg * (b[1] - a[1])) / L, (-sg * (b[0] - a[0])) / L]);
        const want = r === 'fold' ? 0 : sa[r] * 10;
        assert.ok(Math.abs(got - want) <= 0.1, `${p.name} edge ${i} (${r}): ${got.toFixed(3)} mm, want ${want}`);
        edges++;
      });
    }
  }
  assert.ok(edges > 300, `only ${edges} edges were measured`);
});

test('4 · a net pattern: no cut line, no notches, the box is the stitching line', () => {
  const d = draftSkirt(orderOf(G.skirts[0]!.input), {});
  assert.ok(d.ok);
  if (!d.ok) return;
  const g = gownPieceGeom(d.pieces[0]!, GOWN_SEAM_ALLOW_DEFAULT, true);
  assert.equal(g.C, null);
  assert.deepEqual(g.N, []);
  assert.ok(g.D.every((x) => x === 0));
});

test('5 · the allowances she sets: one decimal, held to each kind’s range; a missing one takes the shop’s', () => {
  assert.deepEqual(gownSeamAllowClean({ seam: 1.26, hem: 20, zip: 0.2, neck: 'x' }), { seam: 1.3, hem: 8, zip: 1, neck: 1 });
  assert.deepEqual(gownSeamAllowClean(null), GOWN_SEAM_ALLOW_DEFAULT);
  assert.deepEqual(gownSeamAllowClean({ seam: 2 }, { seam: 1, hem: 3, zip: 2, neck: 0.5 }), { seam: 2, hem: 3, zip: 2, neck: 0.5 });
  assert.deepEqual(gownSeamAllowClean({ seam: -1, hem: 0 }), { ...GOWN_SEAM_ALLOW_DEFAULT });
});
