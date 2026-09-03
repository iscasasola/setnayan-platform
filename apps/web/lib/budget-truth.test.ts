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
  bucketForCost,
  bucketForVendor,
  isVendorPayerOrder,
  OTHER_BUCKET,
  SETNAYAN_BUCKET,
  type EventCostMoneyRow,
  type EventMoney,
  type MoneyInputs,
  type VendorMoneyRow,
} from './budget-truth';
import type { VendorPricingLookup } from './budget';
import { TRIGGER_THRESHOLDS } from './setnayan-ai-triggers';

// ── Fixture helpers ──────────────────────────────────────────────────────────

/**
 * The clock every fixture is measured against. Fixed, so the due-date
 * boundaries below mean the same thing on every machine and on every day the
 * suite runs — `computeEventMoney` takes `now` as an input for exactly this.
 */
const NOW = new Date('2026-01-01T00:00:00.000Z');
/** `n` days after NOW, as the bare `YYYY-MM-DD` a due_date column holds. */
const dueIn = (n: number): string =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString().slice(0, 10);

const base = (over: Partial<MoneyInputs> = {}): MoneyInputs => ({
  now: NOW,
  targetCentavos: null,
  vendors: [],
  lineItems: [],
  payments: [],
  orders: [],
  costs: [],
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

// ── The dated ledger — overdue is a first-class state (BA5) ──────────────────
//
// THE DEFECT: before this, a payment the couple had ALREADY MISSED appeared in
// no roll-up and fired no alert. It did not render as a warning; it rendered as
// nothing — byte-identical to an event with no payments due at all.

/** One contracted vendor whose whole price is dated manual line items. */
const dated = (items: Array<{ id: string; amount: number; day: number }>): MoneyInputs =>
  base({
    vendors: [vendor({ vendor_id: 'a', total_cost_php: null })],
    lineItems: items.map((it) => ({
      line_item_id: it.id,
      vendor_id: 'a',
      label: it.id,
      amount_php: it.amount,
      due_date: dueIn(it.day),
    })),
  });

test('BA5 · THE BOUNDARY DAYS — -1 · 0 · +1 · +7 · +8 · +30 · +31', () => {
  const cases: Array<[number, 'overdue' | 'due_soon' | 'upcoming' | 'later']> = [
    [-1, 'overdue'],
    [0, 'due_soon'], // DUE TODAY IS NOT LATE
    [1, 'due_soon'],
    [TRIGGER_THRESHOLDS.paymentDueWindowDays, 'due_soon'], // 7, inclusive
    [TRIGGER_THRESHOLDS.paymentDueWindowDays + 1, 'upcoming'], // 8
    [TRIGGER_THRESHOLDS.paymentHorizonDays, 'upcoming'], // 30, inclusive
    [TRIGGER_THRESHOLDS.paymentHorizonDays + 1, 'later'], // 31
  ];
  for (const [day, expected] of cases) {
    const m = computeEventMoney(dated([{ id: 'li', amount: 1000, day }]));
    const line = m.lines.find((l) => l.costKey === 'line:li')!;
    assert.equal(line.dueState, expected, `day ${day}`);
    assert.equal(line.daysUntilDue, day, `day ${day} count`);

    const band = {
      overdue: [m.due.overduePhp, m.due.overdueCount],
      due_soon: [m.due.dueSoonPhp, m.due.dueSoonCount],
      upcoming: [m.due.upcomingPhp, m.due.upcomingCount],
      later: [m.due.laterPhp, m.due.laterCount],
    }[expected];
    assert.deepEqual(band, [1000, 1], `day ${day} rolls up into ${expected}`);
    // …and into nothing else. The bands are DISJOINT.
    const total =
      m.due.overduePhp + m.due.dueSoonPhp + m.due.upcomingPhp + m.due.laterPhp;
    assert.equal(total, 1000, `day ${day} is counted exactly once`);
  }
});

test('BA5 · an overdue milestone is counted, named, and lands in its bucket', () => {
  const m = computeEventMoney(
    dated([
      { id: 'late1', amount: 30000, day: -5 },
      { id: 'late2', amount: 12000, day: -1 },
      { id: 'soon', amount: 5000, day: 3 },
    ]),
  );
  assert.equal(m.due.overduePhp, 42000);
  assert.equal(m.due.overdueCount, 2);
  assert.equal(m.due.dueSoonPhp, 5000);

  const w = m.warnings.find((x) => x.code === 'payment_overdue')!;
  assert.ok(w, 'overdue must be NAMED, not only counted — a figure can go unread');
  assert.equal(w.amountPhp, 42000);
  assert.match(w.message, /2 payments are past their due date/);

  // Rolled up per bucket, not only at the top.
  const b = m.byBucket.find((x) => x.bucketId === 'photography')!;
  assert.equal(b.due.overduePhp, 42000);
  assert.equal(b.due.overdueCount, 2);
  assert.equal(b.due.dueSoonPhp, 5000);
  assert.equal(
    m.byBucket.reduce((acc, x) => acc + x.due.overduePhp, 0),
    m.due.overduePhp,
    'the buckets add up to the headline',
  );
});

test('BA5 · a milestone that was PAID is settled, not overdue, however old', () => {
  const m = computeEventMoney({
    ...dated([{ id: 'li', amount: 20000, day: -400 }]),
    payments: [
      { payment_id: 'p1', vendor_id: 'a', line_item_id: 'li', amount_php: 20000, paid_at: '2025-01-01' },
    ],
  });
  const line = m.lines.find((l) => l.costKey === 'line:li')!;
  assert.equal(line.dueState, 'settled');
  assert.equal(m.due.overduePhp, 0);
  assert.equal(m.due.overdueCount, 0);
  assert.equal(
    m.warnings.some((w) => w.code === 'payment_overdue'),
    false,
    'never alert a couple about money they have already handed over',
  );
});

test('BA5 · a PARTLY paid overdue milestone carries only what is still owed', () => {
  const m = computeEventMoney({
    ...dated([{ id: 'li', amount: 20000, day: -3 }]),
    payments: [
      { payment_id: 'p1', vendor_id: 'a', line_item_id: 'li', amount_php: 8000, paid_at: '2025-12-20' },
    ],
  });
  const line = m.lines.find((l) => l.costKey === 'line:li')!;
  assert.equal(line.dueState, 'overdue');
  assert.equal(line.stillOwedPhp, 12000);
  assert.equal(m.due.overduePhp, 12000, 'the overdue figure is the REMAINDER, not the milestone');
});

test('BA5 · an ESTIMATE is never late — nobody agreed to pay it', () => {
  const m = computeEventMoney(
    base({
      // `considering` → every line is an estimate (§18.5 rule 3).
      vendors: [vendor({ vendor_id: 'a', status: 'considering', total_cost_php: null })],
      lineItems: [
        { line_item_id: 'li', vendor_id: 'a', label: 'deposit', amount_php: 50000, due_date: dueIn(-90) },
      ],
    }),
  );
  const line = m.lines.find((l) => l.costKey === 'line:li')!;
  assert.equal(line.kind, 'estimated');
  assert.equal(line.dueState, 'none');
  assert.equal(m.due.overduePhp, 0);
  assert.equal(m.estimated, 50000);
});

test('BA5 · undated money is `none`, never silently swept into a band', () => {
  const m = computeEventMoney(
    base({
      vendors: [
        vendor({ vendor_id: 'a', total_cost_php: 100000, transport_php: 3000, food_allowance_php: 1500 }),
      ],
      orders: [
        { order_id: 'o1', description: 'Papic', service_key: null, requested_total_php: 2999, confirmed_total_php: null, status: 'awaiting_payment' },
      ],
    }),
  );
  assert.ok(m.lines.length >= 4);
  for (const l of m.lines) {
    assert.equal(l.dueState, 'none', `${l.costKey} has no due date`);
    assert.equal(l.daysUntilDue, null);
  }
  assert.deepEqual(
    [m.due.overduePhp, m.due.dueSoonPhp, m.due.upcomingPhp, m.due.laterPhp],
    [0, 0, 0, 0],
  );
  assert.ok(m.stillOwed > 0, 'the money is still owed — it simply has no date');
});

test('BA5 · an unparseable due date is never called late', () => {
  const m = computeEventMoney(
    base({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: null })],
      lineItems: [
        { line_item_id: 'li', vendor_id: 'a', label: 'x', amount_php: 1000, due_date: 'not-a-date' },
      ],
    }),
  );
  const line = m.lines.find((l) => l.costKey === 'line:li')!;
  assert.equal(line.dueState, 'none');
  assert.equal(line.daysUntilDue, null);
  assert.equal(m.due.overduePhp, 0);
});

