/**
 * 👗 gown/parts/lace — lace placed as v195 places it (`v199-lace.fixture.json`): every motif's spot on the flat map and
 * the count that goes to the designer, for cascade, bodice, neckline edge, hem border (over a train), all over, scattered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOWN_LACES, startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownLace, drawGownMotif, type GownLaceCanvas } from './lace';
import { gownChoose, gownApplyLook } from '../compat';

type Row = { name: string; look: Partial<GownLook>; hem: GownConfig['hem']; gown: Partial<GownConfig>; countN: number; y0: number; y1: number; spots: [number, number, number][] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-lace.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
/** A 2D context that records the calls (no pixels). */
const recorder = () => {
  const calls: string[] = [];
  const g = new Proxy({} as GownLaceCanvas, { get: (_t, p) => (typeof p === 'string' && /Style|Width|Join|Cap|Operation|shadow/.test(p) ? '' : () => { calls.push(String(p)); }), set: () => true });
  return { g, calls };
};

test('lace lands where v197 puts it: every motif within 1 mm, the designer\'s count exact', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = { ...gownApplyLook(startingGownConfig(), r.look ?? {}), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
    const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
    D.hold = feel.hold; D.foldK = feel.foldK;
    buildEnvelope(B, T);
    buildDress(B, T, D, g, floorOf(B));
    writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
    const { g: ctx, calls } = recorder();
    const plan = buildGownLace(B, T, D, g, ctx)!;
    assert.ok(Math.abs(plan.y0 - r.y0) < 1e-4 && Math.abs(plan.y1 - r.y1) < 1e-4, `${r.name}: the flat map's range`);
    assert.equal(plan.spots.length, r.spots.length, `${r.name}: motifs placed`);
    assert.equal(plan.countN, r.countN, `${r.name}: the count for the designer`);
    let worst = 0;
    for (const [k, [u, y, cm]] of r.spots.entries()) {
      const s = plan.spots[k]!, G = Math.PI * 0.3 * B.P.S * 100; // a girth scale to put u in cm
      worst = Math.max(worst, Math.abs(s.u - u) * G, Math.abs(s.y - y) * B.P.S * 100, Math.abs(s.cm * s.sc - cm));
    }
    assert.ok(worst < 0.1, `${r.name}: within 1 mm (worst ${worst.toFixed(3)} cm)`);
    assert.ok(calls.filter((c) => c === 'setTransform').length >= plan.count, `${r.name}: each motif is painted`);
  }
});

test('every stock lace draws its motif', () => {
  for (const { id } of GOWN_LACES) {
    if (id === 'none') continue;
    const { g, calls } = recorder();
    drawGownMotif(g, id);
    assert.ok(calls.filter((c) => c === 'fill' || c === 'stroke').length > 5, `${id} draws`);
  }
});

test('a border lace goes on the hem unless it is on an edge already (v195)', () => {
  const a = gownChoose(startingGownConfig(), { key: 'lace', value: 'scallop' });
  assert.equal(a.config.laceAt, 'hem');
  assert.deepEqual(a.notes, ['This is border lace, so it is placed along the hem. Neckline edge works too.']);
  assert.equal(gownChoose({ ...startingGownConfig(), laceAt: 'neck' }, { key: 'lace', value: 'scallop' }).config.laceAt, 'neck');
  assert.equal(gownChoose(startingGownConfig(), { key: 'lace', value: 'floral' }).config.laceAt, 'cascade');
});
