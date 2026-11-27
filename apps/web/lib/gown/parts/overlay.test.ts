/**
 * 👗 gown/parts/overlay — the overlay (v195) held to the prototype's own numbers (`v195-overlay.fixture.json`):
 * asymmetric, tiered on a ball gown, cascade in the gown fabric; a back cape and a veil over it; the outer metres.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { sanitizeGownConfig, startingGownConfig, stockGownOffer, type GownConfig } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress, floorOf } from '../dress/build';
import { buildCape, emptyCape } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { fabricMetres } from '../dress/flat';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { gownChoose, gownHiddenChoices } from '../compat';
import { buildGownOverlay, gownOverlayOut, overlayMetres } from './overlay';
import { buildGownVeil, emptyVeil } from './veil';

type Pt = [number, number, number, number];
type Row = { name: string; hem: GownConfig['hem']; gown: Partial<GownConfig>; overlay: Pt[] | null; ovM: number; metres: number; cape: Pt[] | null; veil: Pt[] | null };
const REF = JSON.parse(readFileSync(join(__dirname, 'v195-overlay.fixture.json'), 'utf8')) as { rows: Row[] };
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(join(__dirname, '../../../public/gown/female.glb')); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const arr = (g: THREE.BufferGeometry, k = 'position') => (g.attributes[k] as THREE.BufferAttribute).array as Float32Array;
const worstCm = (B: GownRig, P: ArrayLike<number>, sample: Pt[]) => { let w = 0; for (const [i, x, y, z] of sample) w = Math.max(w, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y, P[i * 3 + 2]! - z)); return w * B.P.S * 100; };

test('the overlay rides the skirt as v195 lays it, and a back cape and a veil keep outside it', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = { ...startingGownConfig(), ...r.gown, hem: r.hem, hemCm: 0 } as GownConfig;
    const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
    D.hold = feel.hold; D.foldK = feel.foldK;
    buildEnvelope(B, T);
    const floorY = floorOf(B), out = gownOverlayOut(B, g.overlay);
    buildDress(B, T, D, g, floorY);
    writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
    const ov = buildGownOverlay(B, T, D, g);
    assert.ok(ov && r.overlay, `${r.name}: an overlay`);
    assert.ok(worstCm(B, arr(ov.geo, 'rest'), r.overlay!) < 0.1, `${r.name}: within 1 mm of v195 (worst ${worstCm(B, arr(ov.geo, 'rest'), r.overlay!).toFixed(2)} cm)`);
    const m = overlayMetres(B, ov);
    assert.ok(Math.abs(m - r.ovM) < 1e-3, `${r.name}: overlay metres ${m} vs ${r.ovM}`);
    const caped = buildCape(B, T, D, C, K, g, { floorY, pose: 'a', overlayOut: out });
    assert.equal(caped, !!r.cape, `${r.name}: cape`);
    if (r.cape) assert.ok(worstCm(B, arr(K.geo, 'rest'), r.cape) < 0.1, `${r.name}: the cape over the overlay (worst ${worstCm(B, arr(K.geo, 'rest'), r.cape).toFixed(2)} cm)`);
    assert.equal(fabricMetres(B, D, caped ? K : null, g.ovFab === 'gown' ? m : 0), r.metres, `${r.name}: outer fabric`);
    if (r.veil) {
      const V = emptyVeil();
      buildGownVeil(B, T, D, caped ? K : null, g, V, floorY, out);
      assert.ok(worstCm(B, arr(V.geo), r.veil) < 0.1, `${r.name}: the veil over the overlay (worst ${worstCm(B, arr(V.geo), r.veil).toFixed(2)} cm)`);
    }
  }
});

test('over a ball gown an overlay sits as soft tiers (v195): the rule, the hidden choices and the server agree', () => {
  const asym = { ...startingGownConfig(), overlay: 'asym' } as GownConfig;
  const out = gownChoose(asym, { key: 'sil', value: 'ball' });
  assert.equal(out.config.overlay, 'tiered');
  assert.equal(out.tell, true);
  assert.deepEqual(gownHiddenChoices(out.config).overlay, ['asym', 'cascade']);
  const offer = stockGownOffer();
  assert.equal(sanitizeGownConfig(out.config, offer).ok, true);
  assert.deepEqual(sanitizeGownConfig({ ...out.config, overlay: 'cascade' }, offer), { ok: false, reason: 'not_a_design' });
});
