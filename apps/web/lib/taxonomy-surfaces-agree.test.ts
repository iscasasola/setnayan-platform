/**
 * taxonomy-surfaces-agree.test.ts — "Surfaces disagreeing" (🌳 ③b; PLAN § 8.3) names a family exactly when
 * its answer differs from the tables, and stays quiet when every surface reads the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfacesDisagreeing, type SurfacesInput } from './taxonomy-surfaces-agree';

const AGREE: SurfacesInput = {
  taxonomySource: 'db',
  categoryIds: ['reception', 'grooms_attire'],
  hiddenIds: new Set(),
  liveByTile: new Map([
    ['reception', ['function_hall', 'events_place']],
    ['grooms_attire', ['groom_suit_rental']],
  ]),
  constByTile: new Map([
    ['reception', ['events_place', 'function_hall']],
    ['grooms_attire', ['groom_suit_rental']],
  ]),
  partsReaderSource: 'db',
  partsReaderServices: { groom: ['groom_suit_rental'] },
  partsTableServices: { groom: ['groom_suit_rental'] },
  brokenCoupleLinks: 0,
  planGroups: [{ id: 'reception', label: 'Reception', catalogTile: 'reception' }],
};

test('everything agrees → nothing to say (order inside a bucket does not matter)', () => {
  assert.deepEqual(surfacesDisagreeing(AGREE), []);
});

test('an admin edit the const readers cannot see → "Tile → services", naming the files that still read the code copy', () => {
  const out = surfacesDisagreeing({ ...AGREE, liveByTile: new Map([...AGREE.liveByTile, ['grooms_attire', ['groom_suit_rental', 'new_cape']]]) });
  assert.equal(out.length, 1);
  assert.equal(out[0]!.family, 'Tile → services');
  assert.match(out[0]!.owner, /lib\/moodboard-gallery\.ts/);
  assert.doesNotMatch(out[0]!.owner, /vendor-counts/);
  // A brand-new admin category the code copy has never heard of disagrees too.
  const fresh = surfacesDisagreeing({ ...AGREE, categoryIds: [...AGREE.categoryIds, 'admin_made'], liveByTile: new Map([...AGREE.liveByTile, ['admin_made', ['x']]]) });
  assert.ok(fresh.some((f) => f.family === 'Tile → services'));
});

test('each other family speaks for itself', () => {
  assert.equal(surfacesDisagreeing({ ...AGREE, taxonomySource: 'fallback' })[0]?.family, 'Taxonomy reader');
  assert.equal(surfacesDisagreeing({ ...AGREE, partsReaderSource: 'fallback' })[0]?.family, 'Parts reader');
  assert.equal(surfacesDisagreeing({ ...AGREE, partsReaderServices: { groom: [] } })[0]?.family, 'Parts reader');
  assert.equal(surfacesDisagreeing({ ...AGREE, brokenCoupleLinks: 2 })[0]?.family, 'Category key');
  assert.equal(surfacesDisagreeing({ ...AGREE, hiddenIds: new Set(['reception']) })[0]?.family, 'Plan groups');
  assert.equal(surfacesDisagreeing({ ...AGREE, planGroups: [{ id: 'x', label: 'X', catalogTile: 'gone' }] })[0]?.family, 'Plan groups');
  // Unreadable tables never claim the reader disagrees.
  assert.deepEqual(surfacesDisagreeing({ ...AGREE, partsTableServices: null, partsReaderSource: 'fallback' }), []);
});
