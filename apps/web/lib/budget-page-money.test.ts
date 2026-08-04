/**
 * budget-page-money.test.ts — BUD-2's proof that R1 is closed.
 *
 * The bug is not "a number is wrong". It is "three numbers on one screen are
 * computed over three different row sets", so the only test that means
 * anything is one that drives all three from the SAME fixture and asserts they
 * agree. The prod fixture below is the real event that exposed it
 * (`044f7e64…`): one `considering` vendor carrying ₱80,000.
 *
 * Flag OFF, the same fixture must still reproduce the CONTRADICTION verbatim —
 * that is the byte-identical promise, and a test that only checks the fixed
 * state would let a "fix" silently ship to production the day it merged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  budgetStripMoney,
  budgetLiveSummaryMoney,
  vendorCarriesMoney,
  vendorsToItemize,
} from './budget-page-money';
import type { EventMoney } from './budget-truth';
import type { BudgetLiveSummary, VendorBudgetSummary } from './budget';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A minimal VendorBudgetSummary — only the fields these functions read. */
function vendor(over: {
  id: string;
  status: string;
  totalCostPhp?: number | null;
  itemizedTotal?: number;
  paidTotal?: number;
  payments?: unknown[];
}): VendorBudgetSummary {
  return {
    vendor: {
      vendor_id: over.id,
      status: over.status,
      total_cost_php: over.totalCostPhp ?? null,
      vendor_name: `Vendor ${over.id}`,
    },
    lineItems: [],
    payments: (over.payments ?? []) as VendorBudgetSummary['payments'],
    itemizedTotal: over.itemizedTotal ?? 0,
    paidTotal: over.paidTotal ?? 0,
    remaining: 0,
    priceSource: 'manual',
    vendorControlledItems: [],
  } as unknown as VendorBudgetSummary;
}

/**
 * THE PROD FIXTURE. One `considering` vendor, ₱80,000, nothing contracted,
 * nothing paid, target ₱500,000.
 */
const CONSIDERING_80K = vendor({
  id: 'v-80k',
  status: 'considering',
  totalCostPhp: 80_000,
  itemizedTotal: 80_000,
});

/** What the resolver returns for that event: ₱80,000 is an ESTIMATE. */
const MONEY_80K_ESTIMATED: EventMoney = {
  targetPhp: 500_000,
  estimated: 80_000,
  committed: 0,
  paid: 0,
  stillOwed: 0,
  overpaid: 0,
  isOverBudget: false,
  overBudgetByPhp: 0,
  byBucket: [],
  lines: [],
  sources: [],
  warnings: [],
};

const LEGACY_CARD: BudgetLiveSummary = {
  budget: 80_000, // every vendor's itemized total, whatever the status
  paid: 0,
  remaining: 80_000,
  percentPaid: 0,
  upcoming: [],
};

const isConfirmed = (s: string) =>
  s === 'contracted' || s === 'deposit_paid' || s === 'delivered' || s === 'complete';

// ── R1 · the three surfaces must agree ──────────────────────────────────────

test('R1 · flag ON: the strip headline and the card headline are the SAME number', () => {
  const strip = budgetStripMoney({
    enabled: true,
    money: MONEY_80K_ESTIMATED,
    legacyCommittedPhp: 0,
    targetCentavos: 50_000_000,
  });
  const card = budgetLiveSummaryMoney({
    enabled: true,
    money: MONEY_80K_ESTIMATED,
    legacy: LEGACY_CARD,
  });
  assert.equal(strip.committedPhp, card.budget);
});

test('R1 · flag ON: the ₱80,000 vendor driving the headline HAS a card', () => {
  const shown = vendorsToItemize({
    enabled: true,
    vendors: [CONSIDERING_80K],
    isConfirmed,
  });
  assert.equal(shown.length, 1, 'a vendor carrying money must be reachable');
  assert.equal(shown[0]!.vendor.vendor_id, 'v-80k');
});

test('R1 · flag ON: ₱80,000 is reported as an ESTIMATE, never as committed', () => {
  const strip = budgetStripMoney({
    enabled: true,
    money: MONEY_80K_ESTIMATED,
    legacyCommittedPhp: 0,
    targetCentavos: 50_000_000,
  });
  assert.equal(strip.committedPhp, 0, 'a considering vendor is not a commitment');
  assert.equal(strip.estimatedPhp, 80_000, 'but it must still be visible');
});

test('R1 · flag OFF: the contradiction is reproduced EXACTLY (byte-identical promise)', () => {
  const strip = budgetStripMoney({
    enabled: false,
    money: MONEY_80K_ESTIMATED, // present, and deliberately ignored
    legacyCommittedPhp: 0,
    targetCentavos: 50_000_000,
  });
  const card = budgetLiveSummaryMoney({
    enabled: false,
    money: MONEY_80K_ESTIMATED,
    legacy: LEGACY_CARD,
  });
  const shown = vendorsToItemize({
    enabled: false,
    vendors: [CONSIDERING_80K],
    isConfirmed,
  });

  // This IS the live prod defect. If this assertion ever flips, the flag stopped
  // being a flag and BUD-2 shipped to production unflipped.
  assert.equal(strip.committedPhp, 0);
  assert.equal(card.budget, 80_000);
  assert.notEqual(strip.committedPhp, card.budget);
  assert.equal(shown.length, 0, 'and the vendor behind ₱80,000 is unreachable');
  assert.equal(strip.estimatedPhp, null, 'the legacy strip has no estimate to show');
});

