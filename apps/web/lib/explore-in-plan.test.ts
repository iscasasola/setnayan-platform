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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADDED_CATEGORIES_KEY,
  addedCategoriesOf,
  canRemoveTileFromPlan,
  resolveBenchRing,
  resolveInPlanTiles,
  ringBuildCount,
  withAddedCategory,
} from './explore-in-plan';
import { popularTilesFor } from './supplier-find';
import { stripComments } from './strip-comments';
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
  starter?: string[];
}) {
  return resolveInPlanTiles({
    allTiles: p.allTiles ?? ALL,
    plannedTiles: new Set(p.planned ?? []),
    tilesWithVendors: new Set(p.vendors ?? []),
    tilesWithLocks: new Set(p.locks ?? []),
    excludedTiles: new Set(p.excluded ?? []),
    pinnedTiles: p.pinned ? new Set(p.pinned) : undefined,
    starterTiles: p.starter ? new Set(p.starter) : undefined,
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
  // "plan" is RESERVED on this surface (Integration spec §2 — a *plan* is a
  // saved alternative team you compare, never the category set). The visible
  // heading and BOTH aria-labels must agree: a screen reader saying "plan" over
  // an "event" chip pool is the regression these three lines pin together.
  assert.ok(ADD_TO_PLAN_HEADING.includes('Add to your event'));
  assert.ok(REMOVE_FROM_PLAN_LABEL.length > 0);
  assert.ok(REMOVE_BLOCKED_LOCKED.toLowerCase().includes('undo'));
  assert.ok(REMOVE_BLOCKED_LOCKED.toLowerCase().includes('never cancels'));
  assert.equal(addToPlanChipLabel('Catering'), 'Add Catering to your event');
  assert.equal(removeFromPlanButtonLabel('Catering'), 'Remove Catering from your event');
  assert.equal(categoryHintButtonLabel('Catering'), 'What does Catering cover?');
  assert.ok(folderEmptyInPlan('Food & Drink').startsWith('Nothing from Food & Drink'));
});

test('the per-category ⓘ resolves real copy for a known tile and null for a finer one', () => {
  const hint = categoryHintForTile('catering');
  assert.ok(typeof hint === 'string' && hint.length > 0);
  assert.equal(categoryHintForTile('not_a_real_tile'), null);
});

/* ═══════════════════════════════════════════════════════════════════════════
   THE STARTER RING, AND A CATEGORY THAT STAYS ADDED (owner 2026-10-08)
   "which rows a wedding shows": the event's own picks, else the "popular four"
   for its type; "＋ Add to your event" brings in any other category and it
   STAYS. A category that already holds one of the couple's suppliers, or a
   booking, is never out of sight.

   SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
     ring: let a starter ring hide an engaged category · let it beat a removal ·
           count coverage over the engaged tiles only
     kept: accept free text as a tile · write the picks list instead of the
           added list · write before the host check
   ═══════════════════════════════════════════════════════════════════════════ */

test('starter: an event with no plan opens on the starter ring — not on every category', () => {
  const r = resolve({ starter: ['catering', 'photography'] });
  assert.equal(r.seeded, false);
  assert.deepEqual([...r.inPlan].sort(), ['catering', 'photography']);
  assert.deepEqual(r.pool, ['florist', 'photo_booth', 'coordinator'], 'the rest wait under ＋ Add to your event');
  assert.deepEqual([...r.coverage].sort(), ['catering', 'photography'], '"Covered N of M" counts the ring');
});

test('starter: a category holding one of their suppliers, or a booking, ALWAYS shows', () => {
  const r = resolve({ starter: ['catering'], vendors: ['florist'], locks: ['coordinator'] });
  assert.deepEqual([...r.inPlan].sort(), ['catering', 'coordinator', 'florist']);
  // …even when the ring names nothing the event can show at all.
  const none = resolve({ starter: ['not_a_tile'], vendors: ['florist'] });
  assert.deepEqual([...none.inPlan], ['florist']);
});

test('starter: a removal still removes a starter row, and never a booked one', () => {
  const r = resolve({ starter: ['catering', 'photography'], excluded: ['catering'] });
  assert.deepEqual([...r.inPlan], ['photography']);
  assert.ok(r.pool.includes('catering'), 'a removed starter returns to the dropdown');
  const booked = resolve({ starter: ['catering'], excluded: ['catering'], locks: ['catering'] });
  assert.ok(booked.inPlan.has('catering'));
});

test('starter: the event’s OWN plan wins — the ring is only the fallback', () => {
  const r = resolve({ planned: ['florist'], starter: ['catering', 'photography'] });
  assert.equal(r.seeded, true);
  assert.deepEqual([...r.inPlan], ['florist'], 'a planned event is not padded with the popular four');
});

test('starter: every event type has four, and a type with no list of its own gets the default', () => {
  for (const type of ['wedding', 'birthday', 'wake', 'debut', 'christening', 'corporate', null]) {
    assert.equal(popularTilesFor(type).size, 4, `${type} has no starter ring`);
  }
  assert.deepEqual([...popularTilesFor('wedding')], ['photo_video', 'catering', 'reception', 'hmua']);
  assert.deepEqual([...popularTilesFor(null)], [...popularTilesFor('wedding')]);
});

test('kept: an added category is stored once, as a tile id, under its own key', () => {
  assert.equal(ADDED_CATEGORIES_KEY, 'added_categories');
  assert.deepEqual(withAddedCategory(undefined, 'florist'), ['florist']);
  assert.deepEqual(withAddedCategory(['florist'], 'photo_booth'), ['florist', 'photo_booth']);
  assert.deepEqual(withAddedCategory(['florist'], 'florist'), ['florist'], 'adding twice keeps one');
  // A label, free text or anything that is not a tile id is refused — nothing is written.
  for (const bad of ['Florist', 'two words', '', '../x', 'a'.repeat(65), '<b>']) {
    assert.equal(withAddedCategory([], bad), null, `"${bad}" was accepted as a tile`);
  }
});

test('kept: the stored list is read defensively — junk in the blob is never a category', () => {
  assert.deepEqual(addedCategoriesOf(null), []);
  assert.deepEqual(addedCategoriesOf({ added_categories: 'florist' }), []);
  assert.deepEqual(addedCategoriesOf({ added_categories: ['florist', 7, 'Bad One', 'florist', 'cake'] }), ['florist', 'cake']);
  // The onboarding picks beside it are NOT this list.
  assert.deepEqual(addedCategoriesOf({ interested_categories: ['florist'] }), []);
});

test('kept: "＋ Add" writes the added list — never the onboarding picks — and only for a host', () => {
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', 'category-decision-actions.ts'), 'utf8'),
  );
  const fn = src.slice(src.indexOf('export async function restoreTileToPlan'));
  // The checklist, the supplier brief and the onboarding auto-inquiries read the
  // picks list; an added category must change none of them.
  assert.doesNotMatch(src, /interested_categories/, 'the action touches the onboarding picks list');
  assert.match(fn, /writeStylePreferenceKey\(\s*createAdminClient\(\),\s*input\.eventId,\s*ADDED_CATEGORIES_KEY,\s*\(current\) => withAddedCategory\(current, input\.tile\) \?\? current,\s*\)/);
  // The admin write comes AFTER the host check, and a non-host is refused.
  const host = fn.indexOf('if ((await getHostUserId(input.eventId)) === null) {');
  const write = fn.indexOf('writeStylePreferenceKey(');
  assert.ok(host > -1 && write > host, 'the admin write runs before (or without) the host check');
  // A write that did not happen is said — never reported as saved.
  assert.match(fn, /if \(!kept\.ok\) \{[\s\S]*?return \{ ok: false, error: 'That category did not save\. Please try again\.' \};/);
  // The conversations a removal archived are restored BEFORE anything can return early.
  assert.ok(fn.indexOf('archived_at: null') > -1 && fn.indexOf('archived_at: null') < host);
});

test('kept: the page shows a wedding its own picks plus what it added, and hands the bench the ring', () => {
  const page = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', 'page.tsx'), 'utf8'),
  );
  const planned = page.slice(page.indexOf('const plannedTiles = (() => {'), page.indexOf('})();', page.indexOf('const plannedTiles = (() => {')));
  assert.doesNotMatch(planned, /=== 'wedding'\) return undefined/, 'a wedding’s own picks are ignored again');
  assert.match(planned, /const tiles = plannedTileIdSet\(picks\);\s*for \(const t of addedCategoriesOf\(prefs\)\) tiles\.add\(t\);/);
  assert.match(page, /starterTiles=\{\[\.\.\.popularTilesFor\(ev\?\.event_type \?\? null\)\]\}/);
  const bench = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx'), 'utf8'),
  );
  assert.match(bench, /starterTiles: replan \? starterTiles : undefined,/);
  // The bench and the page build the ring through the SAME call.
  assert.match(bench, /const inPlanResolution = resolveBenchRing\(\{/);
  assert.match(page, /const ring = resolveBenchRing\(\{\s*tiles: ringTiles,\s*excludedTiles,\s*pinnedTile: sp\.open \?\? null,\s*starterTiles: \[\.\.\.popularTilesFor\(ev\?\.event_type \?\? null\)\],\s*\}\);/);
  assert.match(page, /return \{ \.\.\.money, \.\.\.ringBuildCount\(ringTiles, ring\.inPlan\) \};/);
});

