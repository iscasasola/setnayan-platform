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
 *
 * ─── BA2 (owner ruling 2026-09-02) ──────────────────────────────────────────
 * BUD-2 closed R1 by WIDENING the page — the ₱80,000 got a card and the strip
 * named it as an estimate. The owner chose the other resolution: `/budget`
 * shows finalized money only. So the assertions below flipped where they must:
 * the ₱80,000 vendor has NO card and the strip has NO estimate field, in BOTH
 * flag states. The fixture is unchanged, and the flag-OFF leg still proves the
 * legacy card and the strip disagree — that divergence is the resolver's job,
 * not this display rule's.
 *
 * The narrowing itself is guarded in `no-quotes-on-the-budget-page.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  budgetStripMoney,
  budgetLiveSummaryMoney,
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
  // Nothing is contracted, so there is no dated milestone to be late on.
  due: {
    overduePhp: 0,
    overdueCount: 0,
    dueSoonPhp: 0,
    dueSoonCount: 0,
    upcomingPhp: 0,
    upcomingCount: 0,
    laterPhp: 0,
    laterCount: 0,
  },
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

test('BA2 · the ₱80,000 considering vendor gets NO card — a quote is not finalized', () => {
  const shown = vendorsToItemize({ vendors: [CONSIDERING_80K], isConfirmed });
  assert.equal(shown.length, 0, 'shopping happens in the Merkado, not here');
});

test('R1 · flag ON: ₱80,000 never becomes committed, and is not named here either', () => {
  const strip = budgetStripMoney({
    enabled: true,
    money: MONEY_80K_ESTIMATED,
    legacyCommittedPhp: 0,
    targetCentavos: 50_000_000,
  });
  assert.equal(strip.committedPhp, 0, 'a considering vendor is not a commitment');
  // BA2 · §18.5 rule 3 does not apply once the vendor leaves the list: there is
  // no ₱0-beside-₱80,000 on this page left to explain.
  assert.ok(
    !Object.keys(strip).some((k) => /estimat/i.test(k)),
    'the strip carries no estimate field to print',
  );
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
  const shown = vendorsToItemize({ vendors: [CONSIDERING_80K], isConfirmed });

  // This IS the pre-resolver prod defect. If this assertion ever flips, the flag
  // stopped being a flag and BUD-2 shipped to production unflipped.
  assert.equal(strip.committedPhp, 0);
  assert.equal(card.budget, 80_000);
  assert.notEqual(strip.committedPhp, card.budget);
  assert.equal(shown.length, 0, 'and the vendor behind ₱80,000 has no card');
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

// ── BA2 · money does not earn a card; being contracted does ─────────────────

test('BA2 · a credit-only shortlisted vendor still gets no card', () => {
  // R12's insight (a change-order CREDIT is a negative line, so the test can
  // never be `> 0`) lives on in `budget-truth.ts`, where the arithmetic is.
  // What changed is that carrying money — in either direction — is no longer
  // what puts a row on this page.
  const credit = vendor({ id: 'v-credit', status: 'considering', itemizedTotal: -15_000 });
  assert.equal(vendorsToItemize({ vendors: [credit], isConfirmed }).length, 0);
});

test('an off-platform vendor at contracted DOES get a card — status decides, not platform', () => {
  // "Off-platform is not the same as final." A manually-added supplier the
  // couple has signed with is finalized money and belongs here.
  const manual = vendor({ id: 'v-manual', status: 'contracted', totalCostPhp: 45_000 });
  assert.equal(vendorsToItemize({ vendors: [manual], isConfirmed }).length, 1);
});

test('only the contracted rows survive, and snapshot order is preserved', () => {
  const rows = [
    vendor({ id: 'a', status: 'considering', totalCostPhp: 10_000 }),
    vendor({ id: 'b', status: 'contracted', totalCostPhp: 20_000 }),
    vendor({ id: 'c', status: 'considering' }),
    vendor({ id: 'd', status: 'deposit_paid', totalCostPhp: 30_000 }),
  ];
  assert.deepEqual(
    vendorsToItemize({ vendors: rows, isConfirmed }).map((s) => s.vendor.vendor_id),
    ['b', 'd'],
    'snapshot order (created_at asc) must survive the filter',
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