// ── Degradation ─────────────────────────────────────────────────────────────

test('a null resolver result degrades to the legacy figures, never to a confident ₱0', () => {
  const strip = budgetStripMoney({
    enabled: true,
    money: null, // the resolver threw
    legacyCommittedPhp: 250_000,
    targetCentavos: 50_000_000,
  });
  assert.equal(strip.committedPhp, 250_000);
  assert.equal(strip.remainingPhp, 250_000);

  const card = budgetLiveSummaryMoney({ enabled: true, money: null, legacy: LEGACY_CARD });
  assert.deepEqual(card, LEGACY_CARD);
});

// ── R11 · overpayment must not silently cancel a debt ───────────────────────

test('R11 · remaining is stillOwed, not committed − paid, so an overpayment cannot net out', () => {
  const money: EventMoney = {
    ...MONEY_80K_ESTIMATED,
    estimated: 0,
    committed: 100_000,
    paid: 120_000, // one vendor overpaid by ₱25,000, another still owes ₱5,000
    stillOwed: 5_000,
    overpaid: 25_000,
  };
  const card = budgetLiveSummaryMoney({ enabled: true, money, legacy: LEGACY_CARD });
  assert.equal(card.remaining, 5_000, 'the real debt survives the overpayment');
  assert.notEqual(card.remaining, money.committed - money.paid);
});

// ── R12 · a credit is money ─────────────────────────────────────────────────

test('R12 · a credit-only vendor carries money — the test is !== 0, not > 0', () => {
  const credit = vendor({ id: 'v-credit', status: 'considering', itemizedTotal: -15_000 });
  assert.equal(vendorCarriesMoney(credit), true);
  assert.equal(
    vendorsToItemize({ enabled: true, vendors: [credit], isConfirmed }).length,
    1,
    'a vendor the couple is owed money by must be openable',
  );
});

test('a genuinely empty shortlisted vendor stays out of the list', () => {
  const empty = vendor({ id: 'v-empty', status: 'considering' });
  assert.equal(vendorCarriesMoney(empty), false);
  assert.equal(vendorsToItemize({ enabled: true, vendors: [empty], isConfirmed }).length, 0);
});

test('a contracted vendor renders under BOTH flag states, and order is preserved', () => {
  const rows = [
    vendor({ id: 'a', status: 'considering', totalCostPhp: 10_000 }),
    vendor({ id: 'b', status: 'contracted', totalCostPhp: 20_000 }),
    vendor({ id: 'c', status: 'considering' }),
  ];
  assert.deepEqual(
    vendorsToItemize({ enabled: false, vendors: rows, isConfirmed }).map(
      (s) => s.vendor.vendor_id,
    ),
    ['b'],
  );
  assert.deepEqual(
    vendorsToItemize({ enabled: true, vendors: rows, isConfirmed }).map(
      (s) => s.vendor.vendor_id,
    ),
    ['a', 'b'],
    'snapshot order (created_at asc) must survive the flag flip',
  );
});

// ── percentPaid is recomputed against the NEW base ──────────────────────────

test('percentPaid follows the committed base, not the legacy total', () => {
  const money: EventMoney = {
    ...MONEY_80K_ESTIMATED,
    estimated: 0,
    committed: 200_000,
    paid: 50_000,
    stillOwed: 150_000,
  };
  const card = budgetLiveSummaryMoney({ enabled: true, money, legacy: LEGACY_CARD });
  assert.equal(card.percentPaid, 25);
});

test('percentPaid is 0, not NaN, when nothing is committed yet', () => {
  const card = budgetLiveSummaryMoney({
    enabled: true,
    money: MONEY_80K_ESTIMATED,
    legacy: LEGACY_CARD,
  });
  assert.equal(card.percentPaid, 0);
});

// ── The target legs ─────────────────────────────────────────────────────────

test('no target set → remaining is null and nothing claims to be over budget', () => {
  const strip = budgetStripMoney({
    enabled: true,
    money: { ...MONEY_80K_ESTIMATED, targetPhp: null },
    legacyCommittedPhp: 0,
    targetCentavos: null,
  });
  assert.equal(strip.targetPhp, null);
  assert.equal(strip.remainingPhp, null);
  assert.equal(strip.isOverBudget, false);
});

test('over budget is the RESOLVER’s verdict, not a re-derivation', () => {
  const money: EventMoney = {
    ...MONEY_80K_ESTIMATED,
    committed: 600_000,
    estimated: 0,
    isOverBudget: true,
    overBudgetByPhp: 100_000,
  };
  const strip = budgetStripMoney({
    enabled: true,
    money,
    legacyCommittedPhp: 0,
    targetCentavos: 50_000_000,
  });
  assert.equal(strip.isOverBudget, true);
  assert.equal(strip.remainingPhp, -100_000);
});
