/**
 * 👗 gown/parts/straps — shoulder straps, the scalloped top edge and the plunge to the waist, held to prototype v202's
 * own numbers (`v202-straps.fixture.json`), and its rules said word for word.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeGownConfig, startingGownConfig, type GownConfig, type GownOffer } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { solveGownBody } from '../body/solve';
import { gownApplyLook, gownChoose, gownHiddenChoices } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { gownCapeStrapNeeded } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { gownBackCapT, gownStrapFrontAngle, neckTop } from '../dress/lines';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { GOWN_ILLU_MAP, buildGownIllu, gownIlluMetres, paintGownIllu, type GownIlluCanvas } from './illusion';
import { buildGownStraps, emptyStraps, gownStrapClip, gownStrapQuantities, gownStrapSummary } from './straps';

type P3 = [number, number, number];
type Row = {
  name: string; look: Partial<GownConfig>; gown: Partial<GownConfig>; kind: string; on: boolean; cami: boolean; mesh: boolean; scallop: boolean; strapA: number; capT: number; capeStrap: boolean;
  top: number[]; neck: number[]; zoneOn: boolean; quote: [string, string, number, string][]; summary: string[];
  paths?: P3[][]; len?: number; beads?: number; nv?: number; pos?: number[]; groups?: [number, number, number][];
  y?: [number, number]; lo?: number[]; ltop?: number[]; blue?: [number, number, number, number][]; metres?: number;
};
type Scen = { name: string; look: Partial<GownConfig>; start: Partial<GownConfig>; raw: number; steps: { k: keyof GownConfig; v: unknown; note: string; gown: Partial<GownConfig> }[] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v202-straps.fixture.json'), 'utf8')) as { rows: Row[]; scen: Scen[] };
const OFFER: GownOffer = { fabricTypes: ['satin', 'crepe', 'chiffon'], fabricRefs: [], laceRefs: [], lookRefs: [] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
function dressed(B: GownRig, g: GownConfig) {
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B));
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { T, D };
}
// As the prototype was captured: the look (no veil, sleeves, cape or cut-outs), then what it left.
const designOf = (look: Partial<GownConfig>, st: Partial<GownConfig>) =>
  ({ ...gownApplyLook(startingGownConfig(), { veil: 'none', sleeve: 'none', cape: 'none', ...look }), ...st, hem: 'floor', hemCm: 0 }) as GownConfig;
/** A 2D context that keeps the scallops' columns (the blue fills) and draws nothing. */
function blueOf(): { g: GownIlluCanvas; calls: number[][] } {
  const calls: number[][] = [];
  let fill = '';
  const g = {
    globalCompositeOperation: 'source-over', globalAlpha: 1,
    set fillStyle(v: string) { fill = v; }, get fillStyle() { return fill; },
    fillRect: (x: number, y: number, w: number, h: number) => { if (fill === '#00f') calls.push([x, y, w, h]); },
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {}, fill: () => {},
  } as unknown as GownIlluCanvas;
  return { g, calls };
}

