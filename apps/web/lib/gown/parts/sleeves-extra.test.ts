/**
 * 👗 gown/parts/sleeves-extra — v203's puff, bishop and Juliet sleeves, the ruffle band (and its piece across the back),
 * cape sleeves and the over-robe (with its own sleeves), held to prototype v203's own numbers (`v203-sleeves.fixture.json`,
 * captured from the prototype itself): where every sleeve lies, the cape panels, the fabric, the words and the rules.
 * And "clothes follow the body": no sleeve sinks into her.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GOWN_STOCK_FABRICS, gownCapeKind, gownSleeveIsExtra, startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownChoose, gownApplyLook, gownHiddenChoices } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { CAPE_COLS, CAPE_ROWS, buildCape, capeMetres, emptyCape, gownCapeShown } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownSleeve, emptySleeve } from './sleeves';
import { GOWN_SLEEVE_GATHER, buildGownRobeSleeve, buildGownRuffleBack, emptyRuffleBack, gownCapeSay, gownSleeveMetres, gownSleeveSay } from './sleeves-extra';

type Pt = [number, number, number, number];
type Side = 'L' | 'R';
type Row = {
  name: string; look: Partial<GownLook>; st: Partial<GownConfig>; gown: Partial<GownConfig>; lite: boolean;
  sleeves: Record<Side, Pt[] | null>; robe: Record<Side, Pt[] | null>; back: Pt[] | null; metres: number; robeM: number;
  capeVisible: boolean; capeM: number; sample?: Pt[]; parts?: { NJ: number; vo: number; j0: number[]; tops: number[]; hems: number[] }[]; groups?: [number, number, number][]; nUsed?: number; edgeL?: number;
  sums: Record<'L' | 'R' | 'back' | 'robeL' | 'robeR', [number, number, number] | null>;
  reachCm: number; robeReachCm: number; say: string; capeSay: string; clip: Record<string, { n: number; bad: number; worstMm: number }>;
};
type Rule = { name: string; look: Partial<GownLook>; k: keyof GownConfig; v: string; before: Partial<GownConfig>; after: Partial<GownConfig>; hint: string; buttons: string[]; robeBtn: string; detRow: boolean; robeRow: boolean; why: string; labels: (string | null)[] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v203-sleeves.fixture.json'), 'utf8')) as { rows: Row[]; rules: Rule[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const arr = (g: THREE.BufferGeometry) => (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
const worstCm = (B: GownRig, P: ArrayLike<number>, sample: Pt[]) => {
  let w = 0;
  for (const [i, x, y, z] of sample) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z));
  return w * B.P.S * 100;
};

// As the prototype was captured: an A-line with no veil, cape or sleeves, the look, then the choices set as given.
const lookOf = (look: Partial<GownLook>) => gownApplyLook(startingGownConfig(), { slits: [], cuts: [], veil: 'none', sleeve: 'none', cape: 'none', sil: 'aline', ...look } as Partial<GownLook>);
const designOf = (r: Pick<Row, 'look' | 'st'>): GownConfig =>
  ({ ...lookOf(r.look), capeFab: null, capeLen: null, capeEdge: null, capeFasten: null, capeCol: 'match', sleeveDet: 'sewn', robeSl: 'long', ...r.st, hem: 'floor', hemCm: 0 }) as GownConfig;

/** The stage's order: the gown, the sleeves, the ruffle across the back, the over-robe's sleeves, then the cape over them. */
function worn(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  const floorY = floorOf(B);
  buildDress(B, T, D, g, floorY);
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const sl: Partial<Record<Side, THREE.BufferGeometry>> = {}, slP: Partial<Record<Side, Float32Array>> = {};
  for (const sd of ['L', 'R'] as const) { const geo = emptySleeve(); if (buildGownSleeve(B, T, sd, g, geo)) { sl[sd] = geo; slP[sd] = arr(geo); } }
  let back: THREE.BufferGeometry | null = null;
  if (g.sleeve === 'ruffle' && slP.L && slP.R) {
    back = emptyRuffleBack();
    buildGownRuffleBack(B, T, { L: slP.L, R: slP.R }, arr(back), (back.attributes.uv as THREE.BufferAttribute).array as Float32Array);
  }
  const robe: Partial<Record<Side, THREE.BufferGeometry>> = {}, robeP: Partial<Record<Side, Float32Array>> = {};
  if (gownCapeKind(g) === 'robe' && gownCapeShown(g, 'a')) for (const sd of ['L', 'R'] as const) {
    const geo = emptySleeve();
    buildGownRobeSleeve(B, T, sd, g, slP[sd] ?? null, arr(geo), (geo.attributes.uv as THREE.BufferAttribute).array as Float32Array);
    geo.computeVertexNormals();
    robe[sd] = geo; robeP[sd] = arr(geo);
  }
  const hung = buildCape(B, T, D, C, K, g, { floorY, pose: 'a', sleeves: slP, robeSleeves: robeP });
  return { T, sl, back, robe, K, hung };
}
const piece = (g: THREE.BufferGeometry | null | undefined) => (g ? { pos: arr(g), index: g.index!.array } : null);

