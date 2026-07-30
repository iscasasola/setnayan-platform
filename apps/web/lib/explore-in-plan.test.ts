/**
 * Unit suite for the adaptive-category-set engine (Explore Replan PR-C).
 *
 * The two properties worth defending are the two that hurt if they break:
 *   1. a LOCKED category can never leave the bench, whatever the DB says;
 *   2. an event with NO onboarding plan keeps its full taxonomy — the seeded
 *      and unseeded paths are different on purpose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRemoveTileFromPlan, resolveInPlanTiles } from './explore-in-plan';
import { categoriesForTile, LOCKED_VENDOR_STATUSES } from './shortlist-taxonomy';
import {
  ADD_TO_PLAN_HEADING,
  REMOVE_BLOCKED_LOCKED,
  REMOVE_FROM_PLAN_LABEL,
  addToPlanChipLabel,
  categoryHintButtonLabel,
  categoryHintForTile,
  folderEmptyInPlan,
  removeFromPlanButtonLabel,
} from './explore-info-copy';

const ALL = ['photography', 'catering', 'florist', 'photo_booth', 'coordinator'];

function resolve(p: {
  planned?: string[];
  vendors?: string[];
  locks?: string[];
  excluded?: string[];
  pinned?: string[];
  allTiles?: string[];
}) {
  return resolveInPlanTiles({
    allTiles: p.allTiles ?? ALL,
    plannedTiles: new Set(p.planned ?? []),
    tilesWithVendors: new Set(p.vendors ?? []),
    tilesWithLocks: new Set(p.locks ?? []),
    excludedTiles: new Set(p.excluded ?? []),
    pinnedTiles: p.pinned ? new Set(p.pinned) : undefined,
  });
}

// ── seeded (the couple has an onboarding plan) ──────────────────────────────

test('seeded: in-plan = the onboarding plan, everything else is the pool', () => {
  const r = resolve({ planned: ['photography', 'catering'] });
  assert.equal(r.seeded, true);
  assert.deepEqual([...r.inPlan].sort(), ['catering', 'photography']);
  assert.deepEqual(r.pool, ['florist', 'photo_booth', 'coordinator']);
});

test('seeded: a tile with picks joins the plan even if onboarding never chose it', () => {
  const r = resolve({ planned: ['photography'], vendors: ['florist'] });
  assert.deepEqual([...r.inPlan].sort(), ['florist', 'photography']);
  assert.ok(!r.pool.includes('florist'));
});

test('seeded: an exclusion removes a planned tile and sends it to the pool', () => {
  const r = resolve({ planned: ['photography', 'catering'], excluded: ['catering'] });
  assert.deepEqual([...r.inPlan], ['photography']);
  assert.ok(r.pool.includes('catering'));
});

test('seeded: an exclusion also beats a tile that merely has (unlocked) picks', () => {
  const r = resolve({ planned: ['photography'], vendors: ['florist'], excluded: ['florist'] });
  assert.ok(!r.inPlan.has('florist'));
  assert.ok(r.pool.includes('florist'));
});

test('seeded: coverage === in-plan, so "Covered X of Y" counts the in-plan size', () => {
  const r = resolve({ planned: ['photography', 'catering'], vendors: ['florist'] });
  assert.deepEqual([...r.coverage].sort(), [...r.inPlan].sort());
  assert.equal(r.coverage.size, 3);
});

// ── the lock guard ──────────────────────────────────────────────────────────

test('A LOCKED tile stays in plan even with an exclusion row — a booking is never hidden', () => {
  const r = resolve({
    planned: ['photography'],
    locks: ['catering'],
    excluded: ['catering'],
  });
  assert.ok(r.inPlan.has('catering'), 'a locked category must never leave the bench');
  assert.ok(!r.pool.includes('catering'));
  assert.ok(r.coverage.has('catering'));
});

test('canRemoveTileFromPlan refuses exactly when the tile holds a lock', () => {
  assert.equal(canRemoveTileFromPlan({ lockedCount: 0 }), true);
  assert.equal(canRemoveTileFromPlan({ lockedCount: 1 }), false);
  assert.equal(canRemoveTileFromPlan({ lockedCount: 9 }), false);
});

// ── unseeded (no onboarding plan — every wedding today) ─────────────────────

test('unseeded: the bench keeps its FULL taxonomy — nothing is buried in a pool', () => {
  const r = resolve({ vendors: ['photography'] });
  assert.equal(r.seeded, false);
  assert.deepEqual([...r.inPlan].sort(), [...ALL].sort());
  assert.deepEqual(r.pool, []);
});

test('unseeded: only an explicit removal moves a tile into the pool', () => {
  const r = resolve({ vendors: ['photography'], excluded: ['photo_booth'] });
  assert.ok(!r.inPlan.has('photo_booth'));
  assert.deepEqual(r.pool, ['photo_booth']);
});

test('unseeded: coverage is the ENGAGED set, so the strip is short, not 53 icons', () => {
  const r = resolve({ vendors: ['photography'], locks: ['catering'] });
  assert.deepEqual([...r.coverage].sort(), ['catering', 'photography']);
  assert.ok(r.inPlan.size > r.coverage.size);
});

test('unseeded with nothing engaged: no strip tiles at all (today\'s behaviour)', () => {
  const r = resolve({});
  assert.equal(r.coverage.size, 0);
  assert.equal(r.inPlan.size, ALL.length);
});

// ── pins, ordering, unknown ids ─────────────────────────────────────────────

test('a pinned tile (the ?open= deep link) is forced back into plan', () => {
  const r = resolve({ planned: ['photography'], excluded: ['photo_booth'], pinned: ['photo_booth'] });
  assert.ok(r.inPlan.has('photo_booth'), 'a deep link must land on a row, not a chip');
  assert.ok(!r.pool.includes('photo_booth'));
});

test('the pool keeps allTiles order, so chips follow the taxonomy walk', () => {
  const r = resolve({ planned: ['coordinator'] });
  assert.deepEqual(r.pool, ['photography', 'catering', 'florist', 'photo_booth']);
});

test('tiles the bench does not show are ignored everywhere (no ghosts)', () => {
  const r = resolve({
    planned: ['photography', 'not_a_tile'],
    vendors: ['also_not_a_tile'],
    locks: ['still_not_a_tile'],
    excluded: ['nope'],
  });
  assert.deepEqual([...r.inPlan], ['photography']);
  assert.deepEqual(r.pool, ['catering', 'florist', 'photo_booth', 'coordinator']);
});

test('resolveInPlanTiles is total: an empty taxonomy yields empty sets', () => {
  const r = resolve({ allTiles: [], planned: ['photography'] });
  assert.equal(r.seeded, false);
  assert.equal(r.inPlan.size, 0);
  assert.deepEqual(r.pool, []);
  assert.equal(r.coverage.size, 0);
});

// ── the removal guard's category bridge ─────────────────────────────────────

test('categoriesForTile is the FULL inverse — ceremony_venue rolls up its siblings', () => {
  // The removal guard has to ask about EVERY category that lands on the tile.
  // `categoryForTile` (the single storage representative) would return one of
  // these and miss a booking filed under either of the others.
  const cats = categoriesForTile('ceremony_venue');
  for (const expected of ['religious_venue', 'church_fees', 'officiant']) {
    assert.ok(
      cats.includes(expected as (typeof cats)[number]),
      `a booking filed under ${expected} must block the ceremony_venue tile, got ${JSON.stringify(cats)}`,
    );
  }
  assert.ok(cats.length >= 3);
});

test('categoriesForTile returns [] for an unknown tile (caller must not read that as "empty")', () => {
  assert.deepEqual(categoriesForTile('not_a_real_tile'), []);
});

test('LOCKED_VENDOR_STATUSES is the committed-booking set the bench already uses', () => {
  assert.deepEqual([...LOCKED_VENDOR_STATUSES].sort(), [
    'complete',
    'contracted',
    'delivered',
    'deposit_paid',
  ]);
});

// ── copy lives in ONE file (spec §11.3) ─────────────────────────────────────

test('every PR-C string is non-empty and lives in explore-info-copy', () => {
  assert.ok(ADD_TO_PLAN_HEADING.includes('Add to your event'));
  assert.ok(REMOVE_FROM_PLAN_LABEL.length > 0);
  assert.ok(REMOVE_BLOCKED_LOCKED.toLowerCase().includes('unlock'));
  assert.ok(REMOVE_BLOCKED_LOCKED.toLowerCase().includes('never cancels'));
  assert.equal(addToPlanChipLabel('Catering'), 'Add Catering to your plan');
  assert.equal(removeFromPlanButtonLabel('Catering'), 'Remove Catering from your plan');
  assert.equal(categoryHintButtonLabel('Catering'), 'What does Catering cover?');
  assert.ok(folderEmptyInPlan('Food & Drink').startsWith('Nothing from Food & Drink'));
});

test('the per-category ⓘ resolves real copy for a known tile and null for a finer one', () => {
  const hint = categoryHintForTile('catering');
  assert.ok(typeof hint === 'string' && hint.length > 0);
  assert.equal(categoryHintForTile('not_a_real_tile'), null);
});
