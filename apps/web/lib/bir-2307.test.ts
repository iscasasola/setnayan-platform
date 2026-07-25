/**
 * Unit suite for the quarterly BIR Form 2307 compute helpers
 * (lib/bir-2307.ts) — the pure half of POST /api/admin/cron/generate-2307.
 *
 * Two things carry real risk and are covered hardest:
 *   1. Quarter resolution across the PH/UTC day boundary. The cron fires just
 *      after midnight PHT, which is still the PREVIOUS day in UTC — reading
 *      UTC fields would file the wrong quarter every January.
 *   2. The per-order stage allocation. `lib/payouts.ts` stamps the ORDER-level
 *      withholding onto all three rows of a 20/60/20 release, so a naive sum
 *      triple-counts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateOrderTotals,
  buildVendorFilings,
  filingPayloadEquals,
  monthIndexInQuarter,
  parseQuarterOverride,
  quarterWindow,
  resolveAtcCode,
  resolveTargetQuarter,
  type PayoutRowForFiling,
} from './bir-2307';

// ---------------------------------------------------------------------------
// resolveTargetQuarter
// ---------------------------------------------------------------------------

test('mid-quarter run targets the previously-ended quarter', () => {
  // 2026-05-15 is in Q2 → the quarter that most recently ended is Q1 2026.
  assert.deepEqual(resolveTargetQuarter(new Date('2026-05-15T10:00:00+08:00')), {
    tax_year: 2026,
    tax_quarter: 1,
  });
});

test('the real cron instant (0 18 1 1,4,7,10 * UTC) resolves the just-ended quarter', () => {
  // 18:00 UTC on Jan 1 == 02:00 PHT on Jan 2 → still Q1 in PH → target Q4 2025.
  assert.deepEqual(resolveTargetQuarter(new Date('2026-01-01T18:00:00Z')), {
    tax_year: 2025,
    tax_quarter: 4,
  });
  // Same shape for the other three firings.
  assert.deepEqual(resolveTargetQuarter(new Date('2026-04-01T18:00:00Z')), {
    tax_year: 2026,
    tax_quarter: 1,
  });
  assert.deepEqual(resolveTargetQuarter(new Date('2026-07-01T18:00:00Z')), {
    tax_year: 2026,
    tax_quarter: 2,
  });
  assert.deepEqual(resolveTargetQuarter(new Date('2026-10-01T18:00:00Z')), {
    tax_year: 2026,
    tax_quarter: 3,
  });
});

test('Jan 1 PHT vs UTC — the year-turn case a UTC read gets wrong', () => {
  // 2026-01-01 00:00 PHT is 2025-12-31 16:00 UTC. On the PH calendar we are in
  // Q1 2026, so the target is Q4 2025. A UTC-based month read would see
  // December, call it Q4 2025 "current", and file Q3 2025 instead.
  const atPhtNewYear = new Date('2026-01-01T00:00:00+08:00');
  assert.equal(atPhtNewYear.toISOString(), '2025-12-31T16:00:00.000Z');
  assert.deepEqual(resolveTargetQuarter(atPhtNewYear), {
    tax_year: 2025,
    tax_quarter: 4,
  });

  // One second earlier is still Dec 31 in PH → Q4 is current → target Q3 2025.
  assert.deepEqual(
    resolveTargetQuarter(new Date('2025-12-31T23:59:59+08:00')),
    { tax_year: 2025, tax_quarter: 3 },
  );
});

test('Apr / Jul / Oct PHT midnight boundaries roll cleanly', () => {
  assert.deepEqual(resolveTargetQuarter(new Date('2026-04-01T00:00:00+08:00')), {
    tax_year: 2026,
    tax_quarter: 1,
  });
  assert.deepEqual(resolveTargetQuarter(new Date('2026-03-31T23:59:59+08:00')), {
    tax_year: 2025,
    tax_quarter: 4,
  });
  assert.deepEqual(resolveTargetQuarter(new Date('2026-07-01T00:00:00+08:00')), {
    tax_year: 2026,
    tax_quarter: 2,
  });
  assert.deepEqual(resolveTargetQuarter(new Date('2026-10-01T00:00:00+08:00')), {
    tax_year: 2026,
    tax_quarter: 3,
  });
});

// ---------------------------------------------------------------------------
// quarterWindow
// ---------------------------------------------------------------------------

test('quarter windows use PH calendar dates and PH-anchored instants', () => {
  assert.deepEqual(quarterWindow({ tax_year: 2026, tax_quarter: 1 }), {
    tax_year: 2026,
    tax_quarter: 1,
    period_from: '2026-01-01',
    period_to: '2026-03-31',
    starts_at_utc: '2025-12-31T16:00:00.000Z',
    ends_before_utc: '2026-03-31T16:00:00.000Z',
  });
  assert.deepEqual(quarterWindow({ tax_year: 2026, tax_quarter: 2 }), {
    tax_year: 2026,
    tax_quarter: 2,
    period_from: '2026-04-01',
    period_to: '2026-06-30',
    starts_at_utc: '2026-03-31T16:00:00.000Z',
    ends_before_utc: '2026-06-30T16:00:00.000Z',
  });
  assert.deepEqual(quarterWindow({ tax_year: 2026, tax_quarter: 3 }), {
    tax_year: 2026,
    tax_quarter: 3,
    period_from: '2026-07-01',
    period_to: '2026-09-30',
    starts_at_utc: '2026-06-30T16:00:00.000Z',
    ends_before_utc: '2026-09-30T16:00:00.000Z',
  });
});

test('Q4 rolls the exclusive upper bound into the next year', () => {
  const w = quarterWindow({ tax_year: 2025, tax_quarter: 4 });
  assert.equal(w.period_from, '2025-10-01');
  assert.equal(w.period_to, '2025-12-31');
  assert.equal(w.starts_at_utc, '2025-09-30T16:00:00.000Z');
  // 2026-01-01 00:00 PHT — the instant Q1 2026 opens.
  assert.equal(w.ends_before_utc, '2025-12-31T16:00:00.000Z');
});

test('windows are contiguous — one quarter ends exactly where the next begins', () => {
  const q1 = quarterWindow({ tax_year: 2026, tax_quarter: 1 });
  const q2 = quarterWindow({ tax_year: 2026, tax_quarter: 2 });
  assert.equal(q1.ends_before_utc, q2.starts_at_utc);
});

// ---------------------------------------------------------------------------
// parseQuarterOverride
// ---------------------------------------------------------------------------

test('no body / empty body / the pg_cron body all mean "use the default"', () => {
  assert.deepEqual(parseQuarterOverride(null), { ok: true, ref: null });
  assert.deepEqual(parseQuarterOverride(undefined), { ok: true, ref: null });
  assert.deepEqual(parseQuarterOverride({}), { ok: true, ref: null });
  assert.deepEqual(parseQuarterOverride({ triggered_by: 'pg_cron' }), {
    ok: true,
    ref: null,
  });
  // A non-object JSON payload is not an override either.
  assert.deepEqual(parseQuarterOverride([1, 2]), { ok: true, ref: null });
  assert.deepEqual(parseQuarterOverride('2026-Q1'), { ok: true, ref: null });
});

test('a complete override is accepted', () => {
  assert.deepEqual(parseQuarterOverride({ tax_year: 2026, tax_quarter: 3 }), {
    ok: true,
    ref: { tax_year: 2026, tax_quarter: 3 },
  });
  // Numeric strings coerce — a hand-rolled curl shouldn't be punished for it.
  assert.deepEqual(parseQuarterOverride({ tax_year: '2026', tax_quarter: '3' }), {
    ok: true,
    ref: { tax_year: 2026, tax_quarter: 3 },
  });
});

test('a half override is rejected rather than guessed at', () => {
  const yearOnly = parseQuarterOverride({ tax_year: 2026 });
  assert.equal(yearOnly.ok, false);
  const quarterOnly = parseQuarterOverride({ tax_quarter: 2 });
  assert.equal(quarterOnly.ok, false);
});

test('override bounds match the vendor_2307_filings CHECK constraints', () => {
  assert.equal(parseQuarterOverride({ tax_year: 2023, tax_quarter: 1 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 2101, tax_quarter: 1 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 2024, tax_quarter: 1 }).ok, true);
  assert.equal(parseQuarterOverride({ tax_year: 2100, tax_quarter: 4 }).ok, true);
  assert.equal(parseQuarterOverride({ tax_year: 2026, tax_quarter: 0 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 2026, tax_quarter: 5 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 2026, tax_quarter: 1.5 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 2026.5, tax_quarter: 1 }).ok, false);
  assert.equal(parseQuarterOverride({ tax_year: 'abc', tax_quarter: 1 }).ok, false);
});

// ---------------------------------------------------------------------------
// monthIndexInQuarter
// ---------------------------------------------------------------------------

test('month-of-quarter is 1..3 on the PH calendar', () => {
  assert.equal(monthIndexInQuarter('2026-01-15T09:00:00+08:00'), 1);
  assert.equal(monthIndexInQuarter('2026-02-15T09:00:00+08:00'), 2);
  assert.equal(monthIndexInQuarter('2026-03-31T23:00:00+08:00'), 3);
  assert.equal(monthIndexInQuarter('2026-04-01T00:00:00+08:00'), 1);
  assert.equal(monthIndexInQuarter('2026-12-31T23:00:00+08:00'), 3);
});

test('month-of-quarter follows PH, not UTC, across the day boundary', () => {
  // 2026-03-31 16:30 UTC == 2026-04-01 00:30 PHT → April → first month of Q2.
  assert.equal(monthIndexInQuarter('2026-03-31T16:30:00Z'), 1);
  // 2026-03-31 15:30 UTC == 2026-03-31 23:30 PHT → March → third month of Q1.
  assert.equal(monthIndexInQuarter('2026-03-31T15:30:00Z'), 3);
});

test('unparseable / missing timestamps yield null', () => {
  assert.equal(monthIndexInQuarter(null), null);
  assert.equal(monthIndexInQuarter(undefined), null);
  assert.equal(monthIndexInQuarter(''), null);
  assert.equal(monthIndexInQuarter('not-a-date'), null);
});

// ---------------------------------------------------------------------------
// resolveAtcCode
// ---------------------------------------------------------------------------

test('ATC defaults to the service_supplier code, split by TIN type', () => {
  assert.equal(resolveAtcCode(null), 'WI158');
  assert.equal(resolveAtcCode(undefined), 'WI158');
  assert.equal(resolveAtcCode({}), 'WI158');
  assert.equal(resolveAtcCode({ bir_service_category: null, tin_type: null }), 'WI158');
  assert.equal(
    resolveAtcCode({ bir_service_category: null, tin_type: 'corporation' }),
    'WC158',
  );
  assert.equal(
    resolveAtcCode({ bir_service_category: 'service_supplier', tin_type: 'individual' }),
    'WI158',
  );
  assert.equal(
    resolveAtcCode({ bir_service_category: 'service_supplier', tin_type: 'corporation' }),
    'WC158',
  );
});

test('professional / talent map to the first code of the migration pair', () => {
  assert.equal(resolveAtcCode({ bir_service_category: 'professional' }), 'WI151');
  assert.equal(resolveAtcCode({ bir_service_category: 'talent' }), 'WI080');
  // Those pairs are gross-receipt tiers, not an individual/corporate split, so
  // tin_type must NOT change them.
  assert.equal(
    resolveAtcCode({ bir_service_category: 'professional', tin_type: 'corporation' }),
    'WI151',
  );
});

test('an unrecognised category falls back to the service_supplier default', () => {
  assert.equal(resolveAtcCode({ bir_service_category: 'wedding_fairy' }), 'WI158');
});

// ---------------------------------------------------------------------------
// allocateOrderTotals — the triple-counting guard
// ---------------------------------------------------------------------------

/** Row factory. Order-level gross/withholding default to the ₱1,000 / 0.5% case. */
function payout(over: Partial<PayoutRowForFiling> & { payout_id: string }): PayoutRowForFiling {
  return {
    order_id: 'o1',
    vendor_profile_id: 'v1',
    paid_at: null,
    amount_centavos: 0,
    vendor_net_centavos: null,
    gross_centavos: 100_000,
    bir_withholding_centavos: 500,
    scheduled_at: null,
    ...over,
  };
}

