/**
 * Unit suite for the shared money resolver (BUD-1 · §18.1).
 *
 * Load-bearing invariants, in the order the spec ranks them:
 *   · THE INVARIANT — committed + overpaid === paid + stillOwed, on EVERY
 *     fixture including the two real prod captures. §18.5 rule 6.
 *   · Estimates never enter committed or stillOwed. §18.5 rule 3.
 *   · The double-count precedence (package vs service vs manual vs headline)
 *     is preserved from lib/budget.ts, with R4/R12 corrected.
 *   · Unknown is unknown, never ₱0. §18.5 rule 5.
 *   · The R-defects BUD-1 owns: R3 · R4 · R5 · R8 · R11 · R12.
 *
 * ⚠ MUTATION TEST: `invariant catches a deliberately broken total` proves the
 *   assertion actually bites. If you break the arithmetic in budget-truth.ts,
 *   `every fixture satisfies the invariant` must go red — it is not decorative.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  computeEventMoney,
  checkMoneyInvariant,
  bucketForVendor,
  isVendorPayerOrder,
  OTHER_BUCKET,
  SETNAYAN_BUCKET,
  type EventMoney,
  type MoneyInputs,
  type VendorMoneyRow,
} from './budget-truth';
import type { VendorPricingLookup } from './budget';

// ── Fixture helpers ──────────────────────────────────────────────────────────

const base = (over: Partial<MoneyInputs> = {}): MoneyInputs => ({
  targetCentavos: null,
  vendors: [],
  lineItems: [],
  payments: [],
  orders: [],
  pricing: new Map() as VendorPricingLookup,
  packageLockedCentavos: new Map(),
  benchmarks: [],
  ...over,
});

const vendor = (over: Partial<VendorMoneyRow> & { vendor_id: string }): VendorMoneyRow => ({
  event_id: 'e1',
  category: 'photographer',
  vendor_name: `Vendor ${over.vendor_id}`,
  status: 'contracted',
  total_cost_php: null,
  transport_php: null,
  food_allowance_php: null,
  deposit_paid_php: null,
  covers_plan_groups: [],
  archived_at: null,
  voided_by_fraud: false,
  package_role: null,
  event_vendor_package_id: null,
  marketplace_vendor_id: null,
  ...over,
});

const invariantHolds = (m: EventMoney, label: string) => {
  const violation = checkMoneyInvariant(m);
  assert.equal(violation, null, `${label}: ${violation ?? ''}`);
  assert.ok(
    !m.warnings.some((w) => w.code === 'invariant_violation'),
    `${label}: resolver flagged its own totals`,
  );
};

// ── THE INVARIANT ────────────────────────────────────────────────────────────

test('invariant holds on the simple case', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 30000, paid_at: '2026-01-01' },
      ],
    }),
  );
  assert.equal(m.committed, 100000);
  assert.equal(m.paid, 30000);
  assert.equal(m.stillOwed, 70000);
  assert.equal(m.overpaid, 0);
  invariantHolds(m, 'simple');
});

test('R11 · an overpaid vendor is NAMED and the totals still reconcile', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 120000, paid_at: '2026-01-01' },
      ],
    }),
  );
  assert.equal(m.committed, 100000);
  assert.equal(m.paid, 120000);
  assert.equal(m.stillOwed, 0);
  assert.equal(m.overpaid, 20000);
  // §18.5 rule 6 — "if a vendor is overpaid, name it".
  const w = m.warnings.find((x) => x.code === 'overpaid_vendor');
  assert.ok(w, 'overpaid vendor must be named in warnings[]');
  assert.equal(w!.vendorId, 'a');
  assert.equal(w!.amountPhp, 20000);
  invariantHolds(m, 'overpaid');
});

test('invariant survives credits, overpayment and estimates in one event', () => {
  const m = computeEventMoney(
    base({
      targetCentavos: 50000000,
      vendors: [
        vendor({ vendor_id: 'a', total_cost_php: 100000 }),
        vendor({ vendor_id: 'b', status: 'considering', total_cost_php: 250000 }),
        vendor({ vendor_id: 'c', total_cost_php: 60000, transport_php: 5000, food_allowance_php: 3000 }),
      ],
      lineItems: [
        { line_item_id: 'l1', vendor_id: 'a', label: 'Coverage', amount_php: 100000, due_date: null },
        { line_item_id: 'l2', vendor_id: 'a', label: 'Change-order credit', amount_php: -15000, due_date: null },
      ],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: 'l1', amount_php: 50000, paid_at: '2026-01-01' },
        { payment_id: 'p2', vendor_id: 'c', line_item_id: null, amount_php: 99000, paid_at: '2026-01-02' },
      ],
    }),
  );
  invariantHolds(m, 'mixed');
  assert.equal(m.estimated, 250000, 'the shortlisted vendor is an estimate, not a commitment');
});

test('MUTATION · the invariant check catches a deliberately broken total', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 30000, paid_at: '2026-01-01' },
      ],
    }),
  );
  assert.equal(checkMoneyInvariant(m), null);
  // Break it the way a careless surface would: quietly drop ₱1 of what's owed.
  const broken: EventMoney = { ...m, stillOwed: m.stillOwed - 1 };
  const violation = checkMoneyInvariant(broken);
  assert.ok(violation, 'a broken total MUST be reported, never silently rendered');
  assert.match(violation!, /do not reconcile/);
});

// ── §18.5 rule 3 · estimates never enter committed or stillOwed ──────────────

test('a shortlisted vendor with a recorded price is ESTIMATED, never committed', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', status: 'considering', total_cost_php: 80000 })],
    }),
  );
  assert.equal(m.committed, 0, 'nobody has agreed to this money');
  assert.equal(m.stillOwed, 0, 'the couple must never be told they owe it');
  assert.equal(m.estimated, 80000);
  assert.equal(m.lines[0]!.kind, 'estimated');
  const note = m.sources.find((s) => s.kind === 'estimated');
  assert.ok(note?.isEstimate, 'sources[] must mark it so a caller can label it');
});

test('a vendor still being shopped but already PAID counts only what was paid', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', status: 'shortlisted', total_cost_php: 80000 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 10000, paid_at: '2026-01-01' },
      ],
    }),
  );
  assert.equal(m.committed, 10000, 'only the money that actually moved is a commitment');
  assert.equal(m.paid, 10000);
  assert.equal(m.stillOwed, 0);
  assert.equal(m.estimated, 80000);
  assert.ok(m.warnings.some((w) => w.code === 'payment_without_commitment'));
  invariantHolds(m, 'paid-but-unbooked');
});

test('§18.5 rule 4 · only agreed money can make an event over budget', () => {
  const m = computeEventMoney(
    base({
      targetCentavos: 10000000, // ₱100,000
      vendors: [
        vendor({ vendor_id: 'a', status: 'considering', total_cost_php: 900000 }),
        vendor({ vendor_id: 'b', total_cost_php: 40000 }),
      ],
    }),
  );
  assert.equal(m.isOverBudget, false, 'a ₱900k shortlist is NOT "over budget"');
  assert.equal(m.overBudgetByPhp, 0);

  const over = computeEventMoney(
    base({
      targetCentavos: 10000000,
      vendors: [vendor({ vendor_id: 'b', total_cost_php: 140000 })],
    }),
  );
  assert.equal(over.isOverBudget, true);
  assert.equal(over.overBudgetByPhp, 40000);
});

// ── The double-count precedence (preserved from lib/budget.ts ~:636-645) ─────

const pricingWith = (
  vendorId: string,
  kind: 'package' | 'service',
  items: Array<{ id: string; amount: number }>,
): VendorPricingLookup =>
  new Map([
    [
      vendorId,
      {
        priceSource: kind,
        items: items.map((i) => ({
          source_id: `${kind === 'package' ? 'pkg' : 'svc'}:${i.id}`,
          source_kind: kind,
          label: i.id,
          amount_php: i.amount,
          vendor_business_name: 'X',
        })),
      },
    ],
  ]) as VendorPricingLookup;

test('catalogue items win over a stale headline (no double-count)', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 999999 })],
      pricing: pricingWith('a', 'service', [{ id: 's1', amount: 50000 }]),
    }),
  );
  assert.equal(m.committed, 50000, 'headline must not be added on top of catalogue pricing');
});

test('manual line items REPLACE the headline, never add to it', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000 })],
      lineItems: [
        { line_item_id: 'l1', vendor_id: 'a', label: 'Coverage', amount_php: 70000, due_date: null },
        { line_item_id: 'l2', vendor_id: 'a', label: 'Album', amount_php: 30000, due_date: null },
      ],
    }),
  );
  assert.equal(m.committed, 100000);
  assert.equal(m.lines.length, 2, 'exactly the two line rows — no headline row alongside them');
});

test('R12 · a credit-only line on a package vendor is NOT discarded', () => {
  // Shipped code tests `manualItemized > 0`, so a negative-only manual list
  // fails the test and the credit vanishes.
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({
          vendor_id: 'a',
          total_cost_php: 200000,
          package_role: 'anchor',
          event_vendor_package_id: 'bk1',
        }),
      ],
      lineItems: [
        { line_item_id: 'l1', vendor_id: 'a', label: 'Removed the SDE', amount_php: -25000, due_date: null },
      ],
      pricing: pricingWith('a', 'package', [
        { id: 'i1', amount: 120000 },
        { id: 'i2', amount: 150000 },
      ]),
    }),
  );
  assert.equal(m.committed, 175000, '₱200,000 agreed − ₱25,000 credit');
  invariantHolds(m, 'package credit');
});

test('R12 · credits exceeding charges do NOT revert a vendor to their headline', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 300000 })],
      lineItems: [
        { line_item_id: 'l1', vendor_id: 'a', label: 'Refund', amount_php: -5000, due_date: null },
      ],
    }),
  );
  assert.equal(m.committed, -5000, 'the ledger says −₱5,000, not the stale ₱300,000');
  assert.ok(m.warnings.some((w) => w.code === 'net_credit_vendor'));
  invariantHolds(m, 'net credit');
});

// ── R3 / R4 · the package cascade ────────────────────────────────────────────

test('R3 · covered rows contribute ₱0 — a package is billed ONCE', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({
          vendor_id: 'anchor',
          category: 'photographer',
          total_cost_php: 200000,
          package_role: 'anchor',
          event_vendor_package_id: 'bk1',
        }),
        vendor({
          vendor_id: 'cov1',
          category: 'videographer',
          total_cost_php: 90000,
          package_role: 'covered',
          event_vendor_package_id: 'bk1',
        }),
        vendor({
          vendor_id: 'cov2',
          category: 'photobooth',
          total_cost_php: 40000,
          package_role: 'covered',
          event_vendor_package_id: 'bk1',
        }),
      ],
    }),
  );
  assert.equal(m.committed, 200000, 'not 200k + 90k + 40k');
  const w = m.warnings.find((x) => x.code === 'package_covered_zeroed');
  assert.ok(w);
  assert.equal(w!.amountPhp, 130000, 'the zeroed money is named, not silently dropped');
  invariantHolds(m, 'package cascade');
});

test('R4 · the AGREED package total wins over Σ replacement values', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({
          vendor_id: 'anchor',
          total_cost_php: 200000,
          package_role: 'anchor',
          event_vendor_package_id: 'bk1',
        }),
      ],
      // The catalogue's replacement values sum to ₱310,000 — including optional
      // items the couple never bought.
      pricing: pricingWith('anchor', 'package', [
        { id: 'i1', amount: 120000 },
        { id: 'i2', amount: 150000 },
        { id: 'i3-optional', amount: 40000 },
      ]),
    }),
  );
  assert.equal(m.committed, 200000);
  assert.equal(m.lines[0]!.source, 'vendor_package');
});

test('R4 · an anchor with no headline falls back to the locked booking total', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({
          vendor_id: 'anchor',
          total_cost_php: null,
          package_role: 'anchor',
          event_vendor_package_id: 'bk1',
        }),
      ],
      packageLockedCentavos: new Map([['bk1', 18000000]]),
    }),
  );
  assert.equal(m.committed, 180000);
});

// ── R5 · transport + crew meals ──────────────────────────────────────────────

test('R5 · transport and crew meals are counted, and separately labelled', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({
          vendor_id: 'a',
          total_cost_php: 100000,
          transport_php: 8000,
          food_allowance_php: 4500,
        }),
      ],
    }),
  );
  assert.equal(m.committed, 112500);
  const sources = m.sources.map((s) => s.source);
  assert.ok(sources.includes('vendor_transport'), 'transport carries its own provenance');
  assert.ok(sources.includes('vendor_crew_meal'), 'crew meals carry their own provenance');
  // Owner decision §18.6 #1 is answerable by subtraction, without re-computing.
  const extras = m.sources
    .filter((s) => s.source === 'vendor_transport' || s.source === 'vendor_crew_meal')
    .reduce((acc, s) => acc + s.amountPhp, 0);
  assert.equal(m.committed - extras, 100000);
});

// ── R8 · archived + fraud-voided rows ────────────────────────────────────────

test('R8 · an archived vendor stops spending the couple’s money — and is named', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({ vendor_id: 'a', total_cost_php: 100000 }),
        vendor({ vendor_id: 'gone', total_cost_php: 250000, archived_at: '2026-06-25T00:00:00Z' }),
      ],
      lineItems: [
        { line_item_id: 'l1', vendor_id: 'gone', label: 'Ghost', amount_php: 250000, due_date: null },
      ],
      payments: [
        { payment_id: 'p1', vendor_id: 'gone', line_item_id: 'l1', amount_php: 50000, paid_at: '2026-01-01' },
      ],
    }),
  );
  assert.equal(m.committed, 100000);
  assert.equal(m.paid, 0, 'the archived row’s payments leave with it');
  assert.ok(m.warnings.some((w) => w.code === 'archived_excluded'));
  invariantHolds(m, 'archived');
});

test('a fraud-voided booking is excluded and named', () => {
  const m = computeEventMoney(
    base({ vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000, voided_by_fraud: true })] }),
  );
  assert.equal(m.committed, 0);
  assert.ok(m.warnings.some((w) => w.code === 'fraud_voided_excluded'));
});

// ── R6 · deposits must not double-count ──────────────────────────────────────

test('R6 · deposit_paid_php is a FALLBACK, never added to the payment log', () => {
  // Prod shape: three vendors whose deposit_paid_php duplicates an identical
  // payment row. Adding both would invent ₱111,500 that was never paid twice.
  const both = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 225000, deposit_paid_php: 67500 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 67500, paid_at: '2026-06-01' },
      ],
    }),
  );
  assert.equal(both.paid, 67500, 'not 135,000');
  invariantHolds(both, 'deposit + payment');

  // …and with no payment log at all, the legacy field still counts.
  const onlyDeposit = computeEventMoney(
    base({ vendors: [vendor({ vendor_id: 'a', total_cost_php: 225000, deposit_paid_php: 67500 })] }),
  );
  assert.equal(onlyDeposit.paid, 67500, 'a lone deposit is real money and must be counted');
  invariantHolds(onlyDeposit, 'deposit only');
});

test('a deposit larger than the payment log is flagged, not summed', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 200000, deposit_paid_php: 80000 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 50000, paid_at: '2026-06-01' },
      ],
    }),
  );
  assert.equal(m.paid, 50000);
  assert.ok(m.warnings.some((w) => w.code === 'unreconciled_deposit'));
});

// ── R7 · Setnayan orders as ledger rows ──────────────────────────────────────

test('R7 · Setnayan orders enter as LINE ROWS, with the right status mapping', () => {
  const m = computeEventMoney(
    base({
      orders: [
        { order_id: 'o1', description: 'Papic', service_key: 'PAPIC', requested_total_php: 2999, confirmed_total_php: null, status: 'paid' },
        { order_id: 'o2', description: 'Panood', service_key: null, requested_total_php: 2499, confirmed_total_php: 2000, status: 'awaiting_payment' },
        { order_id: 'o3', description: 'Applied', service_key: null, requested_total_php: 1000, confirmed_total_php: null, status: 'submitted' },
        { order_id: 'o4', description: 'Refunded', service_key: null, requested_total_php: 5000, confirmed_total_php: null, status: 'refunded' },
        { order_id: 'o5', description: 'Draft', service_key: null, requested_total_php: 7000, confirmed_total_php: null, status: 'draft' },
      ],
    }),
  );
  assert.equal(m.committed, 4999, 'paid ₱2,999 + awaiting-payment ₱2,000');
  assert.equal(m.paid, 2999);
  assert.equal(m.stillOwed, 2000);
  assert.equal(m.estimated, 1000, 'applied-but-unapproved is an estimate, not a debt');
  assert.equal(m.lines.length, 3, 'draft and refunded are not money at all');
  assert.ok(m.lines.every((l) => l.bucket !== SETNAYAN_BUCKET || l.readOnly));
  assert.equal(
    m.lines.find((l) => l.costKey === 'order:o2')!.amountPhp,
    2000,
    'confirmed_total_php wins over requested_total_php',
  );
  invariantHolds(m, 'orders');
});

test('a VENDOR-payer booking fee never enters the COUPLE’s total', () => {
  // `booking-fee-lock.server.ts:129-160` stamps the vendor's own fee with the
  // couple's event_id. A naive `orders WHERE event_id = …` would bill the
  // couple for their photographer's Setnayan commission.
  const m = computeEventMoney(
    base({
      orders: [
        { order_id: 'o1', description: 'Papic', service_key: 'PAPIC_CAMERA_MINI_DAY', requested_total_php: 2999, confirmed_total_php: null, status: 'paid' },
        {
          order_id: 'fee',
          description: 'Setnayan booking fee (5% up to ₱100,000) — up for verification',
          service_key: 'vendor_booking_fee__abc123',
          requested_total_php: 4000,
          confirmed_total_php: null,
          status: 'paid',
          vendor_profile_id: 'vp1',
        },
      ],
    }),
  );
  assert.equal(m.committed, 2999, 'the ₱4,000 vendor fee must NOT be in the couple’s budget');
  assert.equal(m.paid, 2999);
  assert.ok(m.lines.every((l) => l.costKey !== 'order:fee'));
  const w = m.warnings.find((x) => x.code === 'vendor_payer_order_excluded')!;
  assert.ok(w, 'the exclusion is named, never silent');
  assert.equal(w.amountPhp, 4000);
  assert.equal(isVendorPayerOrder({ service_key: 'vendor_pro_28d' }), true);
  assert.equal(isVendorPayerOrder({ service_key: 'SETNAYAN_AI' }), false);
  assert.equal(isVendorPayerOrder({ service_key: null }), false);
  invariantHolds(m, 'vendor-payer order');
});

// ── §18.5 rule 5 · unknown is unknown, never ₱0 ─────────────────────────────

test('a category with no benchmark reports UNKNOWN, not ₱0', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({ vendor_id: 'a', category: 'photographer', total_cost_php: 90000 }),
        vendor({ vendor_id: 'b', category: 'religious_venue', total_cost_php: 20000 }),
      ],
      benchmarks: [
        { plan_group_id: 'photography', benchmark_php: 90000 },
        // ceremony_venue is a Tier-2 leaf that ships with a NULL benchmark.
        { plan_group_id: 'ceremony_venue', benchmark_php: null },
      ],
      scopePlanGroupIds: ['photography', 'ceremony_venue', 'catering'],
    }),
  );
  const photo = m.byBucket.find((b) => b.bucketId === 'photography')!;
  assert.equal(photo.hasBenchmark, true);
  assert.equal(photo.benchmarkPhp, 90000);

  const ceremony = m.byBucket.find((b) => b.bucketId === 'ceremony_venue')!;
  assert.equal(ceremony.hasBenchmark, false);
  assert.equal(ceremony.benchmarkPhp, null, 'null, NOT 0 — the caller prints "no typical price yet"');

  const w = m.warnings.find((x) => x.code === 'benchmark_unseeded')!;
  assert.ok(w, 'unseeded leaves must be surfaced, not silently costed at ₱0');
  assert.deepEqual(w.bucketIds, ['catering', 'ceremony_venue']);
});

// ── Bucketing (R2's raw material — nothing is ever skipped) ──────────────────

test('a vendor with empty covers_plan_groups still lands in a real bucket', () => {
  // checklist-budget.ts:186 does `if (groups.length === 0) continue;`, which is
  // why ₱810,000 of live commitments read as ₱0 today.
  assert.equal(bucketForVendor(vendor({ vendor_id: 'a', category: 'photographer' })), 'photography');
  assert.equal(
    bucketForVendor(vendor({ vendor_id: 'a', category: 'photographer', covers_plan_groups: ['catering'] })),
    'catering',
    'an explicit plan group wins',
  );
  // `misc` is claimed by the Logistics plan group; a category no group claims
  // (the non-wedding gap leaves) falls to Other — and is still COUNTED.
  assert.equal(bucketForVendor(vendor({ vendor_id: 'a', category: 'misc' })), 'logistics');
  assert.equal(bucketForVendor(vendor({ vendor_id: 'a', category: 'event_medic' })), OTHER_BUCKET);
});

test('every peso lands in exactly one bucket', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({ vendor_id: 'a', category: 'photographer', total_cost_php: 90000 }),
        vendor({ vendor_id: 'b', category: 'misc', total_cost_php: 10000 }),
      ],
      orders: [
        { order_id: 'o1', description: 'Papic', service_key: null, requested_total_php: 2999, confirmed_total_php: null, status: 'paid' },
      ],
    }),
  );
  const bucketSum = m.byBucket.reduce((acc, b) => acc + b.committedPhp, 0);
  assert.equal(bucketSum, m.committed);
  const keys = new Set(m.lines.map((l) => l.costKey));
  assert.equal(keys.size, m.lines.length, 'one peso, one row, one costKey');
});

// ── The real prod captures ───────────────────────────────────────────────────

type Capture = {
  benchmarks?: Array<{ plan_group_id: string; benchmark_php: number | null }>;
  events: Array<{
    slug: string;
    targetCentavos: number | null;
    vendors: VendorMoneyRow[];
    lineItems: MoneyInputs['lineItems'];
    payments: MoneyInputs['payments'];
    orders: MoneyInputs['orders'];
  }>;
};

// Resolve from the runner's cwd whether it is apps/web (pnpm test:unit) or the
// repo root (turbo / CI), so the suite never silently skips the real data.
const FIXTURE = [
  'scripts/fixtures/budget-parity-prod.json',
  'apps/web/scripts/fixtures/budget-parity-prod.json',
]
  .map((p) => path.resolve(process.cwd(), p))
  .find((p) => fs.existsSync(p));
assert.ok(FIXTURE, 'prod parity fixture not found — the real-data assertions cannot be skipped');

const capture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Capture;

const resolveFixture = (slug: string): EventMoney => {
  const e = capture.events.find((x) => x.slug === slug)!;
  return computeEventMoney(
    base({
      targetCentavos: e.targetCentavos,
      vendors: e.vendors,
      lineItems: e.lineItems,
      payments: e.payments,
      orders: e.orders,
      benchmarks: capture.benchmarks ?? [],
    }),
  );
};

test('PROD · every captured event satisfies the invariant', () => {
  for (const e of capture.events) invariantHolds(resolveFixture(e.slug), `prod ${e.slug}`);
});

test('PROD prod-A · the ₱810,000 the checklist card currently drops', () => {
  const m = resolveFixture('prod-A');
  assert.equal(m.committed, 810000);
  assert.equal(m.paid, 111500, 'the three deposits are counted ONCE, not twice');
  assert.equal(m.stillOwed, 698500);
  assert.equal(m.overpaid, 0);
  assert.equal(m.estimated, 0);
  assert.equal(m.isOverBudget, false, 'target ₱930,000');
  assert.ok(m.warnings.some((w) => w.code === 'archived_excluded'));
});

test('PROD prod-B · the live "Total to pay ₱80,000 / Committed ₱0" contradiction', () => {
  const m = resolveFixture('prod-B');
  // ONE answer now: nobody has agreed to the ₱80,000, so it is an estimate.
  assert.equal(m.committed, 0);
  assert.equal(m.stillOwed, 0, 'the couple is never told they owe money nobody agreed to');
  assert.equal(m.estimated, 80000);
  assert.equal(m.isOverBudget, false);
  assert.ok(m.lines.every((l) => l.kind === 'estimated'));
  invariantHolds(m, 'prod-B');
});
