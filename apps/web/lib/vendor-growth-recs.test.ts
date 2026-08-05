/**
 * Vendor growth recommendations — the honesty rules.
 *
 * Every card here is derived from the vendor's OWN gaps, so a vendor who has
 * already done the thing never sees the advice. These tests pin that, because
 * a nudge that fires regardless of state is just noise a vendor learns to skip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrowthRecs, type GrowthRecStats } from './vendor-growth-recs';


// ── The partnership invitation (owner: "promote", 2026-08-05) ───────────────
// Partnerships were complete on both sides and reachable — and NOTHING ever
// invited a vendor into them. This is that invitation, and it has to be honest:
// a vendor who has already built their circle must never see it.

const BASE: GrowthRecStats = {
  avg_response_minutes: 5,
  response_rate_pct: 100,
  review_count: 20,
  profile_completeness_pct: 100,
  finalized_booking_count: 10,
  partnership_count: 0,
};

test('a vendor with no partnerships is invited to build some', () => {
  const rec = buildGrowthRecs(BASE).find((r) => r.key === 'build_partnerships');
  assert.ok(rec, 'the invitation must appear for a vendor with none');
  assert.equal(rec.ctaHref, '/vendor-dashboard/partnerships');
});

test('a vendor who already has a circle is NOT nagged', () => {
  const rec = buildGrowthRecs({ ...BASE, partnership_count: 3 }).find(
    (r) => r.key === 'build_partnerships',
  );
  assert.equal(rec, undefined, 'three partnerships is a built circle — stop asking');
});

test('the invitation gets quieter as the circle grows', () => {
  const w = (n: number) =>
    buildGrowthRecs({ ...BASE, partnership_count: n }).find(
      (r) => r.key === 'build_partnerships',
    )?.weight ?? 0;
  assert.ok(w(0) > w(1) && w(1) > w(2), 'weight must fall as partnerships accumulate');
});

test('the invitation counts what the vendor has, without inventing a benefit', () => {
  const rec = buildGrowthRecs({ ...BASE, partnership_count: 1 }).find(
    (r) => r.key === 'build_partnerships',
  );
  assert.match(rec!.body, /1 partnership\b/, 'must state the real count, singular');
  assert.ok(
    !/\d+\s*[×x%]/.test(rec!.body),
    'no invented multiplier — we have no data on what partnerships are worth',
  );
});

test('a brand-new vendor with no stats row still gets the invitation', () => {
  const rec = buildGrowthRecs(null).find((r) => r.key === 'build_partnerships');
  assert.ok(rec, 'the starter set must include it — a new vendor has no circle yet');
});