test('a single immediate_full stage takes the whole order total', () => {
  const rows = [payout({ payout_id: 'p1', amount_centavos: 99_500 })];
  const shares = allocateOrderTotals(rows);
  assert.deepEqual(shares.get('p1'), { gross_centavos: 100_000, ewt_centavos: 500 });
});

test('a 20/60/20 release splits the order total — it never multiplies it', () => {
  const rows = [
    payout({ payout_id: 'p1', amount_centavos: 20_000, scheduled_at: '2026-01-05T00:00:00Z' }),
    payout({ payout_id: 'p2', amount_centavos: 60_000, scheduled_at: '2026-02-15T00:00:00Z' }),
    payout({ payout_id: 'p3', amount_centavos: 20_000, scheduled_at: '2026-02-15T00:00:00Z' }),
  ];
  const shares = allocateOrderTotals(rows);
  assert.deepEqual(shares.get('p1'), { gross_centavos: 20_000, ewt_centavos: 100 });
  assert.deepEqual(shares.get('p2'), { gross_centavos: 60_000, ewt_centavos: 300 });
  assert.deepEqual(shares.get('p3'), { gross_centavos: 20_000, ewt_centavos: 100 });

  // The whole point: the shares re-sum to ONE order's withholding (500), not
  // to the 1,500 a naive column sum would produce.
  const totalEwt = [...shares.values()].reduce((s, v) => s + v.ewt_centavos, 0);
  const totalGross = [...shares.values()].reduce((s, v) => s + v.gross_centavos, 0);
  assert.equal(totalEwt, 500);
  assert.equal(totalGross, 100_000);
});

