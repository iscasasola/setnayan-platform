/**
 * 👗 gown/parts/hand — place by hand, held to prototype v202's own numbers (`v202-hand.fixture.json`): the beads she
 * placed (every set, colour, count, where), the eraser wiping the ready-made beads and lace, motifs placed by hand, the
 * scissors' cuts, and the screen's lines word for word. Then the tools' edits: Mirror, the caps, the eraser, Clear.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_HAND_MAX, GOWN_STRAPLESS, startingGownConfig, type GownConfig, type GownHandCut } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownApplyLook } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownBeads, gownBeadHex, type GownBeadSet } from './beads';
import { buildGownCuts, gownCutForbidden } from './cuts';
import { GOWN_HAND_FULL, buildGownHandBeads, gownHandClear, gownHandCutShape, gownHandCutTap, gownHandErase, gownHandPlace } from './hand';
import { buildGownLace, gownLaceCountLine } from './lace';

type RefSet = { kind: string; hex: number; n: number; count: number; size: number; triSum: number; bcSum: number; tri: number[]; bc: number[]; spin: number[] };
type Row = {
  name: string; look: Partial<GownConfig>; st: Record<string, unknown>;
  hand: { beads?: GownConfig['handBeads']; holes?: GownConfig['handHoles']; cuts?: ({ ph: number; y: number; r: number } | { poly: [number, number][] })[]; manual?: GownConfig['handLace'] };
  layers: RefSet[]; manual: RefSet[]; laceCountN: number; laceSpots: number; laceBeadPts: number; laceBeadMm: number | null;
  laceLine: string; brLine: string; laceBLine: string; cutNote: string;
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v202-hand.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
function dressed(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B));
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { T, D };
}
const designOf = (r: Row): GownConfig => {
  const st = { ...r.st } as Record<string, unknown>;
  if (st.beadCol !== 'custom') st.beadHex = null;
  const cuts: GownHandCut[] = (r.hand.cuts ?? []).map((c) => ('poly' in c ? { pts: c.poly } : c));
  return { ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', cape: 'none', ...r.look }), hem: 'floor', hemCm: 0, ...st, handBeads: r.hand.beads ?? [], handHoles: r.hand.holes ?? [], handLace: r.hand.manual ?? [], handCuts: cuts } as GownConfig;
};
const row = (n: string) => REF.rows.find((r) => r.name === n)!;
function sameSet(S: GownBeadSet, R: RefSet, what: string) {
  assert.equal(S.kind, R.kind, `${what}: kind`);
  assert.equal(gownBeadHex(S.col!), R.hex, `${what}: colour`);
  assert.equal(S.count, R.count, `${what}: counted`);
  assert.equal(S.n, R.n, `${what}: drawn`);
  assert.ok(Math.abs(S.size - R.size) < 1e-6, `${what}: size`);
  assert.deepEqual(Array.from(S.tri.slice(0, R.tri.length)), R.tri, `${what}: triangles`);
  R.bc.forEach((v, k) => assert.ok(Math.abs(S.bc[k]! - v) < 1e-5, `${what}: weight ${k}`));
  R.spin.forEach((v, k) => assert.ok(Math.abs(S.spin[k]! - v) < 1e-4, `${what}: turn ${k}`));
  let st = 0;
  for (let k = 0; k < S.tri.length; k++) st += S.tri[k]! * ((k % 7) + 1);
  assert.equal(st, R.triSum, `${what}: every triangle`);
}

test('beads placed by hand, as v202 draws them: one set a kind, colour and size, and the line for the designer', async () => {
  const B = await body(), r = row('hand-beads'), g = designOf(r), { D } = dressed(B, g);
  const H = buildGownHandBeads(B, D, g, [], { phone: false });
  assert.equal(H.sets.length, r.manual.length);
  H.sets.forEach((S, i) => sameSet(S, r.manual[i]!, `hand set ${i}`));
  assert.equal(H.line, r.brLine);
  assert.equal(H.laceLine, r.laceBLine);
});

test('the eraser wipes the ready-made beads under it, as v202 does (a lace-only wipe leaves them)', async () => {
  const B = await body(), r = row('layer-holes'), g = designOf(r), { T, D } = dressed(B, g);
  const { sets } = buildGownBeads(B, D, T, g, { phone: false, holes: g.handHoles });
  assert.equal(sets.length, r.layers.length);
  sets.forEach((S, i) => sameSet(S, r.layers[i]!, `layer set ${i}`));
});

test('lace: ready-made motifs wiped by the eraser, motifs placed by hand kept and counted, word for word', async () => {
  const B = await body();
  for (const name of ['lace-hand-holes', 'lace-hand-only']) {
    const r = row(name), g = designOf(r), { T, D } = dressed(B, g), plan = buildGownLace(B, T, D, g)!;
    assert.equal(plan.spots.length, r.laceSpots, `${name}: spots`);
    assert.equal(plan.countN, r.laceCountN, `${name}: motifs to make`);
    if (r.laceLine) assert.equal(gownLaceCountLine('Floral', plan, g.laceCm), r.laceLine, `${name}: the lace line`);
    assert.equal(buildGownHandBeads(B, D, g, [], { phone: false }).line, r.brLine, `${name}: the hand line`);
  }
});

test('beaded lace: beads only on the lace, mirrored, at most 4 mm, at most 16 a motif when rich', async () => {
  const B = await body(), r = row('beaded-lace'), g = designOf(r), { T, D } = dressed(B, g), cmU = B.P.S * 100;
  // Without a painted map nothing is sewn (the stage reads the canvas).
  assert.equal(buildGownLace(B, T, D, g)!.beadPts.length, 0);
  const plan = buildGownLace(B, T, D, g, null, null, () => 255)!;
  assert.equal(plan.spots.length, r.laceSpots);
  assert.ok(plan.beadPts.length > 0 && plan.beadPts.length <= plan.spots.length * 16 * 2 && plan.beadPts.length % 2 === 0, `${plan.beadPts.length} lace beads`);
  // The prototype's count, from its own drawn lace, sits inside the same bound.
  assert.ok(r.laceBeadPts <= plan.spots.length * 16 * 2);
  assert.equal(plan.beadPts[0]!.mm, r.laceBeadMm);
  for (let i = 0; i < plan.beadPts.length; i += 2) assert.ok(plan.beadPts[i]!.ph === -plan.beadPts[i + 1]!.ph && plan.beadPts[i]!.y === plan.beadPts[i + 1]!.y);
  // Each lies on a motif (within half its width).
  for (const p of plan.beadPts) assert.ok(plan.spots.some((s) => Math.abs(Math.abs(p.ph) / Math.PI - s.u) * Math.PI * 0.12 * cmU < s.cm * s.sc && Math.abs(p.y - s.y) * cmU <= s.cm * s.sc * 0.5 + 1e-6), 'on a motif');
  const H = buildGownHandBeads(B, D, g, plan.beadPts, { phone: false });
  assert.equal(H.sets.at(-1)!.where, 'lace');
  assert.equal(H.sets.at(-1)!.kind, 'pearl');
  assert.match(H.laceLine, /^Beads sewn on the lace: about \d+, 4 mm\. Added to the bead count and the quote\.$/);
});

test('the scissors: round holes and a drawn shape join the cut-outs, and the note says so', async () => {
  const B = await body(), r = row('cuts'), g = designOf(r), { T, D } = dressed(B, g);
  const plan = buildGownCuts(B, T, D, g, GOWN_STRAPLESS.includes(g.neck))!;
  assert.equal(plan.note, r.cutNote.trim());
  assert.equal(plan.placed.filter((p) => p.shape === 'oval' && p.w === 4).length, 2);
});

test('the tools: Mirror places twins, the eraser rubs out both sides, each tool stops at its cap with one line', async () => {
  const B = await body(), cmU = B.P.S * 100, base = { ...startingGownConfig(), bead: 'pearl', beadCol: 'gold' } as GownConfig, h = { ph: 0.5, y: 1.0, r: 0.12 };
  const one = gownHandPlace(base, 'beads', h, { mirror: true, spin: 1, rot: 0 }).config;
  assert.deepEqual(one.handBeads.map((b) => [b.ph, b.kind, b.col]), [[0.5, 'pearl', 'gold'], [-0.5, 'pearl', 'gold']]);
  assert.equal(gownHandPlace(base, 'beads', h, { mirror: false, spin: 1, rot: 0 }).config.handBeads.length, 1);
  // A custom colour places its hex; no beading picked places crystals.
  assert.equal(gownHandPlace({ ...base, beadCol: 'custom', beadHex: '#E6B8C2' }, 'beads', h, { mirror: false, spin: 0, rot: 0 }).config.handBeads[0]!.col, '#E6B8C2');
  assert.equal(gownHandPlace({ ...base, bead: 'none' }, 'beads', h, { mirror: false, spin: 0, rot: 0 }).config.handBeads[0]!.kind, 'crystal');
  const lace = gownHandPlace({ ...base, lace: 'leaf' }, 'lace', { ...h, ph: -0.5 }, { mirror: true, spin: 0, rot: 0.3 }).config.handLace;
  assert.deepEqual(lace.map((m) => [m.id, m.u]), [['leaf', 0.1592]]);
  // The eraser takes away what is under it on both sides, and leaves a hole for the ready-made placement.
  const er = gownHandErase(one, h, { mirror: true, what: 'all', cm: 4, cmU });
  assert.equal(er.config.handBeads.length, 0);
  assert.equal(er.config.handHoles.length, 2);
  assert.equal(gownHandErase(one, h, { mirror: true, what: 'lace', cm: 4, cmU }).config.handBeads.length, 2, 'a lace-only eraser leaves beads');
  // Caps.
  const full = { ...base, handBeads: Array.from({ length: GOWN_HAND_MAX.beads }, () => one.handBeads[0]!) };
  const capped = gownHandPlace(full, 'beads', h, { mirror: true, spin: 0, rot: 0 });
  assert.equal(capped.config, full);
  assert.equal(capped.note, GOWN_HAND_FULL.beads);
  // Scissors: a tap where cutting is not allowed is refused with its reason; elsewhere it cuts both sides.
  const { T, D } = dressed(B, base), forbidden = (ph: number, y: number, rcm: number) => gownCutForbidden(B, T, D.L!, ph, y, rcm);
  const tap = gownHandCutTap(base, { ph: 1.2, y: 0.9, r: 0.12 }, { mirror: true, cm: 4, forbidden });
  assert.equal(tap.config.handCuts.length, 2);
  const back = gownHandCutTap(base, { ph: Math.PI, y: 1.4, r: 0.12 }, { mirror: false, cm: 4, forbidden });
  assert.equal(back.config.handCuts.length, 0);
  assert.match(back.note, /^Not cut here: /);
  assert.equal(gownHandCutShape(base, [[0.5, 0.7], [0.7, 0.7], [0.7, 0.6]], { mirror: true, forbidden }).config.handCuts.length, 0, 'three points do not close a shape');
  assert.equal(gownHandCutShape(base, [[0.5, 0.7], [0.7, 0.7], [0.7, 0.6], [0.5, 0.6]], { mirror: true, forbidden }).config.handCuts.length, 2);
  // One set a kind, colour AND size: two sizes of the same gold pearl are two sets.
  const twoSizes = { ...base, handBeads: [{ ph: 0.3, y: 1.0, kind: 'pearl' as const, col: 'gold', mm: 3, spin: 0 }, { ph: 0.35, y: 1.0, kind: 'pearl' as const, col: 'gold', mm: 5, spin: 0 }] };
  assert.deepEqual(buildGownHandBeads(B, D, twoSizes, [], { phone: false }).sets.map((s) => Math.round(s.size * cmU * 10)), [3, 5]);
  const cleared = gownHandClear({ ...er.config, handCuts: tap.config.handCuts });
  assert.deepEqual([cleared.handBeads, cleared.handHoles, cleared.handLace, cleared.handCuts], [[], [], [], []]);
});
