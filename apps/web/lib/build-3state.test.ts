/**
 * Unit suite for the 3-State Build solver's PURE resolution logic
 * (`resolveBuildPicks`). Load-bearing invariants:
 *   • Locked taxonomy rows are honored verbatim and reserve budget; a Locked row
 *     with no pick never silently writes a half-pick.
 *   • Auto rows fill the cheapest quoted vendor that fits the REMAINING budget
 *     (cheapest-first → most categories filled), mirroring the shipped OFF
 *     solver (`computeBuildFromShortlist`).
 *   • Multi-pick groups (Look/Booths/Prints) may take several picks; single-pick
 *     groups take exactly one — the live data-loss guard.
 *   • Excluded rows (or absent rows) produce no pick and are flagged to clear.
 *   • Dimension rows (`_dim_*`) never produce a vendor pick.
 *   • A vendor is never reused across two groups.
 *
 * Run via the repo's `test:unit` script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveBuildPicks,
  DIM_BUDGET,
  type BuildStateMap,
  type QuotedVendor,
} from './build-3state';

// `catering` + `photography` are single-pick taxonomy groups; `attire` maps to
// the `look` folder which is a MULTI-pick group (MULTI_PICK_FOLDERS). These ids
// are real PlanGroupIds so isMultiPickGroup() resolves correctly.
const SINGLE_A = 'catering';
const SINGLE_B = 'photography';
const MULTI = 'attire'; // catalogFolder 'look' → multi-pick

// ── Locked rows ──────────────────────────────────────────────────────────────

test('Locked row writes its pinned vendor verbatim and reserves budget', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'v-cater-1', planGroupId: SINGLE_A, costPhp: 50_000 },
    { vendorId: 'v-photo-cheap', planGroupId: SINGLE_B, costPhp: 20_000 },
    { vendorId: 'v-photo-dear', planGroupId: SINGLE_B, costPhp: 90_000 },
  ];
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'locked', pinnedVendorId: 'v-cater-1' }],
    [SINGLE_B, { state: 'auto', pinnedVendorId: null }],
  ]);
  // Budget 100k. Locked catering reserves 50k → 50k left for photography.
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000 });
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_A),
    { planGroupId: SINGLE_A, vendorId: 'v-cater-1' },
  );
  // Cheap photographer (20k) fits the 50k remaining; the dear one (90k) doesn't.
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_B),
    { planGroupId: SINGLE_B, vendorId: 'v-photo-cheap' },
  );
  assert.equal(res.unfilledAuto.length, 0);
});

test('Locked row with no pinned vendor is invalid → unfilled, never written', () => {
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'locked', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted: [], budgetPhp: null });
  assert.equal(res.picks.length, 0);
  assert.deepEqual(res.unfilledAuto, [SINGLE_A]);
});

// ── Auto cheapest-fit ────────────────────────────────────────────────────────

test('Auto picks the cheapest quoted vendor that fits the budget', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'cheap', planGroupId: SINGLE_A, costPhp: 30_000 },
    { vendorId: 'mid', planGroupId: SINGLE_A, costPhp: 60_000 },
    { vendorId: 'dear', planGroupId: SINGLE_A, costPhp: 200_000 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 70_000 });
  // Cheapest is 'cheap' (30k) and it fits.
  assert.deepEqual(res.picks, [{ planGroupId: SINGLE_A, vendorId: 'cheap' }]);
});

test('Auto with no quoted vendor that fits the budget → unfilled (no fallback in this PR)', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'dear', planGroupId: SINGLE_A, costPhp: 200_000 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 50_000 });
  assert.equal(res.picks.length, 0);
  assert.deepEqual(res.unfilledAuto, [SINGLE_A]);
});

test('Auto with no quote at all → unfilled', () => {
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted: [], budgetPhp: null });
  assert.deepEqual(res.unfilledAuto, [SINGLE_A]);
  assert.equal(res.picks.length, 0);
});

test('No budget set → Auto fills each group with its cheapest quoted vendor unconstrained', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'a-cheap', planGroupId: SINGLE_A, costPhp: 30_000 },
    { vendorId: 'a-dear', planGroupId: SINGLE_A, costPhp: 999_999 },
    { vendorId: 'b-only', planGroupId: SINGLE_B, costPhp: 5_000_000 },
  ];
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'auto', pinnedVendorId: null }],
    [SINGLE_B, { state: 'auto', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: null });
  const byGroup = new Map(res.picks.map((p) => [p.planGroupId, p.vendorId]));
  assert.equal(byGroup.get(SINGLE_A), 'a-cheap');
  assert.equal(byGroup.get(SINGLE_B), 'b-only');
  assert.equal(res.unfilledAuto.length, 0);
});

// ── Multi-pick vs single-pick ────────────────────────────────────────────────

test('Multi-pick group keeps several fitting picks; single-pick takes one', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'look-1', planGroupId: MULTI, costPhp: 20_000 },
    { vendorId: 'look-2', planGroupId: MULTI, costPhp: 30_000 },
    { vendorId: 'look-3', planGroupId: MULTI, costPhp: 999_999 }, // priced out
    { vendorId: 'cat-1', planGroupId: SINGLE_A, costPhp: 10_000 },
    { vendorId: 'cat-2', planGroupId: SINGLE_A, costPhp: 11_000 },
  ];
  const s: BuildStateMap = new Map([
    [MULTI, { state: 'auto', pinnedVendorId: null }],
    [SINGLE_A, { state: 'auto', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000 });
  const multiPicks = res.picks.filter((p) => p.planGroupId === MULTI).map((p) => p.vendorId).sort();
  // look-1 (20k) + look-2 (30k) fit within 100k; look-3 doesn't.
  assert.deepEqual(multiPicks, ['look-1', 'look-2']);
  // Single-pick catering: exactly one (the cheapest).
  const catPicks = res.picks.filter((p) => p.planGroupId === SINGLE_A);
  assert.equal(catPicks.length, 1);
  assert.equal(catPicks[0]!.vendorId, 'cat-1');
});

// ── Excluded + absent rows ───────────────────────────────────────────────────

test('Excluded taxonomy rows produce no pick and are flagged to clear', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'v1', planGroupId: SINGLE_A, costPhp: 10_000 },
  ];
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'excluded', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: null });
  assert.equal(res.picks.length, 0);
  assert.deepEqual(res.clearGroupIds, [SINGLE_A]);
});

test('Absent rows (no state) produce nothing — not even a clear instruction', () => {
  const res = resolveBuildPicks({ states: new Map(), quoted: [], budgetPhp: null });
  assert.equal(res.picks.length, 0);
  assert.equal(res.clearGroupIds.length, 0);
  assert.equal(res.unfilledAuto.length, 0);
});

// ── Dimension rows ───────────────────────────────────────────────────────────

test('Dimension rows never produce a vendor pick or a clear instruction', () => {
  const s: BuildStateMap = new Map([
    [DIM_BUDGET, { state: 'locked', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted: [], budgetPhp: 100_000 });
  assert.equal(res.picks.length, 0);
  assert.equal(res.clearGroupIds.length, 0);
  assert.equal(res.unfilledAuto.length, 0);
});

// ── Vendor never reused across groups ────────────────────────────────────────

test('A Locked vendor is not reused to fill another Auto group', () => {
  // Same vendor id is quoted for two groups (edge case); once Locked in A it
  // must not be auto-picked for B.
  const quoted: QuotedVendor[] = [
    { vendorId: 'shared', planGroupId: SINGLE_A, costPhp: 10_000 },
    { vendorId: 'shared', planGroupId: SINGLE_B, costPhp: 10_000 },
    { vendorId: 'b-alt', planGroupId: SINGLE_B, costPhp: 12_000 },
  ];
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'locked', pinnedVendorId: 'shared' }],
    [SINGLE_B, { state: 'auto', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: null });
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_A),
    { planGroupId: SINGLE_A, vendorId: 'shared' },
  );
  // B must fall back to b-alt since 'shared' is used.
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_B),
    { planGroupId: SINGLE_B, vendorId: 'b-alt' },
  );
});

// ── AI-ON compat ranking branch (rankMode: 'compat') ─────────────────────────

test('compat mode: Auto picks the TOP-compat vendor that fits, not the cheapest', () => {
  // The cheapest vendor has a poor compat; a pricier one (still within budget)
  // ranks higher. AI-ON must prefer the high-compat one (cost only GATES).
  const quoted: QuotedVendor[] = [
    { vendorId: 'cheap-weak', planGroupId: SINGLE_A, costPhp: 30_000, compatScore: 40 },
    { vendorId: 'dear-strong', planGroupId: SINGLE_A, costPhp: 60_000, compatScore: 90 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const compat = resolveBuildPicks({ states: s, quoted, budgetPhp: 70_000, rankMode: 'compat' });
  assert.deepEqual(compat.picks, [{ planGroupId: SINGLE_A, vendorId: 'dear-strong' }]);

  // Same inputs in the default cheapest mode still pick the cheapest (the
  // AI-OFF path is unchanged).
  const cheapest = resolveBuildPicks({ states: s, quoted, budgetPhp: 70_000 });
  assert.deepEqual(cheapest.picks, [{ planGroupId: SINGLE_A, vendorId: 'cheap-weak' }]);
});

test('compat mode: a higher-compat vendor that BUSTS budget is skipped for a cheaper one that fits', () => {
  // Top compat is too expensive for the remaining budget; resolution must NOT
  // stop at it (compat order is not cost-monotonic) — it falls to the next-best
  // that fits.
  const quoted: QuotedVendor[] = [
    { vendorId: 'best-too-dear', planGroupId: SINGLE_A, costPhp: 200_000, compatScore: 95 },
    { vendorId: 'good-fits', planGroupId: SINGLE_A, costPhp: 40_000, compatScore: 80 },
    { vendorId: 'ok-cheapest', planGroupId: SINGLE_A, costPhp: 10_000, compatScore: 55 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 50_000, rankMode: 'compat' });
  // 'best-too-dear' (200k) busts the 50k budget → skip; 'good-fits' (40k, compat 80)
  // is the top-compat that fits.
  assert.deepEqual(res.picks, [{ planGroupId: SINGLE_A, vendorId: 'good-fits' }]);
});

test('compat mode: scored vendors outrank an unscored (off-platform) vendor', () => {
  // A quote with no compatScore (off-platform / no market stats) is admit-unknown
  // — present, but never preferred over a scored vendor that fits.
  const quoted: QuotedVendor[] = [
    { vendorId: 'no-score', planGroupId: SINGLE_A, costPhp: 10_000 },
    { vendorId: 'scored', planGroupId: SINGLE_A, costPhp: 20_000, compatScore: 70 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000, rankMode: 'compat' });
  assert.deepEqual(res.picks, [{ planGroupId: SINGLE_A, vendorId: 'scored' }]);
});

test('compat mode: ties on compat fall back to cheapest then vendorId (deterministic)', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'b-dear', planGroupId: SINGLE_A, costPhp: 50_000, compatScore: 75 },
    { vendorId: 'a-cheap', planGroupId: SINGLE_A, costPhp: 30_000, compatScore: 75 },
  ];
  const s: BuildStateMap = new Map([[SINGLE_A, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000, rankMode: 'compat' });
  // Equal compat → cheaper wins.
  assert.deepEqual(res.picks, [{ planGroupId: SINGLE_A, vendorId: 'a-cheap' }]);
});

test('compat mode: multi-pick group keeps every fitting pick in compat order', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'look-weak', planGroupId: MULTI, costPhp: 20_000, compatScore: 50 },
    { vendorId: 'look-strong', planGroupId: MULTI, costPhp: 30_000, compatScore: 90 },
    { vendorId: 'look-bust', planGroupId: MULTI, costPhp: 999_999, compatScore: 99 },
  ];
  const s: BuildStateMap = new Map([[MULTI, { state: 'auto', pinnedVendorId: null }]]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000, rankMode: 'compat' });
  const got = res.picks.filter((p) => p.planGroupId === MULTI).map((p) => p.vendorId);
  // Both affordable picks are kept (multi-pick); the 999,999 one busts budget.
  assert.deepEqual([...got].sort(), ['look-strong', 'look-weak']);
});

test('compat mode: Locked + Excluded + dimension rows behave exactly as cheapest mode', () => {
  const quoted: QuotedVendor[] = [
    { vendorId: 'cat-lock', planGroupId: SINGLE_A, costPhp: 50_000, compatScore: 60 },
    { vendorId: 'photo-1', planGroupId: SINGLE_B, costPhp: 20_000, compatScore: 88 },
  ];
  const s: BuildStateMap = new Map([
    [SINGLE_A, { state: 'locked', pinnedVendorId: 'cat-lock' }],
    [SINGLE_B, { state: 'auto', pinnedVendorId: null }],
    [DIM_BUDGET, { state: 'locked', pinnedVendorId: null }],
  ]);
  const res = resolveBuildPicks({ states: s, quoted, budgetPhp: 100_000, rankMode: 'compat' });
  // Locked honored verbatim; dimension row never produces a pick; Auto fills.
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_A),
    { planGroupId: SINGLE_A, vendorId: 'cat-lock' },
  );
  assert.deepEqual(
    res.picks.find((p) => p.planGroupId === SINGLE_B),
    { planGroupId: SINGLE_B, vendorId: 'photo-1' },
  );
  assert.equal(res.unfilledAuto.length, 0);
});
