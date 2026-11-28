/**
 * 👗 THE CUTTING LIST (plan step B11; drawing v205). Held to the prototype's OWN `patCutList` on five whole orders
 * (bodice + skirt; outer, lining, tulle layers; a train, a cape, accent and lace sleeves; sent before the quote saved
 * its metres; a net pattern; an order's own allowances): every row, every total, every check and its "Why" equal
 * v205's (prototype-v205.golden.json). Then the context a stored design gives, and that no money is anywhere in it.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/cutting-list.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import golden from './prototype-v205.golden.json';
import { emptyGownQuantities, startingGownConfig } from '../gown-config';
import { draftSkirt } from './skirt';
import { draftBodice } from './bodice';
import { GOWN_SEAM_ALLOW_DEFAULT, gownSeamAllowClean } from './allowance';
import { gownCutCheckSentence, gownCutContext, gownCutList, gownGrainSay, gownLayMetres, type GownCutContext, type GownCutPart } from './cutting-list';
import type { GownBlockPiece } from './skirt';
import type { GownDraftOrder } from './inputs';

type GoldenInput = { vals: Record<string, number>; estimate: Record<string, number>; ease: { part: string; ease: number }[] };
const G = golden as unknown as {
  bodices: { input: GoldenInput }[];
  skirts: { input: GoldenInput & { sil: string } }[];
  cutCases: { name: string; order: { est: Record<string, number>; vals: Record<string, number>; sil: string; gown: Record<string, unknown>; cut: Omit<GownCutContext, 'train'>; netPattern: boolean; seamAllow: Record<string, number> | null }; cutList: unknown }[];
};

/** The prototype's whole order (its body and its own estimates) as the port's drafts. */
function gownGoldenList(o: { est: Record<string, number>; vals: Record<string, number>; sil: string }): { p: GownBlockPiece; part: GownCutPart }[] {
  const order = {
    vals: o.vals,
    sil: o.sil,
    hem: 'floor',
    measures: Object.fromEntries(Object.entries(o.est).map(([k, cm]) => [k, { cm, from: 'estimate' }])),
    ease: [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }],
  } as unknown as GownDraftOrder;
  const bo = draftBodice(order, {}), dr = draftSkirt(order, {}), out: { p: GownBlockPiece; part: GownCutPart }[] = [];
  if (bo.ok) out.push(...bo.pieces.map((p) => ({ p, part: 'bodice' as const })));
  if (dr.ok) out.push(...dr.pieces.map((p) => ({ p, part: 'skirt' as const })));
  return out;
}

function near(a: unknown, b: unknown, path: string) {
  if (typeof a === 'number' && typeof b === 'number') return assert.ok(Math.abs(a - b) <= 1e-6, `${path}: ${a} ≠ ${b}`);
  if (Array.isArray(a) && Array.isArray(b)) {
    assert.equal(a.length, b.length, `${path}: length`);
    return a.forEach((x, i) => near(x, b[i], `${path}[${i}]`));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), `${path}: keys`);
    for (const k of Object.keys(a)) near((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    return;
  }
  assert.equal(a, b, path);
}

test('1 · six whole orders: rows, totals, checks and every "Why" equal the prototype’s', () => {
  assert.equal(G.cutCases.length, 6);
  for (const c of G.cutCases) {
    const sa = c.order.seamAllow ? gownSeamAllowClean(c.order.seamAllow) : GOWN_SEAM_ALLOW_DEFAULT;
    const ctx: GownCutContext = { ...c.order.cut, train: !!c.order.gown.train && c.order.gown.train !== 'none' };
    near(JSON.parse(JSON.stringify(gownCutList(gownGoldenList(c.order), ctx, sa, c.order.netPattern))), c.cutList, c.name);
  }
});

test('2 · the sentences a person reads: the check line and its Why', () => {
  assert.deepEqual(gownCutCheckSentence({ k: 'outer', m: 2.9, q: 4.2, ok: false, diff: (2.9 - 4.2) / 4.2, why: 'the quote unrolls the 3D gown, which is cut fuller than these starting blocks' }), {
    lead: 'Outer: about 2.9 m of 150 cm fabric · the quote says 4.2 m (-31%).',
    why: 'Why: the quote unrolls the 3D gown, which is cut fuller than these starting blocks.',
  });
  assert.deepEqual(gownCutCheckSentence({ k: 'lining', m: 11, q: 11.9, ok: true, diff: -0.07, why: '' }), { lead: 'Lining: about 11 m of 150 cm fabric · the quote says 11.9 m ✓.', why: null });
  assert.equal(gownCutCheckSentence({ k: 'outer', m: 1.8, q: null, ok: null, why: 'This order was sent before the quote saved its metres, so there is nothing to check against.' }).why, 'This order was sent before the quote saved its metres, so there is nothing to check against.');
});

test('3 · a stored design gives the context: outer name, lining, layers (no hoop), accent and lace, what has no block, the quote’s metres', () => {
  const c = { ...startingGownConfig(), lining: 'satin' as const, petti: 'soft' as const, skirtLayers: 3, layerTypes: ['hoop', 'soft', 'full'] as never, sleeve: 'long' as never, sleeveFab: 'lace' as never, train: 'chapel' as never };
  const q = emptyGownQuantities();
  q.materials.outerM = 7.5; q.materials.liningM = 6.4; q.materials.netM = 9;
  const ctx = gownCutContext(c, q, 'Mikado');
  assert.deepEqual(ctx, { outerName: 'Mikado', lining: 'satin', layers: ['soft', 'full'], accent: null, lace: 'sleeves', incl: [], metres: { outer: 7.5, lining: 6.4, tulle: 9 }, train: true });
  assert.equal(gownCutContext(startingGownConfig(), null, null).metres, null, 'a design with no quantities has nothing to check against');
});

test('4 · laying out: pairs two to a slot, a piece too wide for the folded cloth cut open and pieced, +15 %', () => {
  assert.deepEqual(gownLayMetres([{ w: 30, h: 100, qty: 2, fold: false }]), { m: 1.2, pieced: false });
  assert.deepEqual(gownLayMetres([{ w: 80, h: 100, qty: 1, fold: true }]), { m: 2.3, pieced: true });
});

test('5 · no money anywhere in the allowance or cutting-list code', () => {
  for (const f of ['allowance.ts', 'cutting-list.ts']) {
    const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    assert.doesNotMatch(src, /₱|centavo|formatPhp|price/i, `${f} talks about money`);
  }
});

test('6 · grain words: within 8° of straight is straight grain; within 8° of 45° is the bias; anything else "As marked"', () => {
  const at = (deg: number, cut = 'Cut 2') => gownGrainSay({ cut, grain: [[0, 0], [Math.sin((deg * Math.PI) / 180) * 100, Math.cos((deg * Math.PI) / 180) * 100]] });
  assert.equal(at(5), 'Straight grain, along the centre');
  assert.equal(at(5, 'Cut 1 on the fold'), 'Straight grain, along the fold');
  assert.equal(at(40), 'Straight grain as marked: 45° to the straight edges');
  assert.equal(at(12), 'As marked');
  assert.equal(at(25), 'As marked');
});