test('v203 sleeves lie on her as the prototype lays them: puff, bishop, Juliet, the ruffle band and its back, cape sleeves, the over-robe', async () => {
  const B = await body();
  for (const r of REF.rows) {
    assert.equal(r.lite, false, `${r.name}: captured at rest`);
    const g = designOf(r), w = worn(B, g);
    for (const sd of ['L', 'R'] as const) {
      const ref = r.sleeves[sd], geo = w.sl[sd];
      assert.equal(!!geo, !!ref, `${r.name} ${sd}: sleeve worn`);
      if (ref && geo) assert.ok(worstCm(B, arr(geo), ref) < 0.1, `${r.name} ${sd}: sleeve within 1 mm of v203 (worst ${worstCm(B, arr(geo), ref).toFixed(2)} cm)`);
      const rr = r.robe[sd], rg = w.robe[sd];
      assert.equal(!!rg, !!rr, `${r.name} ${sd}: over-robe sleeve`);
      if (rr && rg) assert.ok(worstCm(B, arr(rg), rr) < 0.1, `${r.name} ${sd}: over-robe sleeve within 1 mm (worst ${worstCm(B, arr(rg), rr).toFixed(2)} cm)`);
    }
    assert.equal(!!w.back, !!r.back, `${r.name}: the ruffle across the back`);
    if (r.back && w.back) assert.ok(worstCm(B, arr(w.back), r.back) < 0.1, `${r.name}: the back ruffle within 1 mm (worst ${worstCm(B, arr(w.back), r.back).toFixed(2)} cm)`);
    // Every vertex, not only the sample: two sums over the whole mesh (a point pressed flat between her arm and body moves them).
    for (const [nm, geo] of [['L', w.sl.L], ['R', w.sl.R], ['back', w.back], ['robeL', w.robe.L], ['robeR', w.robe.R]] as const) {
      const ref = r.sums[nm];
      assert.equal(!!geo, !!ref, `${r.name} ${nm}: drawn`);
      if (!geo || !ref) continue;
      const P = arr(geo);
      let t = 0, u = 0;
      for (let i = 0; i < P.length; i += 3) { t += P[i]! + 2 * P[i + 1]! + 3 * P[i + 2]!; u += Math.abs(P[i]! - P[i + 2]!); }
      assert.equal(P.length / 3, ref[2], `${r.name} ${nm}: vertices`);
      assert.ok(Math.abs(t - ref[0]) < 2e-3 && Math.abs(u - ref[1]) < 2e-3, `${r.name} ${nm}: every vertex as v203 (sums ${t.toFixed(5)} ${u.toFixed(5)} vs ${ref[0]} ${ref[1]})`);
    }
    // The fabric for the pair, from the real panels.
    const m = gownSleeveIsExtra(g.sleeve) ? gownSleeveMetres(B, [piece(w.sl.L), piece(w.sl.R), g.sleeve === 'ruffle' ? piece(w.back) : null], GOWN_SLEEVE_GATHER[g.sleeve]) : 0;
    assert.equal(m, r.metres, `${r.name}: sleeve metres`);
    const rm = w.robe.L ? gownSleeveMetres(B, [piece(w.robe.L), piece(w.robe.R)], g.robeSl === 'puff' ? 1.8 : 1.2) : 0;
    assert.equal(rm, r.robeM, `${r.name}: over-robe sleeve metres`);
    // The cape panels: cape sleeves (one a side, from the band) and the over-robe (open at the front).
    assert.equal(w.hung, r.capeVisible, `${r.name}: cape hung`);
    assert.ok(Math.abs(capeMetres(B, w.K) - r.capeM) < 1e-3, `${r.name}: cape metres ${capeMetres(B, w.K)} vs ${r.capeM}`);
    if (r.capeVisible && r.parts && r.sample) {
      assert.equal(w.K.parts.length, r.parts.length, `${r.name}: panels`);
      for (const [p, ref] of r.parts.entries()) {
        const I = w.K.parts[p]!;
        assert.equal(I.ys.length, ref.NJ, `${r.name} panel ${p}: lattice rows`);
        assert.deepEqual(Array.from(I.j0).filter((_, c) => c % 10 === 0), ref.j0, `${r.name} panel ${p}: top rows`);
        for (const [k, v] of ref.tops.entries()) assert.ok(Math.abs(I.tops[k * 10]! - v) < 1e-4, `${r.name} panel ${p}: top edge`);
        for (const [k, v] of ref.hems.entries()) assert.ok(Math.abs(I.hems[k * 10]! - v) < 1e-4, `${r.name} panel ${p}: hem`);
      }
      assert.equal(w.K.nUsed, r.nUsed, `${r.name}: vertices in use`);
      assert.deepEqual(w.K.geo.groups.map((x) => [x.start, x.count, x.materialIndex]), r.groups, `${r.name}: groups`);
      const rest = w.K.geo.attributes.rest!.array as Float32Array, trim0 = 2 * CAPE_ROWS * CAPE_COLS;
      let worst = 0;
      for (const [i, x, y, z] of r.sample) if (i < trim0) worst = Math.max(worst, Math.hypot(rest[i * 3]! - x, rest[i * 3 + 1]! - y, rest[i * 3 + 2]! - z));
      assert.ok(worst * B.P.S * 100 < 0.1, `${r.name}: the cape within 1 mm of v203 (worst ${(worst * B.P.S * 100).toFixed(2)} cm)`);
    }
    // The words: the summary's sleeve line (satin, as captured) and the cape line.
    assert.equal(gownSleeveSay(g, GOWN_STOCK_FABRICS.find((x) => x.id === g.fabric)!.label.toLowerCase()), r.say, `${r.name}: sleeves in words`);
    assert.equal(gownCapeSay(g), r.capeSay, `${r.name}: cape in words`);
  }
});

