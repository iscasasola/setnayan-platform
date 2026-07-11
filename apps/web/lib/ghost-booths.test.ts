/**
 * Unit suite for the ghost-booth selection core (lib/ghost-booths). The 3D
 * render can't run in CI, so the selection/filter logic is proven here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GHOST_BOOTH_CATEGORIES,
  unbookedGhostCategories,
  ghostBoothExploreHref,
  type GhostBoothCategory,
} from './ghost-booths';

const cats = (r: GhostBoothCategory[]) => r.map((g) => g.category);

test('master toggle off → no ghost booths, whatever else is passed', () => {
  assert.deepEqual(
    unbookedGhostCategories({ bookedCategories: [], dismissed: [], enabled: false }),
    [],
  );
});

test('nothing booked/dismissed → the whole domain, in domain order', () => {
  const r = unbookedGhostCategories({ bookedCategories: [], dismissed: [], enabled: true });
  assert.deepEqual(cats(r), [...GHOST_BOOTH_CATEGORIES]);
});

test('booked categories are excluded', () => {
  const r = unbookedGhostCategories({
    bookedCategories: ['catering', 'photographer'],
    dismissed: [],
    enabled: true,
  });
  assert.ok(!cats(r).includes('catering'));
  assert.ok(!cats(r).includes('photographer'));
  assert.ok(cats(r).includes('florist'), 'an unbooked domain category still shows');
});

test('dismissed categories are excluded (per-booth dismiss)', () => {
  const r = unbookedGhostCategories({
    bookedCategories: [],
    dismissed: ['mobile_bar', 'photobooth'],
    enabled: true,
  });
  assert.ok(!cats(r).includes('mobile_bar'));
  assert.ok(!cats(r).includes('photobooth'));
});

test('booked ∪ dismissed both removed; the rest keep domain order', () => {
  const r = unbookedGhostCategories({
    bookedCategories: ['catering'],
    dismissed: ['videographer'],
    enabled: true,
  });
  const c = cats(r);
  assert.ok(!c.includes('catering'));
  assert.ok(!c.includes('videographer'));
  // order preserved relative to the domain
  const domainOrder = GHOST_BOOTH_CATEGORIES.filter((x) => x !== 'catering' && x !== 'videographer');
  assert.deepEqual(c, [...domainOrder]);
});

test('categories OUTSIDE the domain never appear (e.g. venue, officiant, rings)', () => {
  const r = unbookedGhostCategories({ bookedCategories: [], dismissed: [], enabled: true });
  const c = new Set(cats(r));
  for (const excluded of ['venue', 'religious_venue', 'officiant', 'rings', 'accommodation', 'misc'] as const) {
    assert.ok(!c.has(excluded), `${excluded} must never be a ghost booth`);
  }
});

test('every returned ghost booth has a non-empty label and a tappable tile slug', () => {
  const r = unbookedGhostCategories({ bookedCategories: [], dismissed: [], enabled: true });
  // The whole domain must resolve — a domain category with no marketplace tile
  // would silently vanish, which we do NOT want (catches a taxonomy regression).
  assert.equal(r.length, GHOST_BOOTH_CATEGORIES.length, 'no domain category dropped for a missing tile');
  for (const g of r) {
    assert.ok(g.label.length > 0, `${g.category} has a label`);
    assert.ok(g.tileSlug.length > 0, `${g.category} has a tile slug`);
  }
});

test('ghostBoothExploreHref builds the marketplace deep-link', () => {
  assert.equal(ghostBoothExploreHref('catering'), '/explore?tile=catering');
  assert.equal(ghostBoothExploreHref('photo booth'), '/explore?tile=photo%20booth');
});
