/**
 * 👗 gown/parts — sleeves, the off-shoulder band, the veil (every style, over a train and over a back cape), the back
 * closure and the shoes, held to prototype v193's own numbers (`v207-parts.fixture.json`, captured from the prototype).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { computeBones } from '../body/bones';
import { BODY_K, RING_N, SLICE_DY } from '../body/constants';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { skin } from '../body/skin';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { buildCape, emptyCape } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownClosure, gownLaceUpFits } from './closure';
import { fitGownShoes, parseGownShoe, poseGownShoes } from './heels';
import { buildGownSleeve, emptySleeve, gownSleeveKind } from './sleeves';
import { flutterMetres } from './flutter';
import { fabricMetres } from '../dress/flat';
import { solveGownBody } from '../body/solve';
import { gownChoose, gownApplyLook } from '../compat';
import { buildGownVeil, emptyVeil } from './veil';

type Pt = [number, number, number, number];
type Row = {
  look?: Partial<GownLook>;
  name: string; hem: GownConfig['hem']; gown: Partial<GownConfig>;
  sleeves?: { L: Pt[] | null; R: Pt[] | null }; veil?: Pt[]; edge?: Pt[]; cap?: Pt[] | null; closure?: { count: number; min: number[]; max: number[] }[];
  shoes?: Pt[][]; heelT?: number; poseQ?: ([number, number, number, number] | null)[]; floorY?: number;
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v207-parts.fixture.json'), 'utf8')) as { rows: Row[] };
const PUB = join(__dirname, '../../../public/gown');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(PUB, 'female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};

function dressed(B: GownRig, r: Row) {
  const g = { ...gownApplyLook(startingGownConfig(), r.look ?? {}), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  const floorY = floorOf(B);
  buildDress(B, T, D, g, floorY);
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const caped = buildCape(B, T, D, C, K, g, { floorY, pose: 'a' });
  return { g, T, D, K: caped ? K : null, floorY };
}
/** Worst distance (cm) between our points and v193's samples. */
const worstCm = (B: GownRig, P: ArrayLike<number>, sample: Pt[]) => {
  let w = 0;
  for (const [i, x, y, z] of sample) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z));
  return w * B.P.S * 100;
};
const arr = (g: THREE.BufferGeometry) => (g.attributes.position as THREE.BufferAttribute).array as Float32Array;

test('sleeves follow her arm as v197 does: cap, long, butterfly (terno), the off-shoulder band, a cap on a strapless top', async () => {
  const B = await body();
  for (const r of REF.rows.filter((x) => x.sleeves)) {
    const { g, T } = dressed(B, r);
    for (const sd of ['L', 'R'] as const) {
      const geo = emptySleeve(), on = buildGownSleeve(B, T, sd, g, geo), ref = r.sleeves![sd];
      assert.equal(on, !!ref, `${r.name} ${sd}: worn`);
      if (ref) assert.ok(worstCm(B, arr(geo), ref) < 0.1, `${r.name} ${sd}: within 1 mm of v193 (worst ${worstCm(B, arr(geo), ref).toFixed(2)} cm)`);
    }
  }
  assert.equal(gownSleeveKind({ sleeve: 'none', neck: 'off' }), 'band');
  assert.equal(gownSleeveKind({ sleeve: 'none', neck: 'v' }), null);
});

test('the veil hangs as v197 does in every style and length (from the crown), the blusher back or over: over the head, the body, a train and a back cape; a mantilla has lace all round its edge; the Juliet cap', async () => {
  const B = await body();
  for (const r of REF.rows.filter((x) => x.veil)) {
    const { g, T, D, K, floorY } = dressed(B, r), out = emptyVeil(), shown = buildGownVeil(B, T, D, K, g, out, floorY);
    assert.equal(shown.veil, true, r.name);
    assert.ok(worstCm(B, arr(out.geo), r.veil!) < 0.1, `${r.name}: within 1 mm of v199 (worst ${worstCm(B, arr(out.geo), r.veil!).toFixed(2)} cm)`);
    assert.equal(shown.edge, !!r.edge, `${r.name}: lace edge`);
    if (r.edge) assert.ok(worstCm(B, arr(out.edge), r.edge) < 0.1, `${r.name}: the edge (worst ${worstCm(B, arr(out.edge), r.edge).toFixed(2)} cm)`);
    assert.equal(shown.cap, !!r.cap, `${r.name}: Juliet cap`);
    if (r.cap) assert.ok(worstCm(B, arr(out.cap), r.cap) < 0.1, `${r.name}: the cap (worst ${worstCm(B, arr(out.cap), r.cap).toFixed(2)} cm)`);
  }
});

