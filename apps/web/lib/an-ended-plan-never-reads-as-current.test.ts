/**
 * ⏳ AN ENDED PLAN NEVER READS AS CURRENT — Build 5 row 14 + Lane W (2026-11-11).
 *
 * #7419 made the Plan screen ask `sweep_vendor_tier_expiry` before it draws a run-out plan, and SetnaProd stepped
 * down on production. One path stayed: when that sweep is REFUSED, the screen kept its first read and printed
 * "You are on Supplier Plus · until Oct 19, 2026" — a passed day as the future, the same picture as a live plan. The
 * database's own gates already treat that row as Free (they re-check `tier_expires_at`), so the page must too.
 *
 * Held here:
 *   1. `endedPlanReadsFree` turns a run-out paid row into Free/Verified with no end day — and leaves every other
 *      row exactly as it came;
 *   2. the Plan screen reads its tier and day THROUGH it, after the sweep, so no refused sweep can draw a past day.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { endedPlanReadsFree } from './vendor-tier-lapse';

const now = Date.parse('2026-11-10T08:00:00Z');

test('1 · a run-out paid plan reads as Free (or Verified), with no end day', () => {
  const setnaProd = {
    tier_state: 'solo',
    tier_source: 'admin_comp',
    tier_expires_at: '2026-10-19T13:13:12Z',
    tier_billing_cycle: null,
    verification_state: 'verified',
  };
  const r = endedPlanReadsFree(setnaProd, now)!;
  assert.equal(r.tier_state, 'verified', 'a verified shop steps down to Verified');
  assert.equal(r.tier_expires_at, null, 'no day is left to print as "until"');
  assert.equal(r.tier_billing_cycle, null);
  assert.equal(r.verification_state, 'verified', 'other columns are untouched');

  const unverified = endedPlanReadsFree({ ...setnaProd, tier_state: 'pro', verification_state: 'unverified' }, now)!;
  assert.equal(unverified.tier_state, 'free');
  assert.equal(unverified.tier_expires_at, null);
});

test('1b · a live plan, an open-ended comp, a free shop and no row pass through unchanged', () => {
  const live = { tier_state: 'solo', tier_expires_at: '2027-07-30T07:52:09Z', verification_state: 'verified' };
  assert.equal(endedPlanReadsFree(live, now), live);
  const open = { tier_state: 'solo', tier_expires_at: null, verification_state: 'verified' };
  assert.equal(endedPlanReadsFree(open, now), open);
  const free = { tier_state: 'verified', tier_expires_at: '2026-10-19T00:00:00Z', verification_state: 'verified' };
  assert.equal(endedPlanReadsFree(free, now), free);
  assert.equal(endedPlanReadsFree(null, now), null);
});

test('2 · the Plan screen reads its tier and day through endedPlanReadsFree, after the sweep', () => {
  const src = stripComments(
    readFileSync(join(__dirname, '..', 'app/vendor-dashboard/subscription/_components/plan-screen.tsx'), 'utf8'),
  );
  const sweep = src.indexOf("rpc('sweep_vendor_tier_expiry'");
  const honest = src.indexOf('endedPlanReadsFree(', sweep);
  const firstTierRead = src.indexOf('asVendorTier(');
  const firstDayRead = src.indexOf('tier_expires_at?: string | null } | null)?.tier_expires_at ?? null');
  assert.ok(sweep > 0, 'the Plan screen still asks the sweep first');
  assert.ok(honest > sweep, 'the run-out check comes after the sweep');
  assert.ok(honest < firstTierRead, 'the tier is read after the run-out check');
  assert.ok(firstDayRead === -1 || honest < firstDayRead, 'the end day is read after the run-out check');
});