test('rounding remainders land on the last stage — shares always re-sum exactly', () => {
  const rows = [
    payout({ payout_id: 'p1', amount_centavos: 20_000, bir_withholding_centavos: 501, scheduled_at: '2026-01-05T00:00:00Z' }),
    payout({ payout_id: 'p2', amount_centavos: 60_000, bir_withholding_centavos: 501, scheduled_at: '2026-02-15T00:00:00Z' }),
    payout({ payout_id: 'p3', amount_centavos: 20_000, bir_withholding_centavos: 501, scheduled_at: '2026-02-15T00:00:00Z' }),
  ];
  const shares = allocateOrderTotals(rows);
  assert.equal(shares.get('p1')?.ewt_centavos, 100); // floor(501 × 0.2)
  assert.equal(shares.get('p2')?.ewt_centavos, 300); // floor(501 × 0.6)
  assert.equal(shares.get('p3')?.ewt_centavos, 101); // remainder
  const total = [...shares.values()].reduce((s, v) => s + v.ewt_centavos, 0);
  assert.equal(total, 501);
});

test('allocation is order-independent (deterministic sort)', () => {
  const a = payout({ payout_id: 'p1', amount_centavos: 20_000, scheduled_at: '2026-01-05T00:00:00Z' });
  const b = payout({ payout_id: 'p2', amount_centavos: 60_000, scheduled_at: '2026-02-15T00:00:00Z' });
  const c = payout({ payout_id: 'p3', amount_centavos: 20_000, scheduled_at: '2026-02-15T00:00:00Z' });
  const forward = allocateOrderTotals([a, b, c]);
  const reversed = allocateOrderTotals([c, b, a]);
  for (const id of ['p1', 'p2', 'p3']) {
    assert.deepEqual(forward.get(id), reversed.get(id), `share for ${id}`);
  }
});