test('BA5 · the dated bands never exceed what is actually still owed', () => {
  const check = (m: EventMoney, label: string) => {
    const banded =
      m.due.overduePhp + m.due.dueSoonPhp + m.due.upcomingPhp + m.due.laterPhp;
    assert.ok(
      Math.round(banded * 100) <= Math.round(m.stillOwed * 100),
      `${label}: dated bands ₱${banded} exceed still owed ₱${m.stillOwed}`,
    );
  };
  check(
    computeEventMoney(
      dated([
        { id: 'a1', amount: 10000, day: -2 },
        { id: 'a2', amount: 10000, day: 5 },
        { id: 'a3', amount: 10000, day: 40 },
      ]),
    ),
    'mixed bands',
  );
  // Overpaid: money already handed over cannot still be owed on any date.
  check(
    computeEventMoney({
      ...dated([{ id: 'li', amount: 10000, day: -10 }]),
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 25000, paid_at: '2025-12-01' },
      ],
    }),
    'overpaid vendor',
  );
  for (const e of capture.events) check(resolveFixture(e.slug), `prod ${e.slug}`);
});

test('BA5 · the page and the email read ONE definition of "due soon"', () => {
  // Not a restatement of the boundary test: this asserts the resolver's band
  // edge IS `TRIGGER_THRESHOLDS.paymentDueWindowDays`, so moving that constant
  // moves both surfaces. Two mechanisms that disagree about "due soon" is the
  // defect this project keeps finding.
  const w = TRIGGER_THRESHOLDS.paymentDueWindowDays;
  assert.equal(
    computeEventMoney(dated([{ id: 'li', amount: 1, day: w }])).lines.find(
      (l) => l.costKey === 'line:li',
    )!.dueState,
    'due_soon',
  );
  assert.equal(
    computeEventMoney(dated([{ id: 'li', amount: 1, day: w + 1 }])).lines.find(
      (l) => l.costKey === 'line:li',
    )!.dueState,
    'upcoming',
  );
});

