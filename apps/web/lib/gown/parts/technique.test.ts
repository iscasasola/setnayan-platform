/**
 * 👗 gown/parts/technique — fabric techniques as real folds, held to v195 (`v199-technique.fixture.json`): ruching,
 * pintucks on the back panel, smocking on the skirt, the three drapes, darts and seams; and the designer's line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { gownApplyLook } from '../compat';
import { startingGownConfig, type GownConfig, type GownLook } from '../../gown-config';
import { TAU } from '../body/constants';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownTechShell, gownTechniqueLine } from './technique';

type Pt = [number, number, number, number];
type Row = { name: string; look: Partial<GownLook>; hem: GownConfig['hem']; gown: Partial<GownConfig>; n: number; idx: number; list: number; rest: Pt[]; pos: Pt[]; note: string };
const REF = JSON.parse(readFileSync(join(__dirname, 'v199-technique.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const worst = (B: GownRig, P: ArrayLike<number>, s: Pt[]) => { let w = 0; for (const [i, x, y, z] of s) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z)); return w * B.P.S * 100; };

test('every technique folds the cloth as v197 does, and the designer reads the same line', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = { ...gownApplyLook(startingGownConfig(), r.look ?? {}), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
    const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers);
    D.hold = feel.hold; D.foldK = feel.foldK;
    buildEnvelope(B, T);
    buildDress(B, T, D, g, floorOf(B));
    const amp = g.pleatCm / 100 / B.P.S;
    writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp });
    const S = buildGownTechShell(B, T, D, g)!;
    assert.ok(S, `${r.name}: a technique layer`);
    assert.equal(S.geo.attributes.position!.count, r.n, `${r.name}: vertices`);
    assert.equal(S.geo.index!.count, r.idx, `${r.name}: where it shows`);
    assert.equal(S.list.length, r.list, `${r.name}: points that ride the gown`);
    const rest = (S.geo.attributes.rest as THREE.BufferAttribute).array as Float32Array, pos = (S.geo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    assert.ok(worst(B, rest, r.rest) < 0.1, `${r.name}: folds within 1 mm (worst ${worst(B, rest, r.rest).toFixed(2)} cm)`);
    const used = r.pos.filter(([i]) => S.list.includes(i));
    assert.ok(worst(B, pos, used) < 0.1, `${r.name}: rides the gown within 1 mm (worst ${worst(B, pos, used).toFixed(2)} cm)`);
    assert.equal(gownTechniqueLine(g, TAU * D.hemR * B.P.S * 100), r.note, `${r.name}: the designer's line`);
  }
  const none = startingGownConfig();
  assert.equal(gownTechniqueLine(none, 300), '');
});