/** Every point against her whole skin (the nearest skin vertex, along its normal), in mm: negative = inside her (v203 `slxClip`). */
function deepestMm(B: GownRig, P: ArrayLike<number>): number {
  const V = B.V, NM = B.geo.attributes.normal!.array as Float32Array, h = 0.03 / B.P.S, grid = new Map<number, number[]>(), mm = B.P.S * 1000;
  const key = (x: number, y: number, z: number) => Math.floor(x / h) + 500 + 1000 * (Math.floor(y / h) + 500) + 1e6 * (Math.floor(z / h) + 500);
  for (let i = 0; i < B.n; i++) { const k = key(V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!); let L = grid.get(k); if (!L) grid.set(k, (L = [])); L.push(i); }
  let worst = 0;
  for (let o = 0; o < P.length; o += 3) {
    const x = P[o]!, y = P[o + 1]!, z = P[o + 2]!;
    let bd = 1e9, bi = -1;
    for (let g = 0; g <= 4; g++) {
      for (let dx = -g; dx <= g; dx++) for (let dy = -g; dy <= g; dy++) for (let dz = -g; dz <= g; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < g) continue;
        for (const i of grid.get(key(x + dx * h, y + dy * h, z + dz * h)) ?? []) { const d = (x - V[i * 3]!) ** 2 + (y - V[i * 3 + 1]!) ** 2 + (z - V[i * 3 + 2]!) ** 2; if (d < bd) { bd = d; bi = i; } }
      }
      if (bi >= 0 && bd <= (g * h) ** 2) break;
    }
    if (bi < 0) continue;
    const nl = Math.hypot(NM[bi * 3]!, NM[bi * 3 + 1]!, NM[bi * 3 + 2]!) || 1;
    worst = Math.min(worst, (((x - V[bi * 3]!) * NM[bi * 3]! + (y - V[bi * 3 + 1]!) * NM[bi * 3 + 1]! + (z - V[bi * 3 + 2]!) * NM[bi * 3 + 2]!) / nl) * mm);
  }
  return worst;
}

