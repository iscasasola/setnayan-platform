/**
 * 👗 gown/dress/cape — the cape held to prototype v193's own numbers (`v197-cape.fixture.json`: side, back and capelet
 * on four gowns, captured from the prototype itself), and to "clothes follow the body": the cape never sinks into her.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownConfig, type GownCape, type GownConfig } from '../../gown-config';
import { jointY } from '../body/bones';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from './build';
import { CAPE_COLS, CAPE_ROWS, buildCape, capeMetres, emptyCape, gownCapeShown } from './cape';
import { restingCloth, writeDress } from './cloth';
import { fabricMetres } from './flat';
import { buildEnvelope, emptyEnvelope, reach } from './table';

type Row = {
  name: string; look: Partial<GownConfig>; hem: GownConfig['hem']; cape: GownCape; metres: number; capeM: number; visible: boolean;
  NJ: number | null; j0: number[] | null; tops: number[] | null; hems: number[] | null; sample: [number, number, number, number][] | null;
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v197-cape.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};

function caped(B: GownRig, over: Partial<GownConfig>) {
  const g = { ...startingGownConfig(), ...over };
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  const floorY = floorOf(B);
  buildDress(B, T, D, g, floorY);
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const hung = buildCape(B, T, D, C, K, g, { floorY, pose: 'a' });
  return { T, D, K, hung };
}

// v197 hangs the v196 catalogue: a cape is up to two panels plus its trim in one mesh. The back cape keeps v193's
// defaults, so it is held here; the side cape's new defaults (tulle, to the train, an appliqué edge), the reshaped
// capelet and the rest of the catalogue come with step A6f.
const V193_SAME = (r: Row) => r.cape === 'back' || r.cape === 'none';
test('the back cape hangs as v197 hangs them: rows, top edge, hem, the cloth itself and the fabric metres with the cape', async () => {
  const B = await body();
  for (const r of REF.rows.filter(V193_SAME)) {
    const { D, K, hung } = caped(B, { ...r.look, hem: r.hem, hemCm: 0, cape: r.cape });
    assert.equal(hung, r.visible, `${r.name}: hung`);
    assert.ok(Math.abs(capeMetres(B, K) - r.capeM) < 1e-3, `${r.name}: cape metres ${capeMetres(B, K)} vs ${r.capeM}`);
    assert.equal(fabricMetres(B, D, K), r.metres, `${r.name}: outer fabric with the cape`);
    if (!r.sample) continue;
    const I = K.info!;
    assert.equal(I.ys.length, r.NJ, `${r.name}: lattice rows`);
    assert.deepEqual(Array.from(I.j0).filter((_, c) => c % 10 === 0), r.j0, `${r.name}: top rows`);
    for (const [k, v] of r.tops!.entries()) assert.ok(Math.abs(I.tops[k * 10]! - v) < 1e-4, `${r.name}: top edge`);
    for (const [k, v] of r.hems!.entries()) assert.ok(Math.abs(I.hems[k * 10]! - v) < 1e-4, `${r.name}: hem`);
    const rest = K.geo.attributes.rest!.array as Float32Array;
    let worst = 0;
    // The first panel (v197's own vertex numbering; later panels and the trim follow it).
    for (const [i, x, y, z] of r.sample) if (i < CAPE_ROWS * CAPE_COLS) worst = Math.max(worst, Math.hypot(rest[i * 3]! - x, rest[i * 3 + 1]! - y, rest[i * 3 + 2]! - z));
    assert.ok(worst * B.P.S * 100 < 0.1, `${r.name}: the cape is within 1 mm of v197's (worst ${(worst * B.P.S * 100).toFixed(2)} cm)`);
  }
});

test('the cape never sinks into her or the gown: under 2 mm below the shoulders, and only a chord over the shoulder ridge', async () => {
  const B = await body();
  const ySh = jointY(B, 'upperarm01.L'), cmOf = (d: number) => d * B.P.S * 100;
  for (const cape of ['side', 'back', 'capelet'] as const) for (const sil of ['aline', 'ball', 'mermaid'] as const) {
    const { T, K } = caped(B, { sil, cape, petti: sil === 'ball' ? 'full' : 'soft' });
    const P = K.geo.attributes.position!.array as Float32Array;
    let ridge = 0, below = 0;
    for (let i = 0; i < CAPE_ROWS * CAPE_COLS; i++) {
      const y = P[i * 3 + 1]!, { r, env } = reach(T, P[i * 3]!, y, P[i * 3 + 2]!), d = env - r;
      if (y > ySh - 0.05) ridge = Math.max(ridge, d); else below = Math.max(below, d);
    }
    // v193 itself: where the cloth crosses the shoulder ridge between two lattice rows it cuts the corner by up to ~5 mm.
    assert.ok(cmOf(ridge) < 0.6, `${cape} on ${sil}: ${cmOf(ridge).toFixed(2)} cm inside at the shoulder`);
    assert.ok(cmOf(below) < 0.2, `${cape} on ${sil}: ${cmOf(below).toFixed(2)} cm inside below the shoulder`);
  }
});

test('a floor-length cape hides while she kneels or sits; a capelet stays', () => {
  for (const pose of ['kneel', 'sit', 'cross']) {
    assert.equal(gownCapeShown('side', pose), false);
    assert.equal(gownCapeShown('back', pose), false);
    assert.equal(gownCapeShown('capelet', pose), true);
  }
  assert.equal(gownCapeShown('back', 'a'), true);
  assert.equal(gownCapeShown('none', 'a'), false);
});
