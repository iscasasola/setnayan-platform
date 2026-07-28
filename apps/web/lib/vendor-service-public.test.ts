/**
 * vendor-service-public.test.ts — the COUPLE-FACING discount badge.
 *
 * `pickBestDiscount` composes the one line a couple actually reads on a service
 * card, so the early-booking LADDER (owner-locked 2026-07-27) is only real if
 * this function names the right rung. What is pinned here:
 *
 *   • with an event date in context → the tier THEY qualify for is NAMED
 *     ("Booked 6+ months ahead · −10%"), and rungs they are too late for are
 *     dropped entirely rather than dangled;
 *   • anonymous (no event date) → the ladder is advertised as "Save up to …
 *     booking early", i.e. the existing best-tier badge, never a claim that
 *     they qualify;
 *   • every non-ladder discount keeps its exact pre-existing badge copy.
 *
 * `now` is injected everywhere — no test here depends on the wall clock.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBestDiscount } from './vendor-service-public';
import { DAYS_PER_MONTH } from './vendor-lead-time-tier';
import type { VendorServiceDiscount } from './vendor-services';

const NOW = new Date('2027-01-01T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;
const ANCHOR = 50_000; // "from ₱50,000"

function eventDateAtMonths(months: number): string {
  return new Date(NOW.getTime() + months * DAYS_PER_MONTH * MS_PER_DAY).toISOString();
}

function discount(p: Partial<VendorServiceDiscount>): VendorServiceDiscount {
  return {
    vendor_service_id: 's1',
    discount_type: 'early_booking',
    rate: 10,
    unit: 'pct',
    min_lead_months: null,
    expires_at: null,
    conditions_md: null,
    sort_order: 0,
    ...p,
  };
}

/** The owner's ladder: 12+ → −15%, 6+ → −10%. */
const ladder: VendorServiceDiscount[] = [
  discount({ rate: 15, min_lead_months: 12, sort_order: 0 }),
  discount({ rate: 10, min_lead_months: 6, sort_order: 1 }),
];

// ── With the couple's event date in context ─────────────────────────────────

test('event date 7 months out → the 6+ tier is NAMED on the badge', () => {
  const best = pickBestDiscount(ladder, ANCHOR, {
    eventDate: eventDateAtMonths(7),
    now: NOW,
  });
  assert.equal(best?.label, 'Booked 6+ months ahead · −10%');
  assert.equal(best?.leadTier, 6);
});

test('event date 13 months out → the 12+ tier wins and is NAMED', () => {
  const best = pickBestDiscount(ladder, ANCHOR, {
    eventDate: eventDateAtMonths(13),
    now: NOW,
  });
  assert.equal(best?.label, 'Booked 12+ months ahead · −15%');
  assert.equal(best?.leadTier, 12);
});

test('booking too late for every rung → NO badge (a tier is never dangled)', () => {
  const best = pickBestDiscount(ladder, ANCHOR, {
    eventDate: eventDateAtMonths(2),
    now: NOW,
  });
  assert.equal(best, null);
});

test('the couple never sees a HIGHER rung than they qualify for', () => {
  // 7 months out: −15% (the 12+ rung) is the bigger peso saving, and the old
  // savings-only ranking would have shown it. The ladder gate must drop it.
  const best = pickBestDiscount(ladder, ANCHOR, {
    eventDate: eventDateAtMonths(7),
    now: NOW,
  });
  assert.ok(best !== null);
  assert.ok(!best.label.includes('15%'), `must not advertise the 12+ rung: ${best.label}`);
  assert.equal(best.savingsPhp, 5_000, '10% of ₱50,000');
});

test('php-unit tiers name the rung too', () => {
  const phpLadder = [discount({ rate: 5000, unit: 'php', min_lead_months: 6 })];
  const best = pickBestDiscount(phpLadder, ANCHOR, {
    eventDate: eventDateAtMonths(8),
    now: NOW,
  });
  assert.equal(best?.label, 'Booked 6+ months ahead · −₱5,000');
});

test('a non-ladder discount can still out-save the qualified tier', () => {
  // A ₱20,000 bundle beats the 10% (₱5,000) tier — the ladder gate only filters
  // rungs, it does not privilege them.
  const mixed = [...ladder, discount({ discount_type: 'bundle', rate: 20_000, unit: 'php' })];
  const best = pickBestDiscount(mixed, ANCHOR, {
    eventDate: eventDateAtMonths(7),
    now: NOW,
  });
  assert.equal(best?.label, '₱20,000 off · bundle');
  assert.equal(best?.leadTier, null);
});