test('a zero-weight order puts the total on the first stage instead of dropping it', () => {
  const rows = [
    payout({ payout_id: 'p1', amount_centavos: 0, scheduled_at: '2026-01-05T00:00:00Z' }),
    payout({ payout_id: 'p2', amount_centavos: 0, scheduled_at: '2026-02-15T00:00:00Z' }),
  ];
  const shares = allocateOrderTotals(rows);
  assert.deepEqual(shares.get('p1'), { gross_centavos: 100_000, ewt_centavos: 500 });
  assert.deepEqual(shares.get('p2'), { gross_centavos: 0, ewt_centavos: 0 });
});

test('vendor_net_centavos is the weight fallback when amount_centavos is null', () => {
  const rows = [
    payout({ payout_id: 'p1', amount_centavos: null, vendor_net_centavos: 20_000, scheduled_at: '2026-01-05T00:00:00Z' }),
    payout({ payout_id: 'p2', amount_centavos: null, vendor_net_centavos: 80_000, scheduled_at: '2026-02-15T00:00:00Z' }),
  ];
  const shares = allocateOrderTotals(rows);
  assert.equal(shares.get('p1')?.ewt_centavos, 100);
  assert.equal(shares.get('p2')?.ewt_centavos, 400);
});

// ---------------------------------------------------------------------------
// buildVendorFilings
// ---------------------------------------------------------------------------

