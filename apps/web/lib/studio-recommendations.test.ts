/**
 * Unit guards for the Studio "Recommended for you now" ranking (Node built-in
 * runner via tsx). Covers the two things that matter: (1) it FOLLOWS the roadmap
 * and RESPECTS readiness — day-of capture is not pushed before the date is
 * locked, and a behind-on-save-the-dates couple gets Save the Date; and (2) the
 * peak/exclusion maps stay in lockstep with the add-on catalog (the drift guard,
 * so a newly-shipped add-on can never silently vanish from recommendations).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  recommendStudioAddOns,
  STUDIO_PEAK_MONTHS,
  STUDIO_RECOMMEND_EXCLUDED,
  STUDIO_ROADMAP_ANCHORS,
  STUDIO_PREREQUISITE,
} from './studio-recommendations';
import type { RoadmapSignals } from './wedding-roadmap';
import { ADD_ONS } from './add-ons-catalog';

const ALL_ELIGIBLE = () => true;
const NONE_OWNED = () => false;

/** A signals bag with everything false, overridden per-case. */
function signals(over: Partial<RoadmapSignals> = {}): RoadmapSignals {
  return {
    dateLocked: false,
    receptionVenueBooked: false,
    ceremonyVenueBooked: false,
    budgetSet: false,
    hasGuests: false,
    coreVendorBooked: false,
    seatingStarted: false,
    setnayanCaptureSet: false,
    ...over,
  };
}

test('date-less couple gets foundation add-ons, never day-of capture', () => {
  const r = recommendStudioAddOns({
    monthsToDate: null,
    signals: signals(),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 3,
  });
  assert.ok(r.length > 0);
  for (const capture of ['papic', 'panood', 'patiktok', 'photo-delivery']) {
    assert.ok(!r.includes(capture), `date-less lead must not include ${capture}`);
  }
});

test('readiness gate: capture is withheld until the date is locked', () => {
  // 2 months out, capture band overdue — but nothing is ready yet.
  const notReady = recommendStudioAddOns({
    monthsToDate: 2,
    signals: signals(),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 3,
  });
  for (const capture of ['papic', 'panood', 'patiktok', 'photo-delivery']) {
    assert.ok(!notReady.includes(capture), `unlocked date must gate ${capture}`);
  }

  // Same timeline, but the date is locked and there are guests → capture leads.
  const ready = recommendStudioAddOns({
    monthsToDate: 2,
    signals: signals({ dateLocked: true, hasGuests: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 3,
  });
  assert.ok(ready.includes('papic'), 'a ready couple should see capture (papic)');
});

test('follows the roadmap: a behind couple is pointed at Save the Date', () => {
  // 5 months out (save_the_dates ideal-by is 6 → overdue), date locked so its
  // prerequisite is met. Save the Date should surface via the roadmap path.
  const r = recommendStudioAddOns({
    monthsToDate: 5,
    signals: signals({ dateLocked: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 3,
  });
  assert.ok(r.includes('save-the-date'), 'overdue save-the-dates should surface Save the Date');
});

test('owned + ineligible items are dropped and backfilled', () => {
  const owned = new Set(['save-the-date', 'mood-board']);
  const r = recommendStudioAddOns({
    monthsToDate: 8,
    signals: signals({ dateLocked: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: (k) => owned.has(k),
    limit: 3,
  });
  assert.equal(r.length, 3);
  assert.ok(!r.includes('save-the-date'));
  assert.ok(!r.includes('mood-board'));
  assert.equal(new Set(r).size, r.length, 'no duplicates');
});

test('respects the limit', () => {
  const r = recommendStudioAddOns({
    monthsToDate: 9,
    signals: signals(),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 2,
  });
  assert.ok(r.length <= 2);
});

test('never recommends an excluded key', () => {
  const r = recommendStudioAddOns({
    monthsToDate: 4,
    signals: signals({ dateLocked: true, hasGuests: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    limit: 24,
  });
  for (const key of r) {
    assert.ok(!STUDIO_RECOMMEND_EXCLUDED.has(key), `${key} is excluded and must not appear`);
  }
});

test('DRIFT GUARD: every catalog add-on is classified (peak, excluded, or coming-soon)', () => {
  const unclassified = ADD_ONS.filter(
    (a) =>
      a.status !== 'coming_soon' &&
      !(a.key in STUDIO_PEAK_MONTHS) &&
      !STUDIO_RECOMMEND_EXCLUDED.has(a.key),
  ).map((a) => a.key);
  assert.deepEqual(
    unclassified,
    [],
    `New add-on(s) missing a STUDIO_PEAK_MONTHS entry or a STUDIO_RECOMMEND_EXCLUDED omission: ${unclassified.join(', ')}`,
  );
});

test('every peak/excluded key still exists in the catalog (no stale entries)', () => {
  const catalogKeys = new Set(ADD_ONS.map((a) => a.key));
  const stale = [
    ...Object.keys(STUDIO_PEAK_MONTHS),
    ...STUDIO_RECOMMEND_EXCLUDED,
  ].filter((k) => !catalogKeys.has(k));
  assert.deepEqual(stale, [], `Stale key(s) not in the catalog: ${stale.join(', ')}`);
});

test('DRIFT GUARD: every anchor/prerequisite key is a real, peaked catalog key', () => {
  const catalogKeys = new Set(ADD_ONS.map((a) => a.key));
  const referenced = [
    ...Object.values(STUDIO_ROADMAP_ANCHORS).flatMap((keys) => keys ?? []),
    ...Object.keys(STUDIO_PREREQUISITE),
  ];
  const bad = referenced.filter(
    (k) => !(k in STUDIO_PEAK_MONTHS) || !catalogKeys.has(k),
  );
  // A typo'd add-on key in the anchor/prerequisite maps would silently drop an
  // item with no other failing test — this is the guard against that.
  assert.deepEqual(bad, [], `Anchor/prerequisite key(s) not peaked or not in catalog: ${bad.join(', ')}`);
});

test('non-wedding events skip the wedding phase-follow pass (followRoadmap: false)', () => {
  // 5 months out with an overdue save-the-dates item would normally surface
  // Save the Date via Phase 1. A non-wedding event must NOT get that wedding-
  // canon pass — it ranks by date-peak proximity alone.
  const wedding = recommendStudioAddOns({
    monthsToDate: 5,
    signals: signals({ dateLocked: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    followRoadmap: true,
    limit: 3,
  });
  assert.ok(wedding.includes('save-the-date'), 'wedding path surfaces Save the Date');

  const nonWedding = recommendStudioAddOns({
    monthsToDate: 5,
    signals: signals({ dateLocked: true }),
    completed: [],
    isEligible: ALL_ELIGIBLE,
    isOwned: NONE_OWNED,
    followRoadmap: false,
    limit: 3,
  });
  // Peak-proximity at 5mo → custom-qr-guest(5)/rsvp(5)/pakanta(6)/music(6)/led(4),
  // NOT the roadmap-forced Save the Date lead. Just assert the phase-follow bump
  // is gone: the result is purely proximity-ranked (save-the-date peak 8 is far
  // from 5, so it should not lead).
  assert.equal(nonWedding[0] !== 'save-the-date', true, 'non-wedding must not force Save the Date first');
});
