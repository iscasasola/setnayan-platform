/**
 * W1-B27 (supplier walk, 16 Nov 2026): the service maker opened a cake shop's card on "Per guest" — the whole feast
 * family took the caterer's defaults. Only a caterer's own kinds default to per guest; a cake, a dessert table or any
 * other non-catering kind opens on One price (`fixed`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makerDefaultsFor, supplierTypeForKind } from './service-card-maker';
import { TAXONOMY_MAP } from './taxonomy';

const basisOf = (kind: string, folder: string | null) => makerDefaultsFor(supplierTypeForKind(kind, folder), kind).pricingBasis;

test('a cake opens on One price, never Per guest', () => {
  assert.equal(basisOf('wedding_cake', 'feast'), 'fixed');
  assert.equal(basisOf('dessert_table', 'feast'), 'fixed');
  assert.equal(basisOf('cake', null), 'fixed', 'the legacy cake kind (filed under feast through its tile)');
  assert.notEqual(supplierTypeForKind('wedding_cake', 'feast'), 'caterer', 'a cake shop is "Filled for a caterer"');
});

test('a caterer still opens per guest', () => {
  assert.equal(basisOf('catering', 'feast'), 'per_pax');
  assert.equal(basisOf('catering', null), 'per_pax', 'the legacy catering kind');
  assert.equal(basisOf('crew_meals', null), 'per_pax');
});

test('every code-taxonomy feast leaf: catering tiles per guest, the rest One price', () => {
  const CATERING_TILES = new Set(['catering', 'crew_meals', 'stations']);
  let n = 0;
  for (const [key, meta] of Object.entries(TAXONOMY_MAP)) {
    if (meta.folder !== 'feast') continue;
    n++;
    const want = CATERING_TILES.has(String(meta.tile)) ? 'per_pax' : 'fixed';
    assert.equal(basisOf(key, 'feast'), want, `${key} (tile ${meta.tile}) opens on the wrong basis`);
  }
  assert.ok(n >= 5, 'anti-vacuity: the feast family moved');
});
