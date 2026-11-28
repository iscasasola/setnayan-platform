/**
 * 👗 gown/parts/flowers — 3D flowers, scattered pearls, glitter tulle and raised lace, held to prototype v200's own
 * numbers (`v200-flowers.fixture.json`), and its rules said word for word.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { sanitizeGownConfig, startingGownConfig, type GownConfig, type GownOffer } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownApplyLook, gownChoose, gownHiddenChoices } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { gownGlitterShader, gownGlitterUniform } from '../fabric/glitter';
import { gownRaisedLaceShader, gownSurfaceShader, gownSurfaceUniforms } from '../fabric/surface';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { buildCape, emptyCape } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { placeGownBeadSet } from './beads';
import {
  buildGownFlowers, buildGownPearls, emptyGownFlowers, emptyGownPearls, gownFlowerGeo, gownFlowerQuantities, gownFlowerSummary, gownFlowerTopY, gownGlitterNet, gownPearlCount, placeGownVeilPearls,
} from './flowers';
import { buildGownSleeve, emptySleeve } from './sleeves';
import { buildGownVeil, emptyVeil } from './veil';
import { gownCapeNow } from '../../gown-config';

type Row = {
  name: string; look: Partial<GownConfig>; st: Partial<GownConfig>; gown: Partial<GownConfig>;
  count: number; dressN: number; sleeveN: number; capeN: number; coverN: number; drawn: number; D: number; yRef: number;
  A: (string | number)[][]; hid: number[]; drawnM: number[][]; top: number;
  pearlNeck: { n: number; count: number; tri: number[]; bc: number[]; spin: number[]; size: number; pos: number[][] }[];
  pearlVeil: { n: number; a: number[][]; drawn: number; pos: number[][] };
  prlSets: [string, number][]; laceN: number; quote: [string, string, number, string][]; summary: string[]; glitNet: number[]; veil?: number[];
};
type Scen = { name: string; look: Partial<GownConfig>; start: Partial<GownConfig>; steps: { k: keyof GownConfig; v: unknown; note: string; gown: Partial<GownConfig> }[] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v200-flowers.fixture.json'), 'utf8')) as { rows: Row[]; scen: Scen[] };
const OFFER: GownOffer = { fabricTypes: ['satin', 'crepe', 'chiffon'], fabricRefs: [], laceRefs: [], lookRefs: [] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
// As the prototype was captured: the look (no veil, sleeves, cape or cut-outs), then what it left.
const designOf = (look: Partial<GownConfig>, st: Partial<GownConfig>) =>
  ({ ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', cape: 'none', ...look }), ...st, hem: 'floor', hemCm: 0 }) as GownConfig;
/** The gown, its sleeves, any cape and the flowers on her, as the prototype's present() lays them. */
function dressed(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers), floorY = floorOf(B);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorY);
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const sleeves: Partial<Record<'L' | 'R', THREE.BufferGeometry>> = {}, worn: Partial<Record<'L' | 'R', ArrayLike<number>>> = {};
  for (const sd of ['L', 'R'] as const) { const geo = emptySleeve(); if (buildGownSleeve(B, T, sd, g, geo)) { sleeves[sd] = geo; worn[sd] = (geo.attributes.position as THREE.BufferAttribute).array; } }
  const hung = buildCape(B, T, D, C, K, g, { floorY, pose: 'a', sleeves: worn });
  const F = emptyGownFlowers(), geo = gownFlowerGeo(g.flowerType);
  buildGownFlowers(B, { T, D, cape: hung ? K : null, sleeves }, g, F, geo, { phone: false, overlay: g.overlay !== 'none' });
  return { T, D, K: hung ? K : null, F, floorY };
}
const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('3D flowers as v200 lays them: every spot and anchor, which are hidden, and every drawn flower within 1 mm', async () => {
  const B = await body(), cmU = B.P.S * 100;
  for (const r of REF.rows) {
    const g = designOf(r.look, r.gown), { F } = dressed(B, g);
    assert.deepEqual([F.count, F.dressN, F.sleeveN, F.capeN, F.coverN], [r.count, r.dressN, r.sleeveN, r.capeN, r.coverN], `${r.name}: how many, and where`);
    // v200 keeps the last flower size where there are none: compared only where there are flowers.
    assert.ok(!r.count || (close(F.D, r.D, 1e-5) && close(F.yRef, r.yRef, 1e-5)), `${r.name}: size`);
    F.A.forEach((a, i) => {
      const ref = r.A[i]!;
      assert.equal(a.k, ref[0], `${r.name}: flower ${i}'s cloth`);
      if (a.k === 's') {
        assert.equal(a.sd, ref[1]);
        for (const [x, y] of [[a.i, ref[2]], [a.a, ref[3]], [a.sc, ref[4]], [a.spin, ref[5]]] as [number, number][]) assert.ok(close(x, y, 1e-4), `${r.name}: sleeve flower ${i}`);
        return;
      }
      assert.deepEqual(a.t, ref.slice(1, 4), `${r.name}: flower ${i}'s triangle`);
      // A cape triangle of zero area gives v200 NaN weights (JSON null), and the same here.
      const w = (x: number, y: unknown) => (y === null ? Number.isNaN(x) : close(x, y as number, 1e-4));
      assert.ok(w(a.u, ref[4]) && w(a.v, ref[5]), `${r.name}: flower ${i}'s weights`);
      const tail = a.k === 'c' ? ref.slice(9) : ref.slice(6);
      assert.ok(close(a.sc, tail[0] as number, 1e-5) && close(a.spin, tail[1] as number, 1e-5), `${r.name}: flower ${i}'s size and turn`);
    });
    assert.deepEqual(F.hid ? Array.from(F.hid).flatMap((h, i) => (h ? [i] : [])) : [], r.hid, `${r.name}: hidden in this pose`);
    assert.equal(F.drawn, r.drawn, `${r.name}: drawn`);
    r.drawnM.forEach((m, i) => {
      const o = i * 16, M = F.mats;
      assert.ok(Math.hypot(M[o + 12]! - m[0]!, M[o + 13]! - m[1]!, M[o + 14]! - m[2]!) * cmU < 0.1, `${r.name}: flower ${i} sits where v200 puts it`);
      for (let k = 3; k < 9; k++) assert.ok(close(M[o + [8, 9, 10, 0, 1, 2][k - 3]!]!, m[k]!, 2e-4 * F.D + 1e-6), `${r.name}: flower ${i} faces and turns as v200's`);
    });
    assert.ok(Math.abs(gownFlowerTopY(F) - r.top) * cmU < 0.1 || (r.top < -1e8 && gownFlowerTopY(F) < -1e8), `${r.name}: the flowers' top`);
  }
});