// ── BA7 · MONEY WITH NO SUPPLIER ─────────────────────────────────────────────
//
// The whole point of this source is that it adds a peso to `committed` from a
// row that has no `vendor_id`. THE INVARIANT is what proves that addition did
// not quietly break the reconciliation, so every case below asserts it —
// including the ones where the new source is the ONLY money on the event.

const cost = (
  over: Partial<EventCostMoneyRow> & { cost_id: string },
): EventCostMoneyRow => ({
  plan_group_id: 'rings',
  label: `Cost ${over.cost_id}`,
  amount_php: 0,
  paid_php: 0,
  due_date: null,
  ...over,
});

test('BA7 · a cost with NO supplier is committed money, and the invariant holds', () => {
  const m = computeEventMoney(
    base({ costs: [cost({ cost_id: 'c1', amount_php: 40000, paid_php: 15000 })] }),
  );
  assert.equal(m.committed, 40000);
  assert.equal(m.paid, 15000);
  assert.equal(m.stillOwed, 25000);
  assert.equal(m.overpaid, 0);
  invariantHolds(m, 'cost only');

  // It is a LINE, reachable and attributable — not a number added to a total
  // with nothing behind it. That is what makes it editable on the page.
  const line = m.lines.find((l) => l.costKey === 'cost:c1');
  assert.ok(line, 'the cost produced no line');
  assert.equal(line!.source, 'event_cost');
  assert.equal(line!.vendorId, null);
  assert.equal(line!.vendorName, null);
  assert.equal(line!.readOnly, false, "the couple's own cost must stay editable");
  assert.equal(line!.kind, 'committed');
});

test('BA7 · rings can be recorded with NO vendor row in existence', () => {
  // The defect, stated as a test. Before `event_costs` this event could not
  // hold a single peso: every line item needed an event_vendors row.
  const m = computeEventMoney(
    base({
      vendors: [],
      costs: [
        cost({ cost_id: 'rings', plan_group_id: 'rings', label: 'Wedding rings', amount_php: 40000, paid_php: 40000 }),
        cost({ cost_id: 'lic', plan_group_id: 'wedding_paperwork', label: 'Marriage licence', amount_php: 600, paid_php: 600 }),
        cost({ cost_id: 'pao', plan_group_id: 'other', label: 'Ang pao', amount_php: 12000, paid_php: 0 }),
      ],
    }),
  );
  assert.equal(m.committed, 52600);
  assert.equal(m.paid, 40600);
  assert.equal(m.stillOwed, 12000);
  invariantHolds(m, 'three supplier-less costs');

  // Each lands in ITS OWN bucket, which is what makes BA3's ledger show them
  // on the row the couple picked.
  const by = new Map(m.byBucket.map((b) => [b.bucketId, b]));
  assert.equal(by.get('rings')!.committedPhp, 40000);
  assert.equal(by.get('wedding_paperwork')!.committedPhp, 600);
  assert.equal(by.get(OTHER_BUCKET)!.committedPhp, 12000);
});

