/**
 * Unit suite for the §4 last-minute mechanic (vendor-owned START, 2026-06-16).
 *
 * Load-bearing invariants:
 *   • DARK BY DATA — no recommended lead time + no platform fallback START =
 *     today's prod state ⇒ START resolves null ⇒ zone 'normal' ⇒ always
 *     bookable / searchable, no badge. The behavior-neutral guarantee.
 *   • The vendor's recommended lead time is the last-minute START; the platform
 *     planning_deadlines START is only a SOFT FALLBACK when the vendor's is null.
 *   • The three-zone math (normal | last_minute | expired) + AI-only visibility
 *     + opt-in surcharge are unchanged by the rewire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  monthsToWedding,
  lastMinuteZone,
  resolveLastMinuteStart,
  isLastMinuteSearchable,
  categoryEmptyForGenericSearch,
  lastMinuteSurchargedPricePhp,
} from './last-minute';

// ── resolveLastMinuteStart — the vendor-owned START + dark-by-data rule ───────

test('DARK BY DATA: no recommended lead + no platform fallback ⇒ null START', () => {
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: null, platformFallbackMonths: null }),
    null,
  );
  // undefined fallback (helper called without the platform value at all)
  assert.equal(resolveLastMinuteStart({ recommendedLeadMonths: null }), null);
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: undefined, platformFallbackMonths: undefined }),
    null,
  );
});

test('vendor recommended lead time is the START (wins over the platform fallback)', () => {
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: 3, platformFallbackMonths: 6 }),
    3,
  );
  // fractional lead (0.5 ≈ 2 weeks) is honored
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: 0.5, platformFallbackMonths: 4 }),
    0.5,
  );
  // an explicit 0 recommended lead is honored — not treated as "unset"
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: 0, platformFallbackMonths: 4 }),
    0,
  );
});

test('platform START is only a SOFT FALLBACK when the vendor lead is null', () => {
  assert.equal(
    resolveLastMinuteStart({ recommendedLeadMonths: null, platformFallbackMonths: 4 }),
    4,
  );
});

// ── lastMinuteZone — dark-by-data + the three zones ──────────────────────────

test('null START (dark by data) ⇒ always normal, whatever the date', () => {
  const start = resolveLastMinuteStart({
    recommendedLeadMonths: null,
    platformFallbackMonths: null,
  });
  assert.equal(start, null);
  for (const r of [12, 3, 1, 0.1, -2]) {
    assert.equal(lastMinuteZone({ monthsRemaining: r, startMonths: start }), 'normal');
  }
});

test('no locked date (monthsRemaining null) ⇒ normal even with a START set', () => {
  assert.equal(
    lastMinuteZone({ monthsRemaining: null, startMonths: 4, endMonths: 1 }),
    'normal',
  );
});

test('three zones off a vendor recommended lead of 4mo, cutoff 3mo', () => {
  // Worked example (§4.2): START = recommended lead 4mo, END = cutoff 3mo.
  const start = resolveLastMinuteStart({ recommendedLeadMonths: 4 });
  const z = (r: number) => lastMinuteZone({ monthsRemaining: r, startMonths: start, endMonths: 3 });
  assert.equal(z(5), 'normal'); // R > START → no rush
  assert.equal(z(4), 'last_minute'); // last-minute opens at the recommended lead
  assert.equal(z(3), 'last_minute'); // at the hard cutoff floor (still in range)
  assert.equal(z(2.9), 'expired'); // past the cutoff → not bookable
});

test('cutoff null ⇒ END defaults to 0 (accepts until the night before)', () => {
  const start = resolveLastMinuteStart({ recommendedLeadMonths: 2 });
  assert.equal(
    lastMinuteZone({ monthsRemaining: 1, startMonths: start, endMonths: null }),
    'last_minute',
  );
  assert.equal(
    lastMinuteZone({ monthsRemaining: -0.1, startMonths: start, endMonths: null }),
    'expired',
  );
});

test('misconfig guard: cutoff above the recommended lead ⇒ never a phantom zone', () => {
  // END (5) > START (3): empty last-minute window — only normal or expired.
  const start = resolveLastMinuteStart({ recommendedLeadMonths: 3 });
  assert.equal(lastMinuteZone({ monthsRemaining: 4, startMonths: start, endMonths: 5 }), 'normal');
  assert.equal(lastMinuteZone({ monthsRemaining: 3, startMonths: start, endMonths: 5 }), 'expired');
});

// ── AI-gating + surcharge (unchanged by the rewire, re-asserted) ──────────────

test('last_minute vendors are searchable for AI couples only; expired never', () => {
  assert.equal(isLastMinuteSearchable('normal', false), true);
  assert.equal(isLastMinuteSearchable('last_minute', false), false);
  assert.equal(isLastMinuteSearchable('last_minute', true), true);
  assert.equal(isLastMinuteSearchable('expired', true), false);
});

test('edge #2 empty-category is dormant when there is no (platform) group START', () => {
  // The caller drives edge #2 from the platform group START only — dark by data
  // (no platform START seeded) ⇒ never empties a category.
  assert.equal(
    categoryEmptyForGenericSearch({
      aiActive: false,
      monthsRemaining: 1,
      groupStartMonths: null,
    }),
    false,
  );
  // With a platform group START set and AI off + already in zone ⇒ empty.
  assert.equal(
    categoryEmptyForGenericSearch({
      aiActive: false,
      monthsRemaining: 2,
      groupStartMonths: 4,
    }),
    true,
  );
  // AI on ⇒ never empty.
  assert.equal(
    categoryEmptyForGenericSearch({
      aiActive: true,
      monthsRemaining: 2,
      groupStartMonths: 4,
    }),
    false,
  );
});

test('surcharge: null/0/out-of-range leave the base price; valid % bumps + rounds', () => {
  assert.equal(lastMinuteSurchargedPricePhp(10000, null), 10000);
  assert.equal(lastMinuteSurchargedPricePhp(10000, 0), 10000);
  assert.equal(lastMinuteSurchargedPricePhp(10000, 15), 11500);
  assert.equal(lastMinuteSurchargedPricePhp(9999, 15), 11499); // rounds
  assert.equal(lastMinuteSurchargedPricePhp(10000, 250), 20000); // clamps to 100%
});

// ── monthsToWedding — sanity (date primitive that feeds R) ───────────────────

test('monthsToWedding: null/blank date ⇒ null (no last-minute without a date)', () => {
  assert.equal(monthsToWedding(null), null);
  assert.equal(monthsToWedding(''), null);
  assert.equal(monthsToWedding('not-a-date'), null);
});

test('monthsToWedding: ~3 months out is positive, a past date is negative', () => {
  const now = new Date('2026-06-16T00:00:00Z');
  const threeMo = monthsToWedding('2026-09-16', now);
  assert.ok(threeMo !== null && threeMo > 2.9 && threeMo < 3.1);
  const past = monthsToWedding('2026-06-01', now);
  assert.ok(past !== null && past < 0);
});