test('scattered pearls along the neckline and the veil edge, and the veil kept outside the flowers, as v200', async () => {
  const B = await body(), cmU = B.P.S * 100;
  for (const r of REF.rows.filter((x) => x.pearlNeck.length || x.pearlVeil.n || x.veil)) {
    const g = designOf(r.look, r.gown), { T, D, K, F, floorY } = dressed(B, g), PR = emptyGownPearls();
    buildGownPearls(B, T, D, g, PR, { phone: false, veil: g.veil !== 'none' });
    const ref = r.pearlNeck[0];
    assert.equal(!!PR.neck, !!ref, `${r.name}: neckline pearls`);
    if (PR.neck && ref) {
      assert.deepEqual([PR.neck.n, PR.neck.count], [ref.n, ref.count]);
      assert.deepEqual(Array.from(PR.neck.tri), ref.tri, `${r.name}: each pearl's triangle`);
      PR.neck.bc.forEach((x, i) => assert.ok(close(x, ref.bc[i]!, 1e-5)));
      PR.neck.spin.forEach((x, i) => assert.ok(close(x, ref.spin[i]!, 1e-5)));
      const M = new Float32Array(PR.neck.n * 16);
      assert.ok(placeGownBeadSet(PR.neck, D, M));
      ref.pos.forEach((p, i) => assert.ok(Math.hypot(M[i * 16 + 12]! - p[0]!, M[i * 16 + 13]! - p[1]!, M[i * 16 + 14]! - p[2]!) * cmU < 0.1, `${r.name}: pearl ${i}`));
    }
    assert.equal(PR.veilA.length, r.pearlVeil.n, `${r.name}: veil pearls`);
    PR.veilA.forEach((q, i) => assert.ok(close(q.a, r.pearlVeil.a[i]![0]!, 1e-5) && close(q.d, r.pearlVeil.a[i]![1]!, 1e-6) && close(q.spin, r.pearlVeil.a[i]![2]!, 1e-5), `${r.name}: veil pearl ${i}`));
    assert.equal(gownPearlCount(PR), r.prlSets.reduce((t, s) => t + s[1], 0), `${r.name}: pearls on the Pearls line`);
    if (g.veil === 'none') continue;
    const V = emptyVeil();
    buildGownVeil(B, T, D, K, g, V, floorY, 0, { flowers: F });
    if (r.veil) {
      const P = (V.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      let worst = 0;
      for (let i = 0; i < P.length; i++) worst = Math.max(worst, Math.abs(P[i]! - r.veil[i]!));
      assert.ok(worst * cmU < 0.1, `${r.name}: the veil over the flowers, within 1 mm of v200 (worst ${(worst * cmU).toFixed(2)} cm)`);
    }
    placeGownVeilPearls(PR, V.geo, T);
    // v200 leaves its veil-pearl count from the case before when there are none: compared where there are.
    if (r.pearlVeil.n) assert.equal(PR.veilDrawn, r.pearlVeil.drawn, `${r.name}: veil pearls drawn`);
    if (r.pearlVeil.n) r.pearlVeil.pos.forEach((p, i) => assert.ok(Math.hypot(PR.veilMats[i * 16 + 12]! - p[0]!, PR.veilMats[i * 16 + 13]! - p[1]!, PR.veilMats[i * 16 + 14]! - p[2]!) * cmU < 0.1, `${r.name}: veil pearl ${i} sits where v200 puts it`));
  }
});

test("the designer's lines and the quote's numbers (unpriced): flowers by tens, raised lace, glitter tulle metres", async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = designOf(r.look, r.gown), { T, D, F } = dressed(B, g), PR = emptyGownPearls();
    buildGownPearls(B, T, D, g, PR, { phone: false, veil: g.veil !== 'none' });
    const accented = !!(g.accentFabric || g.accentHex);
    assert.deepEqual(gownFlowerSummary(g, { F, pearls: PR, accented, laceCount: r.laceN, capeFab: g.cape === 'none' ? null : gownCapeNow(g).fab }), r.summary, `${r.name}: the designer's lines`);
    const q = gownFlowerQuantities(g, F, r.laceN), row = (k: string) => r.quote.filter((x) => x[0] === k);
    assert.deepEqual(row('flowers3d').map((x) => x[2]), F.count ? [q.flowerTens] : [], `${r.name}: flowers, by tens`);
    assert.equal(row('lace_raised').length, q.laceRaised ? 1 : 0, `${r.name}: raised lace`);
    assert.deepEqual(row('fab_glitter_tulle').map((x) => x[2]), [q.glitter.layers, q.glitter.veil].filter((m, i) => (i === 0 ? q.glitter.layerN > 0 : g.veilFab === 'glitter' && g.veil !== 'none') && m >= 0), `${r.name}: glitter tulle metres`);
    assert.deepEqual([0, 3, 40].map((n) => gownGlitterNet(n, g)), r.glitNet, `${r.name}: the plain net glitter takes over`);
  }
});