test('the straps as v202 lays them: every kind over her shoulders, the necklines they make, within 1 mm', async () => {
  const B = await body(), cmU = B.P.S * 100;
  for (const r of REF.rows) {
    const g = designOf(r.look, r.gown), { T, D } = dressed(B, g), L = D.L!, S = emptyStraps();
    // The bodice's top edge (the camisole line of a V held by straps, the plunge's point) and the line as cut.
    r.top.forEach((v, k) => assert.ok(Math.abs(T.top[k * 2]! - v) * cmU < 0.1, `${r.name}: top edge ${k * 2} (${T.top[k * 2]} vs ${v})`));
    r.neck.forEach((v, i) => assert.ok(Math.abs(neckTop(g, (i / 32) * Math.PI, L) - v) * cmU < 0.1, `${r.name}: neckline at ${i}/32`));
    assert.ok(Math.abs(gownStrapFrontAngle(g, L) - r.strapA) < 1e-4, `${r.name}: where a strap meets the bodice`);
    assert.ok(Math.abs(gownBackCapT(g, L) - r.capT) < 1e-4, `${r.name}: the bra-line back cap (${gownBackCapT(g, L)} vs ${r.capT})`);
    assert.equal(gownCapeStrapNeeded(g), r.capeStrap, `${r.name}: a cape's narrow strap`);
    const on = buildGownStraps(B, T, D, g, S);
    assert.equal(S.kind, r.kind, `${r.name}: kind`);
    assert.equal(on, r.on, `${r.name}: drawn`);
    assert.deepEqual(gownStrapSummary(g, false), r.summary, `${r.name}: the designer's lines`);
    if (r.on) {
      assert.equal(S.paths.length, r.paths!.length, `${r.name}: straps`);
      S.paths.forEach((P, i) => {
        assert.equal(P.length, r.paths![i]!.length, `${r.name}: strap ${i}'s points`);
        P.forEach((p, k) => assert.ok(Math.hypot(p[0] - r.paths![i]![k]![0], p[1] - r.paths![i]![k]![1], p[2] - r.paths![i]![k]![2]) * cmU < 0.1, `${r.name}: strap ${i} point ${k}`));
      });
      assert.ok(Math.abs(S.len - r.len!) < 0.001, `${r.name}: length ${S.len} vs ${r.len}`);
      assert.equal(S.beads, r.beads, `${r.name}: beads`);
      assert.equal(S.nUsed, r.nv, `${r.name}: vertices`);
      // v202 writes each strap's rows, then its beads, the same order as here: compare vertex for vertex.
      const ours = (S.geo.attributes.position!.array as Float32Array), ref = r.pos!;
      const near = (i: number) => Math.hypot(ours[i * 3]! - ref[i * 3]!, ours[i * 3 + 1]! - ref[i * 3 + 1]!, ours[i * 3 + 2]! - ref[i * 3 + 2]!) * cmU;
      for (let i = 0; i < S.nUsed; i++) assert.ok(near(i) < 0.1, `${r.name}: vertex ${i} (${near(i).toFixed(3)} cm)`);
      // The quote's numbers (the lines themselves are worded by the quote).
      const q = gownStrapQuantities(g, S), metresRow = r.quote.find((x) => x[3] === 'm'), crystals = r.quote.find((x) => x[0] === 'bead_crystal');
      assert.equal(q.metres, metresRow![2], `${r.name}: strap metres`);
      assert.equal(q.ribbon, metresRow![0] === 'ribbon', `${r.name}: rouleau or fabric`);
      assert.equal(q.beads / 100 || 0, crystals ? crystals[2] : 0, `${r.name}: crystals`);
      assert.deepEqual(r.quote.find((x) => x[0] === 'straps')!.slice(2), [1, q.kind === 'one' ? 'strap' : 'pair']);
    }
    // The zone: the plunge's modesty mesh is sheer; the scallops are cut away (the map's blue).
    const I = buildGownIllu(B, T, D, g);
    assert.equal(I.zoneOn, r.zoneOn, `${r.name}: zone`);
    if (!r.zoneOn) continue;
    assert.ok(Math.abs(I.y0 - r.y![0]) * cmU < 0.1 && Math.abs(I.y1 - r.y![1]) * cmU < 0.1, `${r.name}: the map's range`);
    r.lo!.forEach((v, x) => { const a = I.lines!.lo[x * 8]!; assert.ok(v > 1e8 ? a > 1e8 : Math.abs(a - v) * cmU < 0.1, `${r.name}: sheer from, column ${x * 8}`); });
    r.ltop!.forEach((v, x) => assert.ok(Math.abs(I.lines!.top[x * 8]! - v) * cmU < 0.1, `${r.name}: top, column ${x * 8}`));
    assert.equal(gownIlluMetres(B, D, I), r.metres, `${r.name}: tulle metres`);
    const { g: cv, calls } = blueOf();
    paintGownIllu(cv, B, I.lines!, I.y0, I.y1, r.scallop ? T : null);
    assert.equal(calls.length, r.blue!.length, `${r.name}: scalloped columns`);
    // Rows on the map: 0.1 px is well under a millimetre on her.
    calls.forEach((c, i) => { const b = r.blue![i]!; assert.ok(c[0] === b[0] && Math.abs(c[1]! - b[1]!) < 0.1 && Math.abs(c[3]! - b[3]!) < 0.1, `${r.name}: scallop column ${c[0]} (${c[1]}, ${c[3]} vs ${b[1]}, ${b[3]})`); });
    assert.equal(GOWN_ILLU_MAP.h, 256);
  }
});

test('the straps sit on her skin: nothing more than 2 mm inside, nothing floating more than 12 mm off it, on two bodies (v199 `strapClip`)', async () => {
  const B = await body(), before = { ...B.vals };
  try {
    // The default body and v199's plus body.
    for (const vals of [{}, { height: 160, bust: 120, underbust: 96, waist: 104, hips: 124 }]) {
      Object.assign(B.vals, before, vals);
      solveGownBody(B);
      for (const [neck, straps] of [['sweetheart', 'spaghetti'], ['sweetheart', 'wide'], ['sweetheart', 'offsh'], ['sweetheart', 'one'], ['sweetheart', 'halter'], ['sweetheart', 'cross'], ['v', 'spaghetti'], ['plungewaist', 'halter']] as const) {
        const g = designOf({ neck }, { straps }), { T, D } = dressed(B, g), S = emptyStraps();
        assert.ok(buildGownStraps(B, T, D, g, S), `${neck} + ${straps}: drawn`);
        const c = gownStrapClip(B, T, S);
        assert.ok(c.n > 50 && c.bad === 0 && c.maxGapMm <= 12, `${JSON.stringify(vals)} ${neck} + ${straps}: ${JSON.stringify(c)}`);
      }
    }
  } finally {
    Object.assign(B.vals, before);
    solveGownBody(B);
  }
});

