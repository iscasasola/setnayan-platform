/**
 * 👗 gown/parts/inside — what is inside the gown, held to prototype v195's Inside view (`v207-inside.fixture.json`):
 * the layers (each its own fullness and colour), the lining, body shaping, the hoop, the boning and waist stay; the
 * names and dots "See inside" lists; the stage-by-stage reveal (v192); and the organza and chiffon metres.
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
import { GOWN_FABRIC_PROPS, gownClothFeel, gownFabricType } from '../fabric/types';
import { gownClothColour } from '../fabric/shine';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { restingCloth, writeDress } from '../dress/cloth';
import { gownLayerMetres } from '../dress/layers';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownInside, gownInsideLayerMetres, gownInsideOrder, gownInsideShown } from './inside';

type Pt = [number, number, number, number];
type Row = { name: string; look: Partial<GownLook>; gown: Partial<GownConfig>; keys: string[]; names: string[]; cols: string[]; pieces: { L: number; n: number; extra?: boolean; s: Pt[] }[] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v207-inside.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

async function inside(r: Row) {
  const B = await body();
  const g = { ...gownApplyLook(startingGownConfig(), r.look ?? {}), ...r.gown, hem: 'floor', hemCm: 0 } as GownConfig;
  const T = emptyEnvelope(), D = emptyDress(), feel = gownClothFeel(gownFabricType(g.fabric), g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  buildEnvelope(B, T);
  buildDress(B, T, D, g, floorOf(B));
  writeDress(D, T, restingCloth(), { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  return { B, g, pieces: buildGownInside(B, T, D, g, gownClothColour(g.colour, g.colourHex), GOWN_FABRIC_PROPS.satin.name) };
}

test('what is inside, as v197 shows it: the pieces, their names and dots, and every layer, lining, shaping, hoop and bone', async () => {
  for (const r of REF.rows) {
    const { B, pieces } = await inside(r);
    assert.deepEqual(pieces.map((p) => p.key), r.keys, `${r.name}: pieces`);
    assert.deepEqual(pieces.map((p) => p.name), r.names, `${r.name}: names`);
    assert.deepEqual(pieces.map((p) => hex(p.colour)), r.cols, `${r.name}: dots`);
    // v195's group order: the shells (layers, lining), the hoop rings, the bones and stay; the shaping on her body last.
    const ours: THREE.BufferGeometry[] = [];
    for (const k of ['layer', 'lining', 'hoop', 'bone', 'shape'] as const) for (const p of pieces) if (p.kind === k && p.key !== 'gown') ours.push(...p.geos);
    assert.equal(ours.length, r.pieces.length, `${r.name}: meshes`);
    for (const [k, ref] of r.pieces.entries()) {
      const P = (ours[k]!.attributes.position as THREE.BufferAttribute).array as Float32Array;
      assert.equal(P.length / 3, ref.n, `${r.name} mesh ${k}: vertices`);
      let w = 0;
      for (const [i, x, y, z] of ref.s) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z));
      assert.ok(w * B.P.S * 100 < 0.1, `${r.name} mesh ${k}: within 1 mm of v195 (worst ${(w * B.P.S * 100).toFixed(2)} cm)`);
    }
  }
});

test('the Inside stage dresses her in order (v192), and "See inside" lists the pieces outside in', async () => {
  const { pieces } = await inside(REF.rows[0]!);
  const keys = pieces.map((p) => p.key), shown = (stage: Parameters<typeof gownInsideShown>[1]) => keys.filter((k) => gownInsideShown(k, stage, new Set()));
  assert.deepEqual(shown('Body shaping'), ['shape']);
  assert.deepEqual(shown('Lining'), ['lining', 'shape']);
  assert.deepEqual(shown('Layer 1'), ['tulle1', 'lining', 'shape']);
  assert.deepEqual(shown('Layer 2'), ['tulle2', 'tulle1', 'lining', 'shape']);
  assert.deepEqual(shown('Boning'), keys.filter((k) => k !== 'gown'));
  assert.deepEqual(keys.filter((k) => gownInsideShown(k, 'See inside', new Set(['lining']))), keys.filter((k) => k !== 'lining'));
  assert.deepEqual(gownInsideOrder(pieces).map((p) => p.key), ['gown', 'tulle3', 'tulle2', 'tulle1', 'lining', 'bone', 'shape']);
});

test('organza and chiffon layers get their metres from their own hem and length (coordinator, 27 Nov)', async () => {
  const { pieces } = await inside(REF.rows[0]!);
  const organza = pieces.find((p) => p.layer?.type === 'organza')!.layer!;
  assert.ok(organza.hemM > 1.5 && organza.hemM < 4 && organza.lengthM > 0.8 && organza.lengthM < 1.4, `a floor-length A-line layer: ${organza.hemM.toFixed(2)} m round, ${organza.lengthM.toFixed(2)} m long`);
  const m = gownInsideLayerMetres(pieces);
  assert.equal(m.organzaM, Math.round(gownLayerMetres('organza', organza.hemM, organza.lengthM) * 10) / 10);
  assert.equal(m.chiffonM, 0);
  const hoop = await inside(REF.rows[1]!);
  assert.ok(gownInsideLayerMetres(hoop.pieces).chiffonM > 0, 'the chiffon layer over the hoop is counted');
});
