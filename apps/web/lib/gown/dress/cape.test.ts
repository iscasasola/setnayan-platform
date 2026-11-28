/**
 * 👗 gown/dress/cape — the cape catalogue held to prototype v197's own numbers (`v199-cape.fixture.json`: every cape
 * type with its details, captured from the prototype itself), and to "clothes follow the body": the cape never sinks
 * into her.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gownCapeInGownFabric, startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { jointY } from '../body/bones';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownApplyLook } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from './build';
import { CAPE_COLS, CAPE_ROWS, buildCape, capeMetres, emptyCape, gownCapeShown, gownCapeStrapNeeded } from './cape';
import { restingCloth, writeDress } from './cloth';
import { fabricMetres } from './flat';
import { buildEnvelope, emptyEnvelope, reach } from './table';

type Pt = [number, number, number, number];
type Row = {
  name: string; look: Partial<GownLook>; hem: GownConfig['hem']; cp: Partial<GownConfig>; gown: Partial<GownConfig>;
  metres: number; capeM: number; visible: boolean; nUsed: number; edgeL: number; beadN: number; sample: Pt[] | null;
  parts: { NJ: number; vo: number; j0: number[]; tops: number[]; hems: number[] }[] | null; groups: [number, number, number][] | null;
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-cape.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};

function caped(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  const floorY = floorOf(B);
  buildDress(B, T, D, g, floorY);
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const hung = buildCape(B, T, D, C, K, g, { floorY, pose: 'a' });
  return { T, D, K, hung };
}
// As the prototype was captured: the look (with no veil or sleeves), then the cape and its details set as given.
const designOf = (r: Row): GownConfig => ({ ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', ...r.look }), ...r.gown, capeFab: null, capeLen: null, capeEdge: null, capeFasten: null, ...r.cp, hem: r.hem, hemCm: 0 } as GownConfig);

test('every v197 cape hangs as the prototype hangs it: each panel, the trim, the groups, the free edge, the beads and the metres', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = designOf(r), { D, K, hung } = caped(B, g);
    assert.equal(hung, r.visible, `${r.name}: hung`);
    assert.ok(Math.abs(capeMetres(B, K) - r.capeM) < 1e-3, `${r.name}: cape metres ${capeMetres(B, K)} vs ${r.capeM}`);
    assert.equal(fabricMetres(B, D, gownCapeInGownFabric(g) ? K : null), r.metres, `${r.name}: outer fabric (a gown-fabric cape is cut from it)`);
    if (!r.parts || !r.sample) continue;
    assert.equal(K.parts.length, r.parts.length, `${r.name}: panels`);
    for (const [p, ref] of r.parts.entries()) {
      const I = K.parts[p]!;
      assert.equal(I.ys.length, ref.NJ, `${r.name} panel ${p}: lattice rows`);
      assert.equal(I.vo, ref.vo, `${r.name} panel ${p}: its place in the mesh`);
      assert.deepEqual(Array.from(I.j0).filter((_, c) => c % 10 === 0), ref.j0, `${r.name} panel ${p}: top rows`);
      for (const [k, v] of ref.tops.entries()) assert.ok(Math.abs(I.tops[k * 10]! - v) < 1e-4, `${r.name} panel ${p}: top edge`);
      for (const [k, v] of ref.hems.entries()) assert.ok(Math.abs(I.hems[k * 10]! - v) < 1e-4, `${r.name} panel ${p}: hem`);
    }
    assert.equal(K.nUsed, r.nUsed, `${r.name}: vertices in use (the trim)`);
    assert.deepEqual(K.geo.groups.map((x) => [x.start, x.count, x.materialIndex]), r.groups, `${r.name}: cloth, border, bands, clasps`);
    assert.ok(Math.abs(K.edgeL - r.edgeL) < 1e-3, `${r.name}: the free edge ${K.edgeL} vs ${r.edgeL} m`);
    assert.equal(K.beadN, r.beadN, `${r.name}: beads`);
    const rest = K.geo.attributes.rest!.array as Float32Array, floor = floorOf(B), lift = 0.0018 / B.P.S, trim0 = 2 * CAPE_ROWS * CAPE_COLS;
    let worst = 0, worstTrim = 0;
    for (const [i, x, y, z] of r.sample) {
      // A border lying flat on the floor: v197 lifts it to either side of the cloth at random (its outward test is near
      // zero there); ours lies on top. Held across the floor, and to the lift up or down.
      const flat = i >= trim0 && Math.abs(y - floor) < 0.05 && Math.abs(Math.abs(rest[i * 3 + 1]! - y) - 2 * lift) < 1e-4;
      const d = flat ? Math.hypot(rest[i * 3]! - x, rest[i * 3 + 2]! - z) : Math.hypot(rest[i * 3]! - x, rest[i * 3 + 1]! - y, rest[i * 3 + 2]! - z);
      if (i >= trim0) worstTrim = Math.max(worstTrim, d); else worst = Math.max(worst, d);
    }
    assert.ok(worst * B.P.S * 100 < 0.1, `${r.name}: the cape is within 1 mm of v197's (worst ${(worst * B.P.S * 100).toFixed(2)} cm)`);
    // The trim is laid from the panel's lattice, up to 15 cm across it (an appliqué border on the floor), which carries the
    // panel's own sub-millimetre difference a little further.
    assert.ok(worstTrim * B.P.S * 100 < 0.15, `${r.name}: the trim is within 1.5 mm of v197's (worst ${(worstTrim * B.P.S * 100).toFixed(2)} cm)`);
  }
});

test('no cape sinks into her or the gown: under 2 mm below the shoulders, and only a chord over the shoulder ridge', async () => {
  const B = await body();
  const ySh = jointY(B, 'upperarm01.L'), cmOf = (d: number) => d * B.P.S * 100;
  for (const cape of ['neck', 'back', 'pair', 'side', 'capelet', 'drape'] as const) for (const sil of ['aline', 'ball', 'mermaid'] as const) {
    const g = { ...gownApplyLook(startingGownConfig(), { sil, petti: sil === 'ball' ? 'full' : 'soft' }), cape } as GownConfig, { T, K } = caped(B, g);
    const P = K.geo.attributes.position!.array as Float32Array;
    let ridge = 0, below = 0;
    for (const I of K.parts) for (let i = 0; i < CAPE_ROWS * CAPE_COLS; i++) {
      const o = (I.vo + i) * 3, y = P[o + 1]!, { r, env } = reach(T, P[o]!, y, P[o + 2]!), d = env - r;
      if (y > ySh - 0.05) ridge = Math.max(ridge, d); else below = Math.max(below, d);
    }
    // v193 itself: where the cloth crosses the shoulder ridge between two lattice rows it cuts the corner by up to ~5 mm;
    // a cape hung from a strap line over the shoulder (the pair, the side cape) by up to ~7 mm in v197 (ours matches it).
    const ridgeCm = cape === 'pair' || cape === 'side' ? 0.75 : 0.6;
    assert.ok(cmOf(ridge) < ridgeCm, `${cape} on ${sil}: ${cmOf(ridge).toFixed(2)} cm inside at the shoulder`);
    assert.ok(cmOf(below) < 0.2, `${cape} on ${sil}: ${cmOf(below).toFixed(2)} cm inside below the shoulder`);
  }
});

test('a cape to the fingertips or longer hides while she kneels or sits; a short one stays; a strapless neckline gets a strap for a one-shoulder cape', () => {
  const d = (cape: GownConfig['cape'], capeLen: GownConfig['capeLen'] = null) => ({ cape, capeLen, capeFab: null, capeEdge: null, capeFasten: null });
  for (const pose of ['kneel', 'sit', 'cross']) {
    for (const k of ['neck', 'back', 'pair', 'side', 'drape'] as const) assert.equal(gownCapeShown(d(k), pose), false, `${k} ${pose}`);
    assert.equal(gownCapeShown(d('capelet'), pose), true);
    assert.equal(gownCapeShown(d('back', 'elbow'), pose), true, 'an elbow-length back cape stays');
  }
  assert.equal(gownCapeShown(d('back'), 'a'), true);
  assert.equal(gownCapeShown(d('none'), 'a'), false);
  assert.equal(gownCapeStrapNeeded({ cape: 'side', neck: 'sweetheart' }), true);
  assert.equal(gownCapeStrapNeeded({ cape: 'drape', neck: 'bateau' }), false);
  assert.equal(gownCapeStrapNeeded({ cape: 'back', neck: 'straight' }), false);
});