// ── Anonymous: no event date in context ─────────────────────────────────────

test('no event date → the ladder is advertised "up to", never as qualified', () => {
  const best = pickBestDiscount(ladder, ANCHOR, { now: NOW });
  assert.equal(best?.label, 'Save up to 15% booking early');
  assert.equal(best?.leadTier, 'up-to');
});

test('null event date behaves the same as an absent one', () => {
  const best = pickBestDiscount(ladder, ANCHOR, { eventDate: null, now: NOW });
  assert.equal(best?.label, 'Save up to 15% booking early');
});

test('anonymous view still ranks the ladder by peso savings, as it does today', () => {
  const best = pickBestDiscount(ladder, ANCHOR, { now: NOW });
  assert.equal(best?.savingsPhp, 7_500, '15% of ₱50,000 — the biggest rung');
});

// ── Legacy / unchanged behaviour ────────────────────────────────────────────

test('a thresholdless early_booking row keeps its ORIGINAL badge copy', () => {
  const legacy = [discount({ rate: 10, min_lead_months: null })];
  // …with an event date…
  assert.equal(
    pickBestDiscount(legacy, ANCHOR, { eventDate: eventDateAtMonths(7), now: NOW })?.label,
    '10% off · early booking',
  );
  // …and without one.
  assert.equal(
    pickBestDiscount(legacy, ANCHOR, { now: NOW })?.label,
    '10% off · early booking',
  );
});

test('a thresholdless early_booking row is never filtered out by the ladder gate', () => {
  // Booking 2 months out clears no rung, but the legacy unconditional offer
  // must still show — the gate may not downgrade what already shipped.
  const mixed = [...ladder, discount({ rate: 5, min_lead_months: null, sort_order: 2 })];
  const best = pickBestDiscount(mixed, ANCHOR, {
    eventDate: eventDateAtMonths(2),
    now: NOW,
  });
  assert.equal(best?.label, '5% off · early booking');
});

test('the other four discount types are untouched by the ladder', () => {
  for (const [type, label] of [
    ['off_peak', 'off-season'],
    ['bundle', 'bundle'],
    ['returning', 'returning couple'],
  ] as const) {
    const rows = [discount({ discount_type: type, rate: 12 })];
    const best = pickBestDiscount(rows, ANCHOR, {
      eventDate: eventDateAtMonths(7),
      now: NOW,
    });
    assert.equal(best?.label, `12% off · ${label}`);
    assert.equal(best?.leadTier, null);
  }
});

test('expired discounts are still dropped, ladder or not', () => {
  const expired = [
    discount({ discount_type: 'promo', rate: 50, expires_at: '2026-12-01T00:00:00Z' }),
    discount({ rate: 10, min_lead_months: 6, sort_order: 1 }),
  ];
  const best = pickBestDiscount(expired, ANCHOR, {
    eventDate: eventDateAtMonths(7),
    now: NOW,
  });
  assert.equal(best?.label, 'Booked 6+ months ahead · −10%');
});

test('no discounts / no anchor behave exactly as before', () => {
  assert.equal(pickBestDiscount([], ANCHOR, { now: NOW }), null);
  assert.equal(pickBestDiscount(undefined, ANCHOR, { now: NOW }), null);
  // A pct discount is meaningless with no base price.
  assert.equal(
    pickBestDiscount(ladder, null, { eventDate: eventDateAtMonths(13), now: NOW }),
    null,
  );
});

test('calling with no options at all still works (back-compatible signature)', () => {
  const legacy = [discount({ discount_type: 'bundle', rate: 3_000, unit: 'php' })];
  assert.equal(pickBestDiscount(legacy, ANCHOR)?.label, '₱3,000 off · bundle');
});

// ── `now` really is injected ────────────────────────────────────────────────

test('`now` injection: the same event date names a different tier as time passes', () => {
  const eventDate = eventDateAtMonths(13);
  assert.equal(
    pickBestDiscount(ladder, ANCHOR, { eventDate, now: NOW })?.label,
    'Booked 12+ months ahead · −15%',
  );
  const later = new Date(NOW.getTime() + 4 * DAYS_PER_MONTH * MS_PER_DAY);
  assert.equal(
    pickBestDiscount(ladder, ANCHOR, { eventDate, now: later })?.label,
    'Booked 6+ months ahead · −10%',
  );
});