test('the veil keeps outside the gown below the head: within 1 mm over every skirt (v199 keeps it 4 mm outside the drawn skirt to the floor)', async () => {
  const B = await body();
  for (const sil of ['mermaid', 'sheath', 'aline'] as const) {
    const { g, T, D, K, floorY } = dressed(B, { name: `veil-${sil}`, hem: 'floor', gown: { sil, veil: 'cathedral', veilStyle: 'classic' } });
    const out = emptyVeil();
    buildGownVeil(B, T, D, K, g, out, floorY);
    const P = arr(out.geo), DP = arr(D.geo!), N = RING_N, DTH = (2 * Math.PI) / N, r0 = Math.min(D.rows - 2, D.nb + 1), rS = Math.min(D.rows, 2 + D.nb + D.ns);
    const czAt = (y: number) => { const f = Math.min(Math.max((y - T.y0) / SLICE_DY, 0), T.n - 1.001), j = f | 0; return T.cz[j]! + (T.cz[j + 1]! - T.cz[j]!) * (f - j); };
    // The skirt as drawn, measured independently: its reach from her centre line at the veil vertex's height and
    // angle (every drawn strip spanning that height within half a ring step).
    const drawnAt = (x: number, y: number, z: number) => {
      const a = Math.atan2(x, z - czAt(y));
      let m = 0;
      for (let r = r0; r < rS - 1; r++) for (let q = 0; q < N; q++) {
        const p1 = (r * N + q) * 3, p2 = p1 + N * 3, y1 = DP[p1 + 1]!, y2 = DP[p2 + 1]!;
        if (y < Math.min(y1, y2) || y > Math.max(y1, y2) || y1 === y2) continue;
        const u = (y - y1) / (y2 - y1), sx = DP[p1]! + (DP[p2]! - DP[p1]!) * u, sz = DP[p1 + 2]! + (DP[p2 + 2]! - DP[p1 + 2]!) * u - czAt(y);
        let d = Math.abs(Math.atan2(sx, sz) - a);
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d <= DTH / 2) m = Math.max(m, Math.hypot(sx, sz));
      }
      return m;
    };
    let worst = 0;
    for (let i = 0; i < P.length / 3; i++) {
      const x = P[i * 3]!, y = P[i * 3 + 1]!, z = P[i * 3 + 2]!;
      if (y > T.yS + 0.3 || y < T.yHem) continue;
      const m = drawnAt(x, y, z);
      if (m) worst = Math.max(worst, m - Math.hypot(x, z - czAt(y)));
    }
    assert.ok(worst * B.P.S * 100 < 0.1, `${sil}: ${(worst * B.P.S * 100).toFixed(2)} cm inside the skirt as drawn`);
  }
});

test('the back closure as v197 builds it: zipper, covered buttons, a lace-up over its modesty panel with its eyelets and ribbon', async () => {
  const B = await body();
  for (const r of REF.rows.filter((x) => x.closure)) {
    const { g, T, D } = dressed(B, r), c = buildGownClosure(B, T, D.L, g)!, ref = r.closure!;
    const ours = [c.modesty, c.eyelets, c.cord, c.cloth].filter((x): x is THREE.BufferGeometry => !!x);
    assert.equal(ours.length, ref.length, `${r.name}: pieces`);
    // v197 adds the modesty panel, the eyelets and the ribbon first, then the cloth.
    for (const [k, geo] of ours.entries()) {
      assert.equal(geo.attributes.position!.count, ref[k]!.count, `${r.name}: vertices`);
      geo.computeBoundingBox();
      const bb = geo.boundingBox!, d = Math.max(...bb.min.toArray().map((v, j) => Math.abs(v - ref[k]!.min[j]!)), ...bb.max.toArray().map((v, j) => Math.abs(v - ref[k]!.max[j]!)));
      assert.ok(d * B.P.S * 100 < 0.1, `${r.name}: placed within 1 mm (${(d * B.P.S * 100).toFixed(2)} cm)`);
    }
  }
});