test('the v200 rules, word for word, what shows where, and the server refuses what they rule out', () => {
  for (const s of REF.scen) {
    let g = designOf(s.look, s.start);
    for (const st of s.steps) {
      const out = gownChoose(g, { key: st.k, value: st.v } as Parameters<typeof gownChoose>[1]);
      assert.equal(out.notes.join(' '), st.note, `${s.name}: ${st.k} = ${String(st.v)}`);
      // v200 keeps the real hem on `dress.hem`; its `gown.hem` is a copy a look leaves behind.
      for (const [k, v] of Object.entries(st.gown)) if (k !== 'hem') assert.deepEqual(out.config[k as keyof GownConfig], v, `${s.name}: ${st.k} = ${String(st.v)} leaves ${k}`);
      g = out.config;
    }
  }
  const at = (look: Partial<GownConfig>, st: Partial<GownConfig> = {}) => gownHiddenChoices(designOf(look, st));
  assert.deepEqual(at({}).flowers, []);
  assert.deepEqual(gownHiddenChoices({ ...designOf({}, {}), hem: 'knee' }).flowers, ['hem'], 'a hem border needs a floor-length hem');
  assert.equal(at({}).flowerDetails, true);
  assert.equal(at({}, { flowers: 'scatter' }).flowerDetails, false);
  assert.equal(at({}, { flowers: 'scatter' }).flowerFromRow, true);
  assert.equal(at({}, { flowers: 'cascade' }).flowerFromRow, false);
  assert.deepEqual(at({}).flowerFrom, ['shoulder'], 'a strapless cascade starts at the bodice edge');
  assert.deepEqual(at({ neck: 'v' }).flowerFrom, []);
  assert.deepEqual(at({ sil: 'sheath' }).flowerSize, ['large']);
  assert.deepEqual(at({}).flowerCol, ['accent']);
  assert.deepEqual(at({}).pearls, ['veil', 'both']);
  assert.deepEqual(at({ veil: 'chapel' }).pearls, []);
  assert.equal(at({}).veilFab, true);
  assert.equal(at({ veil: 'chapel' }).veilFab, false);
  const ok = (st: Partial<GownConfig>) => sanitizeGownConfig({ ...startingGownConfig(), ...st }, OFFER).ok;
  assert.equal(ok({ flowers: 'scatter', flowerSize: 'large' }), true);
  assert.equal(ok({ sil: 'sheath', flowers: 'scatter', flowerSize: 'large' }), false, 'no large flowers on a sheath');
  assert.equal(ok({ sil: 'sheath', flowers: 'scatter', flowerSize: 'medium' }), true);
  assert.equal(ok({ sil: 'sheath', flowerSize: 'large' }), true, 'no flowers: the size is not worn');
  assert.equal(ok({ flowers: 'hem' }), true);
  assert.equal(ok({ flowers: 'hem', hem: 'knee' }), false, 'a hem border needs a floor-length hem');
  assert.equal(ok({ flowers: 'cascade', flowerFrom: 'shoulder' }), false, 'a strapless cascade starts at the bodice edge');
  assert.equal(ok({ flowers: 'cascade', flowerFrom: 'shoulder', neck: 'v' }), true);
  assert.equal(ok({ pearls: 'veil' }), false, 'pearls on the veil edge need a veil');
  assert.equal(ok({ pearls: 'both', veil: 'chapel' }), true);
  assert.equal(ok({ veilFab: 'glitter', capeFab: 'glitter', ovFab: 'glitter', laceFinish: 'raised' } as Partial<GownConfig>), true);
});

test("the shaders: glitter's sparkle has no time in it, raised lace replaces the flat lace line", () => {
  const sh = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownGlitterShader(gownGlitterUniform())(sh);
  assert.match(sh.fragmentShader, /if \(glitOn > 0\.0\) \{ vec3 gp = vGlP \* glitOn/);
  assert.match(sh.fragmentShader, /#include <opaque_fragment>/);
  assert.doesNotMatch(sh.fragmentShader.slice(0, sh.fragmentShader.indexOf('#include <opaque_fragment>')), /\btime\b|uTime/, 'still when nothing moves');
  assert.match(sh.vertexShader, /vGlP = position;/);
  const u = gownSurfaceUniforms(), s2 = { uniforms: {} as Record<string, unknown>, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  gownSurfaceShader(u)(s2);
  gownRaisedLaceShader(u)(s2);
  assert.match(s2.fragmentShader, /if \(laceRaise > 0\.5\) \{ vec2 tx/);
  assert.match(s2.fragmentShader, /vec2 dHdxy = laceBump \*/);
  assert.equal(s2.uniforms.laceRaise, u.laceRaise);
});