const Q1_2026 = quarterWindow({ tax_year: 2026, tax_quarter: 1 });

test('per-month aggregation attributes each paid stage to its PH month', () => {
  const rows: PayoutRowForFiling[] = [
    payout({
      payout_id: 'p1',
      amount_centavos: 20_000,
      scheduled_at: '2026-01-05T00:00:00Z',
      paid_at: '2026-01-10T09:00:00+08:00',
    }),
    payout({
      payout_id: 'p2',
      amount_centavos: 60_000,
      scheduled_at: '2026-02-15T00:00:00Z',
      paid_at: '2026-02-20T09:00:00+08:00',
    }),
    // Stage 3 is scheduled but not yet disbursed — it must not be certified.
    payout({
      payout_id: 'p3',
      amount_centavos: 20_000,
      scheduled_at: '2026-02-15T00:00:00Z',
      paid_at: null,
    }),
  ];

  const filings = buildVendorFilings({
    window: Q1_2026,
    rows,
    vendors: new Map([['v1', { bir_service_category: 'service_supplier', tin_type: 'individual' }]]),
  });

  assert.equal(filings.length, 1);
  const f = filings[0]!;
  assert.equal(f.vendor_profile_id, 'v1');
  assert.equal(f.atc_code, 'WI158');
  assert.deepEqual(f.monthly_breakdown, [
    { month_index: 1, atc_code: 'WI158', gross_centavos: 20_000, ewt_centavos: 100 },
    { month_index: 2, atc_code: 'WI158', gross_centavos: 60_000, ewt_centavos: 300 },
  ]);
  assert.equal(f.totals.gross_centavos, 80_000);
  // 400, NOT the 1,000 a naive sum of the two paid rows' column would report.
  assert.equal(f.totals.ewt_centavos, 400);
  assert.deepEqual(f.totals.atc_rows, [
    { atc_code: 'WI158', rate_bps: 50, gross_centavos: 80_000, ewt_centavos: 400 },
  ]);
  assert.deepEqual(f.payout_ids, ['p1', 'p2']);
});

test('payouts paid outside the quarter are excluded entirely', () => {
  const rows: PayoutRowForFiling[] = [
    payout({
      payout_id: 'p1',
      order_id: 'o9',
      vendor_profile_id: 'v9',
      amount_centavos: 100_000,
      // 2025-12-31 23:00 PHT — one hour before the quarter opens.
      paid_at: '2025-12-31T23:00:00+08:00',
    }),
  ];
  const filings = buildVendorFilings({ window: Q1_2026, rows, vendors: new Map() });
  assert.deepEqual(filings, []);
});

test('the quarter boundary is inclusive at the start, exclusive at the end', () => {
  const atOpen = payout({
    payout_id: 'p1',
    order_id: 'oa',
    vendor_profile_id: 'va',
    amount_centavos: 100_000,
    paid_at: '2026-01-01T00:00:00+08:00',
  });
  const atClose = payout({
    payout_id: 'p2',
    order_id: 'ob',
    vendor_profile_id: 'vb',
    amount_centavos: 100_000,
    paid_at: '2026-04-01T00:00:00+08:00',
  });
  const filings = buildVendorFilings({
    window: Q1_2026,
    rows: [atOpen, atClose],
    vendors: new Map(),
  });
  assert.deepEqual(
    filings.map((f) => f.vendor_profile_id),
    ['va'],
  );
});

test('a vendor with paid payouts but zero withheld is still recorded', () => {
  const rows: PayoutRowForFiling[] = [
    payout({
      payout_id: 'p1',
      order_id: 'o3',
      vendor_profile_id: 'v3',
      amount_centavos: 100_000,
      bir_withholding_centavos: 0,
      paid_at: '2026-01-20T09:00:00+08:00',
    }),
  ];
  const filings = buildVendorFilings({ window: Q1_2026, rows, vendors: new Map() });
  assert.equal(filings.length, 1);
  assert.equal(filings[0]!.totals.ewt_centavos, 0);
  assert.equal(filings[0]!.totals.gross_centavos, 100_000);
  // No gross-derived rate to report when nothing was withheld.
  assert.equal(filings[0]!.totals.atc_rows[0]!.rate_bps, 0);
});