test('BA7 · an overpaid cost is NAMED, not clamped, and the totals still add up', () => {
  const m = computeEventMoney(
    base({ costs: [cost({ cost_id: 'c1', label: 'Rings', amount_php: 40000, paid_php: 45000 })] }),
  );
  assert.equal(m.committed, 40000);
  assert.equal(m.paid, 45000);
  assert.equal(m.stillOwed, 0);
  assert.equal(m.overpaid, 5000);
  invariantHolds(m, 'overpaid cost');
  const w = m.warnings.find((x) => x.code === 'overpaid_cost');
  assert.ok(w, 'an overpaid cost was silently clamped');
  assert.equal(w!.amountPhp, 5000);
  // NOT the vendor warning: every field of that one names a supplier, and
  // there is none here to name.
  assert.equal(m.warnings.some((x) => x.code === 'overpaid_vendor'), false);
});

test('BA7 · the invariant survives costs mixed with every other source', () => {
  const m = computeEventMoney(
    base({
      targetCentavos: 50_000_00,
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100000, transport_php: 2500 })],
      payments: [
        { payment_id: 'p1', vendor_id: 'a', line_item_id: null, amount_php: 30000, paid_at: '2026-01-01' },
      ],
      orders: [
        {
          order_id: 'o1',
          description: 'Setnayan AI',
          service_key: 'SETNAYAN_AI',
          requested_total_php: 2999,
          confirmed_total_php: 2999,
          status: 'paid',
        },
      ],
      costs: [
        cost({ cost_id: 'c1', amount_php: 40000, paid_php: 40000 }),
        cost({ cost_id: 'c2', plan_group_id: 'attire', amount_php: 18000, paid_php: 25000 }),
        cost({ cost_id: 'c3', plan_group_id: 'officiant', amount_php: 15000, paid_php: 0 }),
      ],
    }),
  );
  invariantHolds(m, 'costs beside vendors and orders');
  // The new source appears in provenance, so a caller can say where the money
  // came from instead of printing an unattributable total.
  const note = m.sources.find((s) => s.source === 'event_cost');
  assert.ok(note, 'event_cost produced no provenance note');
  assert.equal(note!.table, 'event_costs');
  assert.equal(note!.isEstimate, false);
  assert.equal(note!.rowCount, 3);
});

test('BA7 · a dated, unpaid cost is banded like any other commitment', () => {
  const m = computeEventMoney(
    base({
      costs: [
        cost({ cost_id: 'late', amount_php: 5000, paid_php: 0, due_date: dueIn(-3) }),
        cost({ cost_id: 'settled', amount_php: 5000, paid_php: 5000, due_date: dueIn(-3) }),
      ],
    }),
  );
  // BA5's rule, applied to the new source without a second copy of it: a date
  // that passed with money still owed is overdue; a date that passed on money
  // already handed over is settled.
  assert.equal(m.due.overduePhp, 5000);
  assert.equal(m.due.overdueCount, 1);
  assert.equal(m.lines.find((l) => l.costKey === 'cost:late')!.dueState, 'overdue');
  assert.equal(m.lines.find((l) => l.costKey === 'cost:settled')!.dueState, 'settled');
  invariantHolds(m, 'dated costs');
});

test('BA7 · an unknown category buckets to `other` and never loses the money', () => {
  // `event_costs.plan_group_id` is TEXT, so an id the taxonomy has never heard
  // of is reachable. It must not make a peso disappear — the same rule
  // `bucketForVendor` follows for an unmappable vendor category.
  assert.equal(bucketForCost('rings'), 'rings');
  assert.equal(bucketForCost('not_a_real_group'), OTHER_BUCKET);
  assert.equal(bucketForCost(null), OTHER_BUCKET);
  assert.equal(bucketForCost('   '), OTHER_BUCKET);
  assert.equal(bucketForCost(SETNAYAN_BUCKET), SETNAYAN_BUCKET);

  const m = computeEventMoney(
    base({ costs: [cost({ cost_id: 'c1', plan_group_id: 'not_a_real_group', amount_php: 7000 })] }),
  );
  assert.equal(m.committed, 7000);
  assert.equal(m.byBucket.find((b) => b.bucketId === OTHER_BUCKET)!.committedPhp, 7000);
  invariantHolds(m, 'unknown category');
});

test('BA7 · a zero-everything cost contributes nothing and produces no line', () => {
  const m = computeEventMoney(base({ costs: [cost({ cost_id: 'c1' })] }));
  assert.equal(m.committed, 0);
  assert.equal(m.lines.some((l) => l.source === 'event_cost'), false);
  assert.equal(m.byBucket.length, 0, 'an empty cost opened a bucket with nothing in it');
  invariantHolds(m, 'zero cost');
});