test('the v202 rules, word for word, and the server refuses what they rule out', () => {
  for (const s of REF.scen) {
    let g = designOf(s.look, s.start);
    for (const st of s.steps) {
      const out = gownChoose(g, { key: st.k, value: st.v } as Parameters<typeof gownChoose>[1], { backCapT: s.raw });
      assert.equal(out.notes.join(' '), st.note, `${s.name}: ${st.k} = ${String(st.v)}`);
      for (const [k, v] of Object.entries(st.gown)) {
        const got = out.config[k as keyof GownConfig], at = `${s.name}: ${st.k} = ${String(st.v)} leaves ${k}`;
        // The bra-line cap was captured to 5 places.
        if (typeof v === 'number' && typeof got === 'number') assert.ok(Math.abs(got - v) < 1e-4, `${at} (${got} vs ${v})`);
        else assert.deepEqual(got, v, at);
      }
      g = out.config;
    }
  }
  // What shows where.
  const at = (look: Partial<GownConfig>) => gownHiddenChoices(designOf(look, {}));
  assert.deepEqual(at({ neck: 'sweetheart' }).straps, []);
  assert.deepEqual(at({ neck: 'straight' }).straps, ['offsh']);
  assert.deepEqual(at({ neck: 'v' }).straps, ['offsh', 'one']);
  assert.deepEqual(at({ neck: 'off' }).straps, ['spaghetti', 'wide', 'one', 'halter', 'cross']);
  assert.equal(at({ neck: 'high' }).strapRow, true);
  assert.equal(at({ neck: 'bateau' }).strapRow, true);
  assert.deepEqual(at({ neck: 'plungewaist' }).straps, ['none', 'offsh', 'one']);
  assert.equal(at({ neck: 'plungewaist' }).plungeFill, false);
  assert.equal(at({ neck: 'v' }).plungeFill, true);
  assert.equal(at({ neck: 'v' }).topEdge, true);
  assert.equal(at({ neck: 'straight' }).topEdge, false);
  const halter = gownHiddenChoices(designOf({ neck: 'v' }, { straps: 'halter' }));
  assert.deepEqual([...halter.sleeve].sort(), ['butterfly', 'cap', 'flutter', 'ruffle'], 'v203: the ruffle band sits off the shoulder or on a sweetheart');
  assert.equal(halter.strapDetails, false);
  assert.equal(at({ neck: 'v' }).strapDetails, true);
  assert.equal(at({ neck: 'v' }).strapCol, true);
  // The server refuses what the rules rule out.
  const ok = (st: Partial<GownConfig>) => sanitizeGownConfig({ ...startingGownConfig(), ...st }, OFFER).ok;
  assert.equal(ok({ neck: 'v', straps: 'spaghetti' }), true);
  assert.equal(ok({ neck: 'plungewaist', straps: 'wide' }), true);
  assert.equal(ok({ neck: 'plungewaist', straps: 'none' }), false, 'a plunge to the waist needs straps');
  assert.equal(ok({ neck: 'high', straps: 'spaghetti' }), false, 'a high neck covers the shoulders');
  assert.equal(ok({ neck: 'bateau', straps: 'wide' }), false);
  assert.equal(ok({ neck: 'off', straps: 'spaghetti' }), false, 'off-shoulder takes off-shoulder straps only');
  assert.equal(ok({ neck: 'straight', straps: 'offsh' }), false);
  assert.equal(ok({ neck: 'v', straps: 'one' }), false);
  assert.equal(ok({ neck: 'v', illu: 'neck', straps: 'wide' }), false, "the illusion neckline's tulle runs over the shoulders");
  assert.equal(ok({ neck: 'sweetheart', straps: 'halter', sleeve: 'long' }), true);
  assert.equal(ok({ neck: 'v', straps: 'halter', sleeve: 'cap' }), false, 'cap sleeves need both shoulders');
  assert.equal(ok({ neck: 'off', straps: 'offsh', sleeve: 'flutter' }), true);
  assert.equal(ok({ neck: 'sweetheart', topEdge: 'scallop' }), true);
  assert.equal(ok({ neck: 'v', topEdge: 'scallop' }), false, 'scallops only on a strapless sweetheart or straight across');
  assert.equal(ok({ neck: 'plungewaist', straps: 'spaghetti', illu: 'neck' }), false);
});