test('multiple vendors are emitted in a stable order', () => {
  const rows: PayoutRowForFiling[] = [
    payout({
      payout_id: 'pb',
      order_id: 'ob',
      vendor_profile_id: 'v2',
      amount_centavos: 100_000,
      paid_at: '2026-03-15T09:00:00+08:00',
    }),
    payout({
      payout_id: 'pa',
      order_id: 'oa',
      vendor_profile_id: 'v1',
      amount_centavos: 100_000,
      paid_at: '2026-01-15T09:00:00+08:00',
    }),
  ];
  const filings = buildVendorFilings({
    window: Q1_2026,
    rows,
    vendors: new Map([['v2', { tin_type: 'corporation' }]]),
  });
  assert.deepEqual(
    filings.map((f) => f.vendor_profile_id),
    ['v1', 'v2'],
  );
  assert.equal(filings[0]!.monthly_breakdown[0]!.month_index, 1);
  assert.equal(filings[1]!.monthly_breakdown[0]!.month_index, 3);
  assert.equal(filings[1]!.atc_code, 'WC158');
});

test('no paid payouts → no filings (the expected, correct result today)', () => {
  const filings = buildVendorFilings({
    window: Q1_2026,
    rows: [payout({ payout_id: 'p1', amount_centavos: 100_000, paid_at: null })],
    vendors: new Map(),
  });
  assert.deepEqual(filings, []);
});

test('regeneration is deterministic — identical inputs produce identical payloads', () => {
  const rows: PayoutRowForFiling[] = [
    payout({
      payout_id: 'p1',
      amount_centavos: 20_000,
      scheduled_at: '2026-01-05T00:00:00Z',
      paid_at: '2026-01-10T09:00:00+08:00',
    }),
    payout({
      payout_id: 'p2',
      amount_centavos: 80_000,
      scheduled_at: '2026-02-15T00:00:00Z',
      paid_at: '2026-02-20T09:00:00+08:00',
    }),
  ];
  const first = buildVendorFilings({ window: Q1_2026, rows, vendors: new Map() });
  const second = buildVendorFilings({
    window: Q1_2026,
    rows: [...rows].reverse(),
    vendors: new Map(),
  });
  assert.equal(first.length, 1);
  assert.ok(filingPayloadEquals(first[0]!, second[0]!));
});

test('filingPayloadEquals detects a genuine change in the figures', () => {
  const a = { monthly_breakdown: [{ month_index: 1, ewt_centavos: 100 }], totals: { ewt_centavos: 100 } };
  const b = { monthly_breakdown: [{ month_index: 1, ewt_centavos: 101 }], totals: { ewt_centavos: 101 } };
  assert.equal(filingPayloadEquals(a, a), true);
  assert.equal(filingPayloadEquals(a, b), false);
});

test('filingPayloadEquals ignores key order — jsonb reorders keys on write', () => {
  // What the generator builds vs. what Postgres hands back (jsonb normalises
  // key order: shortest first, then bytewise). Same numbers, different order.
  const built = {
    monthly_breakdown: [
      { month_index: 1, atc_code: 'WI158', gross_centavos: 20_000, ewt_centavos: 100 },
    ],
    totals: {
      gross_centavos: 20_000,
      ewt_centavos: 100,
      atc_rows: [{ atc_code: 'WI158', rate_bps: 50, gross_centavos: 20_000, ewt_centavos: 100 }],
    },
  };
  const readBack = {
    monthly_breakdown: [
      { atc_code: 'WI158', ewt_centavos: 100, gross_centavos: 20_000, month_index: 1 },
    ],
    totals: {
      atc_rows: [{ rate_bps: 50, ewt_centavos: 100, atc_code: 'WI158', gross_centavos: 20_000 }],
      ewt_centavos: 100,
      gross_centavos: 20_000,
    },
  };
  assert.equal(filingPayloadEquals(built, readBack), true);
  // A raw stringify compare would have said "changed" — that's the bug this
  // guards against, and it would have made every re-run churn the row.
  assert.notEqual(
    JSON.stringify(built.monthly_breakdown),
    JSON.stringify(readBack.monthly_breakdown),
  );
});

test('filingPayloadEquals still respects array order', () => {
  const a = { monthly_breakdown: [{ month_index: 1 }, { month_index: 2 }], totals: {} };
  const b = { monthly_breakdown: [{ month_index: 2 }, { month_index: 1 }], totals: {} };
  assert.equal(filingPayloadEquals(a, b), false);
});
