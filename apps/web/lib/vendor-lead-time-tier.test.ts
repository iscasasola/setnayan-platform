/**
 * vendor-lead-time-tier.test.ts — the EARLY-BOOKING LADDER resolver.
 *
 * Owner ruling 2026-07-27: the couple's event date picks the tier, automatically
 * and on their card — never in chat. Everything the badge later claims rests on
 * `applicableLeadTimeTier` picking the RIGHT rung, so this file pins:
 *
 *   • exact boundaries (12.0 months qualifies, 11.99 does not);
 *   • LARGEST applicable rung wins (a couple 13 months out gets 12+, not 6+);
 *   • NULL-threshold legacy rows are never treated as rungs;
 *   • no tiers / no event date / past events → null;
 *   • `now` really is injected (moving the clock alone changes the answer).
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applicableLeadTimeTier,
  isLeadTimeTier,
  leadTimeTierLabel,
  monthsUntil,
  DAYS_PER_MONTH,
  type LeadTimeCandidate,
} from './vendor-lead-time-tier';

/** A fixed clock — every date below is computed from it, never from "today". */
const NOW = new Date('2027-01-01T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;

/** An event date exactly `months` away from NOW, on the 30.44-day definition. */
function eventDateAtMonths(months: number): string {
  const at = new Date(NOW.getTime() + months * DAYS_PER_MONTH * MS_PER_DAY);
  return at.toISOString();
}

type Row = LeadTimeCandidate & { id: string };

const ladder: Row[] = [
  { id: 'r12', discount_type: 'early_booking', min_lead_months: 12 },
  { id: 'r6', discount_type: 'early_booking', min_lead_months: 6 },
  { id: 'r3', discount_type: 'early_booking', min_lead_months: 3 },
];

// ── Boundaries ──────────────────────────────────────────────────────────────

test('exact boundary: 12.0 months away QUALIFIES for the 12+ rung', () => {
  const tier = applicableLeadTimeTier(ladder, eventDateAtMonths(12), NOW);
  assert.equal(tier?.id, 'r12', '12.0 months must satisfy a "12+ months" tier');
});

test('exact boundary: 11.99 months away falls back to the 6+ rung, not 12+', () => {
  const tier = applicableLeadTimeTier(ladder, eventDateAtMonths(11.99), NOW);
  assert.equal(tier?.id, 'r6', 'just under 12 must NOT claim the 12+ tier');
});

test('exact boundary: 6.0 months qualifies for 6+; 5.999 drops to 3+', () => {
  assert.equal(applicableLeadTimeTier(ladder, eventDateAtMonths(6), NOW)?.id, 'r6');
  assert.equal(applicableLeadTimeTier(ladder, eventDateAtMonths(5.999), NOW)?.id, 'r3');
});

// ── Ladder semantics ────────────────────────────────────────────────────────

test('multiple tiers: the LARGEST applicable rung wins (13 months → 12+)', () => {
  const tier = applicableLeadTimeTier(ladder, eventDateAtMonths(13), NOW);
  assert.equal(tier?.id, 'r12');
});

test('row order does not matter — the pick is by threshold, not by position', () => {
  const shuffled = [ladder[2]!, ladder[0]!, ladder[1]!];
  assert.equal(applicableLeadTimeTier(shuffled, eventDateAtMonths(13), NOW)?.id, 'r12');
});

test('booking too late for every rung → null (no discount is dangled)', () => {
  assert.equal(applicableLeadTimeTier(ladder, eventDateAtMonths(1), NOW), null);
});

test('an event already in the past → null (negative months clear every rung)', () => {
  assert.equal(applicableLeadTimeTier(ladder, eventDateAtMonths(-4), NOW), null);
});

test('no tiers at all → null', () => {
  assert.equal(applicableLeadTimeTier([], eventDateAtMonths(24), NOW), null);
  assert.equal(applicableLeadTimeTier(undefined, eventDateAtMonths(24), NOW), null);
  assert.equal(applicableLeadTimeTier(null, eventDateAtMonths(24), NOW), null);
});

// ── Legacy / garbage rows are not rungs ─────────────────────────────────────

test('legacy early_booking rows with a NULL threshold are IGNORED as rungs', () => {
  const legacyOnly: Row[] = [
    { id: 'legacy', discount_type: 'early_booking', min_lead_months: null },
  ];
  assert.equal(applicableLeadTimeTier(legacyOnly, eventDateAtMonths(24), NOW), null);
  // …and a legacy row mixed into a real ladder never displaces a real rung.
  const mixed: Row[] = [...legacyOnly, ...ladder];
  assert.equal(applicableLeadTimeTier(mixed, eventDateAtMonths(24), NOW)?.id, 'r12');
});

test('a missing (undefined) threshold is treated the same as NULL', () => {
  const rows: Row[] = [{ id: 'undef', discount_type: 'early_booking' }];
  assert.equal(applicableLeadTimeTier(rows, eventDateAtMonths(24), NOW), null);
});

test('non-early_booking rows never become tiers, however far out the event is', () => {
  const others: Row[] = [
    { id: 'off', discount_type: 'off_peak', min_lead_months: 6 },
    { id: 'promo', discount_type: 'promo', min_lead_months: 6 },
    { id: 'bundle', discount_type: 'bundle', min_lead_months: 6 },
    { id: 'ret', discount_type: 'returning', min_lead_months: 6 },
  ];
  assert.equal(applicableLeadTimeTier(others, eventDateAtMonths(24), NOW), null);
});

test('garbage thresholds (0, negative, NaN, Infinity) are refused', () => {
  const junk: Row[] = [
    { id: 'zero', discount_type: 'early_booking', min_lead_months: 0 },
    { id: 'neg', discount_type: 'early_booking', min_lead_months: -6 },
    { id: 'nan', discount_type: 'early_booking', min_lead_months: Number.NaN },
    { id: 'inf', discount_type: 'early_booking', min_lead_months: Number.POSITIVE_INFINITY },
  ];
  assert.equal(applicableLeadTimeTier(junk, eventDateAtMonths(240), NOW), null);
});

// ── No event date in context (the anonymous case) ───────────────────────────

test('no event date → null, whatever the ladder says', () => {
  assert.equal(applicableLeadTimeTier(ladder, null, NOW), null);
  assert.equal(applicableLeadTimeTier(ladder, undefined, NOW), null);
  assert.equal(applicableLeadTimeTier(ladder, '', NOW), null);
});

test('an unparseable event date is "no date", not a crash', () => {
  assert.equal(applicableLeadTimeTier(ladder, 'someday', NOW), null);
  assert.equal(monthsUntil('not-a-date', NOW), null);
});

// ── `now` is genuinely injected ─────────────────────────────────────────────

test('`now` injection: the SAME event date resolves to different tiers as the clock moves', () => {
  const eventDate = eventDateAtMonths(13); // 13 months after NOW

  assert.equal(
    applicableLeadTimeTier(ladder, eventDate, NOW)?.id,
    'r12',
    'standing at NOW the couple is 13 months out',
  );

  // Stand 8 months later: the same event is now ~5 months away → the 3+ rung.
  const later = new Date(NOW.getTime() + 8 * DAYS_PER_MONTH * MS_PER_DAY);
  assert.equal(
    applicableLeadTimeTier(ladder, eventDate, later)?.id,
    'r3',
    'the resolver must read the injected clock, not the ambient one',
  );

  // Stand 14 months later: the event has passed → no tier.
  const after = new Date(NOW.getTime() + 14 * DAYS_PER_MONTH * MS_PER_DAY);
  assert.equal(applicableLeadTimeTier(ladder, eventDate, after), null);
});

test('monthsUntil uses the 30.44-day month and is signed', () => {
  const months = monthsUntil(eventDateAtMonths(6), NOW);
  assert.ok(months !== null);
  assert.ok(Math.abs((months as number) - 6) < 1e-6, `expected ~6, got ${months}`);
  assert.ok((monthsUntil(eventDateAtMonths(-2), NOW) as number) < 0, 'past events go negative');
});

// ── Helpers ─────────────────────────────────────────────────────────────────

test('isLeadTimeTier only accepts early_booking rows with a real threshold', () => {
  assert.equal(isLeadTimeTier({ discount_type: 'early_booking', min_lead_months: 6 }), true);
  assert.equal(isLeadTimeTier({ discount_type: 'early_booking', min_lead_months: null }), false);
  assert.equal(isLeadTimeTier({ discount_type: 'early_booking' }), false);
  assert.equal(isLeadTimeTier({ discount_type: 'off_peak', min_lead_months: 6 }), false);
  assert.equal(isLeadTimeTier({ discount_type: 'early_booking', min_lead_months: 0 }), false);
});

test('leadTimeTierLabel speaks the owner’s copy, singular-aware', () => {
  assert.equal(leadTimeTierLabel(6), 'Booked 6+ months ahead');
  assert.equal(leadTimeTierLabel(12), 'Booked 12+ months ahead');
  assert.equal(leadTimeTierLabel(1), 'Booked 1+ month ahead');
});
