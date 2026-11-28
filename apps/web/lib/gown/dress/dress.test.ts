/**
 * 👗 gown/dress — the gown built on her body, held to prototype v189's own numbers (`v199-dress.fixture.json`: five
 * gowns on the default body, captured from the prototype itself), and to the owner rule "clothes follow the body".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownConfig, type GownConfig } from '../../gown-config';
import { parseGownBody } from '../body/load';
import { RING_N, TAU } from '../body/constants';
import type { GownRig } from '../body/rig';
import { solveGownBody } from '../body/solve';
import { GOWN_FABRIC_FALLBACK, gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf, type GownDress } from './build';
import { restingCloth, writeDress } from './cloth';
import { fabricMetres } from './flat';
import { buildEnvelope, emptyEnvelope, reach, type GownEnvelope } from './table';

type Row = { name: string; look: Partial<GownConfig>; hem: GownConfig['hem']; state: Pick<GownConfig, 'boning' | 'backT' | 'neckT' | 'illuBack'>; rows: number; ns: number; hemR: number; yHem: number; fold: number; metres: number; sample: [number, number, number, number][] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-dress.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};

function dressOn(B: GownRig, over: Partial<GownConfig>, view: { bustled?: boolean } = {}): { T: GownEnvelope; D: GownDress; g: GownConfig } {
  const g = { ...startingGownConfig(), ...over };
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B), floorOf(B), view);
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { T, D, g };
}

test('fourteen v197 gowns are built the same (fit and flare, straight across, the sweetheart bar, a strapless back at the bra line, a high-neck keyhole back, a bateau, American and French bustles, a train run straight back): rows, hem, folds, fabric metres and the cloth itself', async () => {
  const B = await body();
  for (const r of REF.rows) {
    // `state`: what the look leaves as it was (boning from the strapless rule, the back and neck depths).
    // v197 shows a bustled train when she asks (the look's `bustled`; a view, not part of the design).
    const { bustled, ...look } = r.look as Partial<GownConfig> & { bustled?: boolean };
    const { T, D } = dressOn(B, { ...look, ...r.state, hem: r.hem, hemCm: 0 }, { bustled });
    assert.equal(D.rows, r.rows, `${r.name}: rows`);
    assert.equal(D.ns, r.ns, `${r.name}: skirt rows`);
    assert.ok(Math.abs(D.hemR - r.hemR) < 1e-3, `${r.name}: hem radius ${D.hemR} vs ${r.hemR}`);
    assert.ok(Math.abs(T.yHem - r.yHem) < 1e-3, `${r.name}: hem height`);
    assert.ok(Math.abs(D.fold - r.fold) < 1e-3, `${r.name}: folds`);
    assert.equal(fabricMetres(B, D), r.metres, `${r.name}: fabric metres`);
    const rest = D.geo!.attributes.rest!.array as Float32Array;
    let worst = 0;
    for (const [i, x, y, z] of r.sample) worst = Math.max(worst, Math.hypot(rest[i * 3]! - x, rest[i * 3 + 1]! - y, rest[i * 3 + 2]! - z));
    assert.ok(worst * B.P.S * 100 < 0.1, `${r.name}: the cloth is within 1 mm of v197's (worst ${(worst * B.P.S * 100).toFixed(2)} cm)`);
  }
});

test('fabric metres goldens: an A-line, a ball gown with a cathedral train, a mermaid (v197)', async () => {
  const B = await body();
  const m = (look: Partial<GownConfig>) => fabricMetres(B, dressOn(B, { ...look, hem: 'floor', hemCm: 0 }).D);
  assert.equal(m({}), 3);
  assert.equal(m({ sil: 'ball', train: 'cathedral', petti: 'full' }), 11.4);
  assert.equal(m({ sil: 'mermaid', neck: 'v', back: 'v', boning: 'soft' }), 3.5);
});

const BODIES: [number, number, number, number, number][] = [
  [150, 78, 70, 64, 86], [155, 84, 72, 68, 90], [160, 92, 76, 74, 98], [165, 100, 80, 82, 104], [150, 104, 84, 90, 108],
  [170, 96, 78, 72, 100], [155, 120, 96, 104, 124], [158, 140, 112, 124, 146], [145, 70, 66, 56, 78], [175, 110, 88, 96, 118],
];

test('clothes follow the body: on 10 bodies × 4 silhouettes the gown never sinks into her (owner rule)', async () => {
  const B = await body();
  const N = RING_N, DTH = TAU / N, tolCm = 0.5;
  for (const [height, bust, underbust, waist, hips] of BODIES) {
    Object.assign(B.vals, { height, bust, underbust, waist, hips });
    B.fine.bustT = 0;
    solveGownBody(B);
    for (const sil of ['aline', 'ball', 'mermaid', 'sheath'] as const) {
      const { T, D } = dressOn(B, { sil });
      const P = D.geo!.attributes.position!.array as Float32Array;
      let worst = 0;
      // Every row below the neckline lip, down to the hem (the train lies on the floor, past her feet).
      for (let i = 1; i <= D.nb + 1 + D.ns; i++) {
        for (let q = 0; q < N; q++) {
          const o = i * N + q, x = P[o * 3]!, y = P[o * 3 + 1]!, z = P[o * 3 + 2]!;
          if (y < T.yHem + 0.02) continue; // the hem's own edge (at the shin, a knee, the floor)
          const { r, env } = reach({ ...T, on: false }, x, y, z);
          worst = Math.max(worst, (env - r) * B.P.S * 100);
        }
      }
      void DTH;
      assert.ok(worst <= tolCm, `${height}/${bust}/${underbust}/${waist}/${hips} ${sil}: the cloth sinks ${worst.toFixed(2)} cm into her`);
    }
  }
});

test('a fabric type the code does not know draws as its registry renderAs, never satin', () => {
  assert.equal(gownFabricType('satin').drawAs, 'satin');
  assert.equal(gownFabricType('duchess_satin', [{ id: 'duchess_satin', name: 'Duchess satin', renderAs: 'mikado', gsm: 300 }]).drawAs, 'mikado');
  assert.equal(gownFabricType('duchess_satin', [{ id: 'duchess_satin', name: 'Duchess satin', renderAs: 'mikado', gsm: 300 }]).props.gsm, 300, 'the registry numbers win');
  assert.equal(gownFabricType('unknown').drawAs, GOWN_FABRIC_FALLBACK);
  assert.notEqual(gownFabricType('unknown').drawAs, 'satin');
  assert.notEqual(gownFabricType('mystery', [{ id: 'mystery', name: 'Mystery', renderAs: 'not_a_type' }]).drawAs, 'satin');
});

test('the dress engine is plain maths: no DOM, no material, no shadows, no money', () => {
  for (const dir of [__dirname, join(__dirname, '../fabric')]) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      assert.ok(!/\bdocument\.|\bwindow\.|castShadow|shadowMap|Material\(/.test(src), `${f} stays plain maths`);
      assert.ok(!/₱|centavo|price|cost/i.test(src), `${f} holds no money`);
      assert.ok(!/barong|camisa|trouser/i.test(src), `${f}: women only`);
    }
  }
});
