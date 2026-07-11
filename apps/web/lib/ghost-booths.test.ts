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
  ghostBoothSlots,
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

// ── placement ────────────────────────────────────────────────────────────────

test('ghostBoothSlots: assigns up to count distinct perimeter slots', () => {
  const slots = ghostBoothSlots(4, []);
  assert.equal(slots.length, 4);
  // all distinct
  const keys = new Set(slots.map((s) => `${s.xPct},${s.yPct}`));
  assert.equal(keys.size, 4);
  // no two placed slots are within tolerance of each other
  for (let i = 0; i < slots.length; i++)
    for (let j = i + 1; j < slots.length; j++)
      assert.ok(Math.hypot(slots[i]!.xPct - slots[j]!.xPct, slots[i]!.yPct - slots[j]!.yPct) > 11);
});

test('ghostBoothSlots: never lands within tolerance of an occupied point', () => {
  // occupy the whole top wall → those candidates are skipped, later ones used
  const occupied = [
    { xPct: 22, yPct: 9 }, { xPct: 39, yPct: 9 }, { xPct: 56, yPct: 9 }, { xPct: 73, yPct: 9 },
  ];
  const slots = ghostBoothSlots(3, occupied);
  for (const s of slots)
    for (const o of occupied)
      assert.ok(Math.hypot(s.xPct - o.xPct, s.yPct - o.yPct) > 11, 'clears every occupied point');
  assert.ok(slots.length >= 1, 'still finds side/bottom slots');
});

test('ghostBoothSlots: returns fewer than requested when the perimeter is full', () => {
  // occupy near every candidate → nothing free
  const occupied = [
    { xPct: 22, yPct: 9 }, { xPct: 39, yPct: 9 }, { xPct: 56, yPct: 9 }, { xPct: 73, yPct: 9 },
    { xPct: 9, yPct: 32 }, { xPct: 91, yPct: 32 }, { xPct: 9, yPct: 52 }, { xPct: 91, yPct: 52 },
    { xPct: 9, yPct: 72 }, { xPct: 91, yPct: 72 }, { xPct: 22, yPct: 91 }, { xPct: 78, yPct: 91 },
  ];
  assert.equal(ghostBoothSlots(12, occupied).length, 0);
});

test('ghostBoothSlots: deterministic (same input → same slots)', () => {
  const occ = [{ xPct: 50, yPct: 50 }];
  assert.deepEqual(ghostBoothSlots(5, occ), ghostBoothSlots(5, occ));
});