test('a lace-up needs about 15 cm of back above the waist (v197): the deepest back is too low, a modest one laces', async () => {
  const B = await body();
  const deepest = dressed(B, { name: 'deepest', hem: 'floor', gown: { back: 'v', backT: 1, closure: 'lace' } });
  assert.equal(gownLaceUpFits(B, deepest.T, deepest.D.L, deepest.g), false);
  const modest = dressed(B, { name: 'modest', hem: 'floor', gown: { back: 'scoop', backT: 0.2, closure: 'lace' } });
  assert.equal(gownLaceUpFits(B, modest.T, modest.D.L, modest.g), true);
  // A back cut 3 cm below the waist leaves nothing to close at all.
  const T = { ...deepest.T, top: Float32Array.from(deepest.T.top) };
  T.top[T.top.length / 2] = BODY_K.yWaist - 0.03;
  assert.equal(buildGownClosure(B, T, deepest.D.L, deepest.g), null, 'and the lace-up is not built');
});

test('her shoes as v197 fits them: under her own foot at 8 cm, the stiletto straight to the floor', async () => {
  const B = await body();
  const r = REF.rows.find((x) => x.shoes)!;
  const pose = r.poseQ!.map((q) => (q ? new THREE.Quaternion(q[0], q[1], q[2], q[3]) : null));
  computeBones(B, pose, r.heelT!);
  skin(B);
  try {
    const floorY = floorOf(B);
    assert.ok(Math.abs(floorY - r.floorY!) * B.P.S * 100 < 0.1, `floor ${floorY} vs ${r.floorY}`);
    const model = parseGownShoe(JSON.parse(readFileSync(join(PUB, 'shoe-pump.json'), 'utf8')));
    const shoes = fitGownShoes(B, model);
    poseGownShoes(B, shoes, floorY);
    // v193's order: each foot's heel, insole and pump, left then right.
    const ours = (['L', 'R'] as const).flatMap((sd) => shoes[sd]!.parts.map((p) => arr(p.g)));
    assert.equal(ours.length, r.shoes!.length);
    for (const [k, P] of ours.entries()) assert.ok(worstCm(B, P, r.shoes![k]!) < 0.1, `shoe part ${k}: within 1 mm (worst ${worstCm(B, P, r.shoes![k]!).toFixed(2)} cm)`);
  } finally {
    computeBones(B, null);
    skin(B);
  }
});

type FlutterRow = { name: string; hem: GownConfig['hem']; gown: Partial<GownConfig>; metres: number; flutterM: number; sleeves: { L: Pt[] | null; R: Pt[] | null } };
const FLUTTER = JSON.parse(readFileSync(join(__dirname, 'v199-flutter.fixture.json'), 'utf8')) as { rows: FlutterRow[] };

test('flutter sleeves (v197) hang as the prototype hangs them, and their gown-fabric metres join the outer fabric exactly', async () => {
  const B = await body();
  for (const r of FLUTTER.rows) {
    const { g, T, D, K } = dressed(B, { name: r.name, hem: r.hem, gown: r.gown });
    const geos: (THREE.BufferGeometry | null)[] = [];
    for (const sd of ['L', 'R'] as const) {
      const geo = emptySleeve(), on = buildGownSleeve(B, T, sd, g, geo), ref = r.sleeves[sd];
      assert.equal(on, !!ref, `${r.name} ${sd}: worn`);
      if (ref) assert.ok(worstCm(B, arr(geo), ref) < 0.1, `${r.name} ${sd}: within 1 mm of v195 (worst ${worstCm(B, arr(geo), ref).toFixed(2)} cm)`);
      geos.push(on ? geo : null);
    }
    const fm = g.sleeve === 'flutter' ? flutterMetres(B, geos) : 0;
    assert.equal(fm, r.flutterM, `${r.name}: flutter metres`);
    const inGown = g.sleeve === 'flutter' && g.sleeveFab === 'fabric' && !g.accentFabric && !g.accentHex;
    assert.equal(fabricMetres(B, D, K, inGown ? fm : 0), r.metres, `${r.name}: outer fabric with the flutter sleeves`);
  }
});