test('Build N/M is counted over the ring — the rows Find shows, at the rows’ own grain', () => {
  const tiles = [
    { tile: 'reception', planned: true, vendorCount: 1, lockedCount: 1 },
    { tile: 'ceremony_venue', planned: true, vendorCount: 1, lockedCount: 1 },
    { tile: 'cake', planned: true, vendorCount: 0, lockedCount: 0 },
    { tile: 'catering', planned: true, vendorCount: 6, lockedCount: 0, buildCount: 1 },
    { tile: 'bridal_car', planned: true, vendorCount: 0, lockedCount: 0 },
    { tile: 'florist', planned: false, vendorCount: 0, lockedCount: 0 },
  ];
  const ring = resolveBenchRing({ tiles, excludedTiles: [], starterTiles: ['photo_video'] });
  assert.deepEqual([...ring.inPlan], ['reception', 'ceremony_venue', 'cake', 'catering', 'bridal_car']);
  // Booked, booked, in the build → 3 of the 5 rows; the unplanned florist is not a row.
  assert.deepEqual(ringBuildCount(tiles, ring.inPlan), { filled: 3, total: 5 });
  // A removed row is not counted; a booked one cannot be removed from the count.
  const cut = resolveBenchRing({ tiles, excludedTiles: ['cake', 'reception'] , starterTiles: [] });
  assert.deepEqual(ringBuildCount(tiles, cut.inPlan), { filled: 3, total: 4 });
});
