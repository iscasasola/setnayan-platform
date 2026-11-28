/**
 * 👗 gown/parts/beads — bead layers sewn on the gown, held to prototype v202's own numbers (`v202-beads.fixture.json`):
 * every set a layer lays (kind, colour, how many, size, where each bead sits) and the designer's count line, word for word.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownConfig, type GownBeadLayer, type GownConfig } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownApplyLook } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { GOWN_BEAD_CAP, buildGownBeads, gownBeadCounts, gownBeadHex, gownBeadLayers, gownBeadZoneW, gownInHole } from './beads';

type Set = { kind: string; hex: number; n: number; count: number; size: number; rows: number; triSum: number; bcSum: number; tri: number[]; bc: number[]; spin: number[] };
type ProtoLayer = Omit<GownBeadLayer, 'beadHex'> & { beadHex: string };
type Row = { name: string; look: Partial<GownConfig>; layers: ProtoLayer[]; rows: number; nb: number; sets: Set[]; line: string };
const REF = JSON.parse(readFileSync(join(__dirname, 'v202-beads.fixture.json'), 'utf8')) as { rows: Row[] };
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
// The prototype keeps a custom hex on every layer; the contract keeps it only when the colour is custom.
const ours = (l: ProtoLayer): GownBeadLayer => ({ ...l, beadHex: l.beadCol === 'custom' ? l.beadHex : null, mix: l.mix.map((m) => ({ ...m })) });
const designOf = (r: Row) => {
  const [first, ...rest] = r.layers.map(ours);
  return { ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', cape: 'none', ...r.look }), hem: 'floor', hemCm: 0, ...first!, beadLayers: rest } as GownConfig;
};

test('bead layers as v202 lays them: every set, its colour, count and size, where each bead sits, and the line for the designer', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = designOf(r), { T, D } = dressed(B, g);
    assert.equal(D.rows, r.rows, `${r.name}: gown rows`);
    const { sets, lines } = buildGownBeads(B, D, T, g, { phone: false });
    assert.equal(lines.join(' ') + ' These counts go to the designer.', r.line, `${r.name}: the designer's line`);
    assert.equal(sets.length, r.sets.length, `${r.name}: sets`);
    sets.forEach((S, i) => {
      const R = r.sets[i]!;
      assert.equal(S.kind, R.kind, `${r.name}: set ${i} kind`);
      assert.equal(gownBeadHex(S.col!), R.hex, `${r.name}: set ${i} colour`);
      assert.equal(S.n, R.n, `${r.name}: set ${i} drawn`);
      assert.equal(S.count, R.count, `${r.name}: set ${i} counted`);
      assert.ok(Math.abs(S.size - R.size) < 1e-6, `${r.name}: set ${i} size`);
      assert.deepEqual(Array.from(S.tri.slice(0, R.tri.length)), R.tri, `${r.name}: set ${i} triangles`);
      R.bc.forEach((v, k) => assert.ok(Math.abs(S.bc[k]! - v) < 1e-5, `${r.name}: set ${i} weight ${k}`));
      R.spin.forEach((v, k) => assert.ok(Math.abs(S.spin[k]! - v) < 1e-4, `${r.name}: set ${i} turn ${k}`));
      let st = 0, sb = 0;
      for (let k = 0; k < S.tri.length; k++) st += S.tri[k]! * ((k % 7) + 1);
      for (let k = 0; k < S.bc.length; k++) sb += S.bc[k]!;
      assert.equal(st, R.triSum, `${r.name}: set ${i} every triangle`);
      assert.ok(Math.abs(sb - R.bcSum) < 1e-3, `${r.name}: set ${i} every weight`);
    });
  }
});

test('a phone draws each colour its share of 2500, and the quote still counts every bead', async () => {
  const B = await body(), r = REF.rows.find((x) => x.name === 'sheath-all-heavy')!, g = designOf(r), { T, D } = dressed(B, g);
  const { sets } = buildGownBeads(B, D, T, g, { phone: true });
  assert.equal(sets.reduce((t, s) => t + s.n, 0), GOWN_BEAD_CAP);
  assert.equal(gownBeadCounts(sets).crystal, 12000);
  const mix = REF.rows.find((x) => x.name === 'crystal-mix')!, gm = designOf(mix), dm = dressed(B, gm), m = buildGownBeads(B, dm.D, dm.T, gm, { phone: true });
  // Under the cap, nothing is thinned.
  assert.deepEqual(m.sets.map((s) => s.n), mix.sets.map((s) => s.n));
});

test('the eraser wipes beads where it rubbed and nowhere else, and never moves another bead', async () => {
  const B = await body(), r = REF.rows.find((x) => x.name === 'crystal-cascade')!, g = designOf(r), { T, D } = dressed(B, g), cmU = B.P.S * 100;
  const all = buildGownBeads(B, D, T, g, { phone: false }).sets[0]!;
  const hole = { ph: 0, y: 1.25, r: 6, what: 'beads' as const };
  const left = buildGownBeads(B, D, T, g, { phone: false, holes: [hole] }).sets[0]!;
  assert.ok(left.count < all.count && left.count > all.count * 0.5, `${left.count} of ${all.count}`);
  // A lace-only hole leaves the beads.
  assert.equal(buildGownBeads(B, D, T, g, { phone: false, holes: [{ ...hole, what: 'lace' }] }).sets[0]!.count, all.count);
  assert.ok(gownInHole([hole], 0.01, 1.25, cmU, 0.12, 'beads') && !gownInHole([hole], Math.PI, 1.25, cmU, 0.12, 'beads'));
});

test('the zones, and the first layer read flat off the design', () => {
  assert.equal(gownBeadZoneW('bodice', 0, 20, 10, 48, 0, 0), 1);
  assert.equal(gownBeadZoneW('bodice', 0, 20, 60, 48, 0, 0), 0);
  assert.equal(gownBeadZoneW('neck', 0, 1, 10, 48, 0, 0), 1);
  assert.equal(gownBeadZoneW('neck', 0, 5, 10, 48, 0, 0), 0);
  assert.equal(gownBeadZoneW('hem', 0, 0, 80, 48, 20, 0), 0);
  assert.equal(gownBeadZoneW('cascade', 0.9, 0, 80, 48, 0, 0), 0);
  const d = { ...startingGownConfig(), bead: 'pearl', beadLayers: [{ bead: 'seed', beadAt: 'hem', beadDen: 'light', beadCol: 'gold', beadMm: 2, beadHex: null, mix: [] }] } as GownConfig;
  assert.deepEqual(gownBeadLayers(d).map((l) => l.bead), ['pearl', 'seed']);
  assert.equal(gownBeadHex('#e6b8c2'), 0xe6b8c2);
  assert.equal(gownBeadHex('gold'), 0xd4af5a);
});