test('clothes follow the body: no new sleeve, ruffle back or over-robe sleeve sinks into her (the prototype measures 0 too)', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = designOf(r);
    // v203's own long detachable sleeve on an off-shoulder neckline dips into her at the band (the prototype measures it
    // too); that is the long sleeve, not one of the new ones.
    if (g.sleeve === 'long') { assert.ok(r.clip.L!.bad > 0, 'the prototype records the long sleeve dipping in'); continue; }
    const w = worn(B, g);
    for (const [nm, geo] of [['L', w.sl.L], ['R', w.sl.R], ['back', w.back], ['robeL', w.robe.L], ['robeR', w.robe.R]] as const) {
      if (!geo) continue;
      assert.equal(r.clip[nm]?.bad, 0, `${r.name} ${nm}: the prototype measures nothing inside her`);
      const d = deepestMm(B, arr(geo));
      assert.ok(d >= -2, `${r.name} ${nm}: never more than 2 mm into her skin (worst ${d.toFixed(1)} mm)`);
    }
  }
});

// The rules: the same start and the same one choice give the same design and the same words.
const RULE_KEYS = ['neck', 'neckT', 'sleeve', 'sleeveDet', 'robeSl', 'cape', 'capeFab', 'capeLen', 'capeEdge', 'capeFasten', 'straps', 'sil', 'sleeveFab'] as const;
test('v203 rules, word for word: cape sleeves and capes, the over-robe, halter and one-shoulder straps, the ruffle band, the Filipiniana, detachable', () => {
  for (const r of REF.rules) {
    const g = designOf({ look: r.look, st: {} });
    for (const k of RULE_KEYS) assert.deepEqual(g[k] ?? null, r.before[k] ?? null, `${r.name}: starts as the prototype (${k})`);
    const out = gownChoose(g, { key: r.k, value: r.v } as Parameters<typeof gownChoose>[1]);
    for (const k of RULE_KEYS) assert.deepEqual(out.config[k] ?? null, r.after[k] ?? null, `${r.name}: ${k} after`);
    assert.equal(out.notes.join(' '), r.hint, `${r.name}: the line she reads`);
  }
});

test('v203 shows what fits and hides what does not: the sleeve list, the over-robe, how sleeves are worn, the over-robe sleeves, the why line, the cape names', () => {
  for (const r of REF.rules) {
    const g = gownChoose(designOf({ look: r.look, st: {} }), { key: r.k, value: r.v } as Parameters<typeof gownChoose>[1]).config, h = gownHiddenChoices(g);
    for (const b of r.buttons) {
      const [v, ...flags] = b.split(':');
      // The new sleeves: hidden where they cannot be, greyed (`ctx-off`) with a halter or one-shoulder strap. The older
      // sleeves' chips follow their own (earlier) rules, held in their own tests.
      if (gownSleeveIsExtra(v as GownConfig['sleeve'])) {
        assert.equal(h.sleeve.includes(v!), flags.includes('hidden'), `${r.name}: ${v} hidden`);
        assert.equal(h.sleeveDim.includes(v!), flags.includes('off'), `${r.name}: ${v} greyed`);
      } else if (g.cape === 'robe' && (v === 'flutter' || v === 'butterfly')) assert.ok(flags.includes('hidden') && h.sleeve.includes(v), `${r.name}: the over-robe has its own sleeves (no ${v})`);
    }
    assert.equal(h.cape.includes('robe'), r.robeBtn === 'hidden', `${r.name}: the over-robe choice`);
    assert.equal(!h.sleeveDet, r.detRow, `${r.name}: how the sleeves are worn`);
    assert.equal(!h.robeSl, r.robeRow, `${r.name}: the over-robe sleeves`);
    assert.equal(h.sleeveWhy, r.why, `${r.name}: the why line`);
    assert.equal(`${h.capeLabel} made of`, r.labels[0], `${r.name}: cape details named`);
  }
});
