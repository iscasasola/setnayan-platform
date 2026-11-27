/**
 * 👗 gown/parts/trims — trims as v195 builds them (`v197-trims.fixture.json`): piping and ruffles on the neckline or the
 * hem (over a train), a two-piece's waistband and the top's hem over it, a cropped top's band, the waistline seam, the
 * fringe; and each trim's metres from the real edge, as the designer reads them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { gownApplyLook } from '../compat';
import { startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownTrims, gownTrimMetres, placeGownTrims } from './trims';

type Pt = [number, number, number, number];
type Row = { name: string; look: Partial<GownLook>; hem: GownConfig['hem']; gown: Partial<GownConfig>; lengths: string[]; meshes: { type: string; n: number; s: Pt[] | null }[] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v197-trims.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const WORD = { pipe: 'of piping', ruffle: 'of ruffle cloth', fringe: 'of fringe' } as const;

test('trims as v197 builds them: every piece within 1 mm, and the metres the designer reads', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = { ...gownApplyLook(startingGownConfig(), r.look ?? {}), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
    const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
    D.hold = feel.hold; D.foldK = feel.foldK;
    buildEnvelope(B, T);
    const floorY = floorOf(B);
    buildDress(B, T, D, g, floorY);
    writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
    const pieces = buildGownTrims(B, T, g);
    placeGownTrims(pieces, B, T, D, floorY);
    assert.equal(pieces.length, r.meshes.length, `${r.name}: pieces`);
    for (const [k, ref] of r.meshes.entries()) {
      const P = (pieces[k]!.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
      assert.equal(P.length / 3, ref.n, `${r.name} piece ${k}: vertices`);
      if (!ref.s) continue;
      let w = 0;
      for (const [i, x, y, z] of ref.s) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z));
      assert.ok(w * B.P.S * 100 < 0.1, `${r.name} piece ${k}: within 1 mm (worst ${(w * B.P.S * 100).toFixed(2)} cm)`);
    }
    const lines = gownTrimMetres(B, D, g.trims).map((m) => `${m.metres.toFixed(1)} m ${WORD[m.trim.startsWith('pipe') ? 'pipe' : m.trim.startsWith('ruffle') ? 'ruffle' : 'fringe']}`);
    assert.deepEqual(lines, r.lengths, `${r.name}: metres`);
  }
});
