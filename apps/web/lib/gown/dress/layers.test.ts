/** 👗 gown/dress/layers — tulle as v193 has it; organza and chiffon derived from the layer's own hem and length. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOWN_LAYER_GATHER, gownLayerMetres, gownTulleMetres } from './layers';

test('tulle stays as v193 quoteLines: per petticoat for two layers, scaled by the layers', () => {
  assert.equal(gownTulleMetres('soft', 2), 6);
  assert.equal(gownTulleMetres('full', 3), 18);
  assert.equal(gownTulleMetres('none', 4), 0);
});

test('a gathered layer: hem × gather in fabric widths, each its length + 10 cm, +15 %, up to the next 10 cm', () => {
  // A 3 m hem, 1 m long: organza 4.5 m round → 3 widths of 150 cm → 3 × 1.1 × 1.15 = 3.795 → 3.8 m.
  assert.equal(gownLayerMetres('organza', 3, 1), 3.8);
  // Chiffon gathers more: 6 m round → 4 widths → 5.06 → 5.1 m.
  assert.equal(gownLayerMetres('chiffon', 3, 1), 5.1);
  // The designer's own factor and fabric width win.
  assert.equal(gownLayerMetres('chiffon', 3, 1, { gather: 1, widthCm: 300 }), 1.3);
  assert.equal(gownLayerMetres('organza', 0, 1), 0);
  assert.ok(GOWN_LAYER_GATHER.chiffon > GOWN_LAYER_GATHER.organza);
});