test('flutter cloth never goes into her skin: within the 7 mm ease less 20 %, on two bodies', async () => {
  const B = await body();
  const before = { ...B.vals };
  try {
    for (const vals of [{}, { bust: 110, underbust: 92, waist: 96, hips: 118, weight: 82 }]) {
      Object.assign(B.vals, before, vals);
      solveGownBody(B);
      const { g, T } = dressed(B, { name: 'flutter', hem: 'floor', gown: { sleeve: 'flutter', neck: 'bateau' } });
      for (const sd of ['L', 'R'] as const) {
        const geo = emptySleeve();
        buildGownSleeve(B, T, sd, g, geo);
        const P = arr(geo), V = B.V;
        let worst = 0;
        for (let o = 0; o < P.length; o += 3) {
          // Nearest skin vertex above the waist: the cloth must stand outside it along its normal.
          let bd = 1e9, bi = -1;
          for (let i = 0; i < B.n; i++) { if (V[i * 3 + 1]! < BODY_K.yWaist) continue; const dd = (P[o]! - V[i * 3]!) ** 2 + (P[o + 1]! - V[i * 3 + 1]!) ** 2 + (P[o + 2]! - V[i * 3 + 2]!) ** 2; if (dd < bd) { bd = dd; bi = i; } }
          const NM = B.geo.attributes.normal!.array as Float32Array, nl = Math.hypot(NM[bi * 3]!, NM[bi * 3 + 1]!, NM[bi * 3 + 2]!) || 1;
          const sdist = ((P[o]! - V[bi * 3]!) * NM[bi * 3]! + (P[o + 1]! - V[bi * 3 + 1]!) * NM[bi * 3 + 1]! + (P[o + 2]! - V[bi * 3 + 2]!) * NM[bi * 3 + 2]!) / nl;
          worst = Math.max(worst, -sdist);
        }
        assert.ok(worst * B.P.S * 100 < 0.1, `${sd}: ${(worst * B.P.S * 100).toFixed(2)} cm inside her skin`);
      }
    }
  } finally {
    Object.assign(B.vals, before);
    solveGownBody(B);
  }
});

test('flutter pairings (v195): off-shoulder on a sweetheart, no side cape or capelet over them, sheer chiffon on an opaque gown', () => {
  const a = gownChoose(startingGownConfig(), { key: 'sleeve', value: 'flutter' });
  assert.equal(a.config.neck, 'off', 'a sweetheart becomes off-shoulder');
  assert.equal(a.config.sleeveFab, 'chiffon', 'satin is opaque: the flutter is sheer chiffon');
  assert.equal(a.tell, true);
  assert.deepEqual(a.notes, ['Flutter sleeves hang from the shoulder line, so the neckline is now off-shoulder.'], 'one line, as v195');
  assert.equal(gownChoose({ ...startingGownConfig(), neck: 'bateau' }, { key: 'sleeve', value: 'flutter' }).notes[0], 'Flutter sleeves are made in sheer chiffon, so her arm shows through. Change it under "Sleeves made of".');
  const b = gownChoose({ ...startingGownConfig(), neck: 'bateau', cape: 'capelet' }, { key: 'sleeve', value: 'flutter' });
  assert.equal(b.config.cape, 'none');
  const c = gownChoose({ ...startingGownConfig(), neck: 'bateau', sleeve: 'flutter' }, { key: 'cape', value: 'side' });
  assert.equal(c.config.sleeve, 'none');
  assert.equal(gownChoose({ ...startingGownConfig(), neck: 'bateau', sleeve: 'flutter' }, { key: 'cape', value: 'back' }).config.sleeve, 'flutter', 'a back cape leaves them');
  assert.equal(gownChoose({ ...startingGownConfig(), neck: 'off', sleeve: 'flutter' }, { key: 'neck', value: 'sweetheart' }).config.sleeve, 'none');
  const terno = gownChoose({ ...startingGownConfig(), sil: 'terno', sleeve: 'butterfly', neck: 'bateau' }, { key: 'sleeve', value: 'flutter' });
  assert.deepEqual(terno.notes[0], 'Flutter sleeves now, in place of the butterfly sleeves the Filipiniana comes with.');
  assert.equal(gownChoose({ ...startingGownConfig(), fabric: 'chiffon', neck: 'bateau' }, { key: 'sleeve', value: 'flutter' }).config.sleeveFab, 'fabric', 'a sheer gown keeps its own fabric');
});
