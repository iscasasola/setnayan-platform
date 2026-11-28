/** 👗 gown/parts/cuts — cut-outs as v195 lays them out (`v199-cuts.fixture.json`), and the rule for hand-cut holes. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_CUT_FORBIDDEN, GOWN_STRAPLESS, startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { gownApplyLook } from '../compat';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownCuts, gownCutForbidden } from './cuts';

type Row = { name: string; gown: Partial<GownConfig>; cutY: [number, number]; cutBand: [number, number]; cutEdge: number; cutFill: number; red: number; yellow: number; note?: string };
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-cuts.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
async function dressed(over: Partial<GownConfig>) {
  const B = await body(), g = { ...gownApplyLook(startingGownConfig(), over as Partial<GownLook>), ...over } as GownConfig;
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B));
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { B, T, D, g };
}

test('cut-outs as v197 lays them out: the map range, the edge band, the edge style, the fill, a high neck\'s keyhole back and the designer\'s line', async () => {
  for (const r of REF.rows) {
    const { B, T, D, g } = await dressed(r.gown);
    const plan = buildGownCuts(B, T, D, g, GOWN_STRAPLESS.includes(g.neck))!;
    assert.ok(plan, `${r.name}: cuts`);
    assert.ok(Math.abs(plan.y0 - r.cutY[0]) < 1e-4 && Math.abs(plan.y1 - r.cutY[1]) < 1e-4, `${r.name}: range`);
    assert.ok(Math.abs(plan.band[0] - r.cutBand[0]) / r.cutBand[0] < 1e-4 && Math.abs(plan.band[1] - r.cutBand[1]) / r.cutBand[1] < 1e-4, `${r.name}: edge band ${plan.band} vs ${r.cutBand}`);
    assert.equal(plan.edge, r.cutEdge, `${r.name}: edge`);
    assert.equal(plan.fill, r.cutFill, `${r.name}: fill`);
    assert.equal(!!plan.crop, g.pieces === 'crop', `${r.name}: cropped gap`);
    assert.equal(!!plan.keyhole, r.name === 'cuts-keyhole-back', `${r.name}: keyhole back`);
    // The designer's line, word for word (v197 leaves a trailing space when no note follows).
    if (r.note) assert.equal(plan.note, r.note.replace(/\s+/g, ' ').trim(), `${r.name}: the designer's line`);
    assert.equal(plan.placed.length, g.cuts.reduce((n, id) => n + (id === 'waist' || id === 'hip' || id === 'slash' ? 2 : 1), 0), `${r.name}: placed`);
  }
  const keyhole = await dressed({ cuts: ['keyhole'] });
  assert.match(buildGownCuts(keyhole.B, keyhole.T, keyhole.D, keyhole.g, true)!.note, /needs boning on both sides/);
});

test('hand-cut holes keep off the closure strip and the band under the bust (v195 cutForbidden)', async () => {
  const { B, T, D } = await dressed({});
  const L = D.L!;
  assert.equal(gownCutForbidden(B, T, L, Math.PI, L.yW + 0.05, 2), GOWN_CUT_FORBIDDEN.diamond);
  assert.equal(gownCutForbidden(B, T, L, 0, L.yA - 0.06, 2), GOWN_CUT_FORBIDDEN.under);
  assert.equal(gownCutForbidden(B, T, L, 1.45, L.yW, 2), '', 'a side-waist hole is allowed');
});
