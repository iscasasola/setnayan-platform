/**
 * budget-ledger.test.ts — the arithmetic of BA3's per-category ledger.
 *
 * The guard that fences the RENDER lives beside the page
 * (`app/dashboard/[eventId]/budget/the-plan-meets-the-ledger.test.ts`); this
 * file drives the pure core.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBudgetLedger,
  daysUntilDueLabel,
  BUDGET_LEDGER_COLUMNS,
  type BudgetLedgerRow,
} from './budget-ledger';
import type { EventMoney, MoneyBucket, MoneyDue, MoneyLine } from './budget-truth';

const NO_DUE: MoneyDue = {
  overduePhp: 0,
  overdueCount: 0,
  dueSoonPhp: 0,
  dueSoonCount: 0,
  upcomingPhp: 0,
  upcomingCount: 0,
  laterPhp: 0,
  laterCount: 0,
};

function bucket(p: Partial<MoneyBucket> & { bucketId: string }): MoneyBucket {
  return {
    label: p.bucketId,
    committedPhp: 0,
    paidPhp: 0,
    stillOwedPhp: 0,
    overpaidPhp: 0,
    estimatedPhp: 0,
    hasBenchmark: false,
    benchmarkPhp: null,
    due: NO_DUE,
    ...p,
  };
}

/** `due` became REQUIRED on EventMoney in PR #5105 — carried, not omitted. */
function money(byBucket: MoneyBucket[], lines: MoneyLine[] = []): EventMoney {
  return {
    targetPhp: 930_000,
    estimated: 0,
    committed: byBucket.reduce((s, b) => s + b.committedPhp, 0),
    paid: byBucket.reduce((s, b) => s + b.paidPhp, 0),
    stillOwed: byBucket.reduce((s, b) => s + b.stillOwedPhp, 0),
    overpaid: 0,
    isOverBudget: false,
    overBudgetByPhp: 0,
    due: NO_DUE,
    byBucket,
    lines,
    sources: [],
    warnings: [],
  };
}

function line(p: Partial<MoneyLine> & { bucket: string }): MoneyLine {
  return {
    costKey: p.costKey ?? `${p.bucket}:${p.label ?? 'line'}`,
    label: 'Deposit',
    amountPhp: 0,
    kind: 'committed',
    paidPhp: 0,
    stillOwedPhp: 0,
    source: 'vendor_line_item',
    sourceRef: 'x',
    vendorId: null,
    vendorName: null,
    readOnly: false,
    dueDate: null,
    daysUntilDue: null,
    dueState: 'none',
    ...p,
  };
}

const rowFor = (rows: BudgetLedgerRow[], id: string) => rows.find((r) => r.bucketId === id)!;

// ── The four names ──────────────────────────────────────────────────────────

test('the four columns are Planned · Agreed · Paid · Owed, in that order', () => {
  assert.deepEqual([...BUDGET_LEDGER_COLUMNS], ['Planned', 'Agreed', 'Paid', 'Owed']);
});

// ── The sentence the whole slice exists to say ──────────────────────────────

test('planned ₱450,000 for catering, signed ₱480,000 — the row says so', () => {
  const { rows, absorption } = buildBudgetLedger({
    money: money([
      bucket({ bucketId: 'catering', label: 'Catering', committedPhp: 480_000, stillOwedPhp: 480_000 }),
      bucket({ bucketId: 'florals_decor', label: 'Florals & Decor' }),
    ]),
    suggestedPhp: new Map([
      ['catering', 450_000],
      ['florals_decor', 70_000],
    ]),
  });

  const catering = rowFor(rows, 'catering');
  assert.equal(catering.plannedPhp, 450_000);
  assert.equal(catering.agreedPhp, 480_000);
  assert.equal(catering.overByPhp, 30_000);
  assert.equal(catering.headroomPhp, 0);

  // …and the absorption plan NAMES the category with the room to cover it.
  assert.ok(absorption);
  assert.equal(absorption.totalOverspendPhp, 30_000);
  assert.deepEqual(
    absorption.transfers.map((t) => [t.fromLabel, t.amountPhp]),
    [['Florals & Decor', 30_000]],
  );
  assert.equal(absorption.fullyAbsorbable, true);
});

// ── §18.5 rule 5 · unknown is unknown, never ₱0 ─────────────────────────────

test('a category with money and no seeded benchmark plans NULL, never ₱0', () => {
  // Prod event 947e7bab… has exactly this: ₱30,000 agreed on Cake, whose
  // `benchmark_php` is NULL. `cake` is absent from the suggestion map because
  // `resolveAllocationInputs` filters out leaves nothing can price.
  const { rows, unplannedWithMoney } = buildBudgetLedger({
    money: money([
      bucket({ bucketId: 'cake', label: 'Cake', committedPhp: 30_000, stillOwedPhp: 30_000 }),
    ]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });

  const cake = rowFor(rows, 'cake');
  assert.equal(cake.plannedPhp, null, 'a planned ₱0 is the lie §18.5 rule 5 forbids');
  assert.equal(cake.plannedSource, null);
  assert.equal(cake.unplanned, true);
  assert.equal(cake.agreedPhp, 30_000);
  assert.deepEqual(unplannedWithMoney.map((r) => r.bucketId), ['cake']);
});

test('a ₱0 in the plan is folded to NULL — zero is never a plan', () => {
  for (const zero of [0, -0]) {
    const { rows } = buildBudgetLedger({
      money: money([bucket({ bucketId: 'cake', committedPhp: 30_000 })]),
      savedPlanPhp: new Map([['cake', zero]]),
      suggestedPhp: new Map([['cake', zero]]),
    });
    assert.equal(rowFor(rows, 'cake').plannedPhp, null);
    assert.equal(rowFor(rows, 'cake').unplanned, true);
  }
});

test('an unplanned category neither overspends nor lends headroom', () => {
  const { rows, absorption } = buildBudgetLedger({
    money: money([
      bucket({ bucketId: 'cake', label: 'Cake', committedPhp: 30_000 }),
      bucket({ bucketId: 'catering', label: 'Catering', committedPhp: 480_000 }),
    ]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  assert.equal(rowFor(rows, 'cake').overByPhp, 0);
  assert.equal(rowFor(rows, 'cake').headroomPhp, 0);
  assert.ok(absorption);
  // Only catering is comparable, so ₱30,000 is over with nothing to cover it.
  assert.equal(absorption.totalOverspendPhp, 30_000);
  assert.equal(absorption.totalHeadroomPhp, 0);
  assert.equal(absorption.netOverPhp, 30_000);
});

// ── Every peso keeps a row ──────────────────────────────────────────────────

test('every bucket carrying money gets a row, benchmark or not', () => {
  const buckets = [
    bucket({ bucketId: 'cake', committedPhp: 30_000 }),
    bucket({ bucketId: 'cocktail_booths', committedPhp: 45_000 }),
    bucket({ bucketId: 'photobooth', committedPhp: 22_000 }),
    bucket({ bucketId: 'other', committedPhp: 1 }),
    bucket({ bucketId: 'setnayan_services', committedPhp: 2_499 }),
  ];
  const { rows, totals } = buildBudgetLedger({ money: money(buckets), suggestedPhp: new Map() });
  assert.deepEqual(
    rows.map((r) => r.bucketId).sort(),
    buckets.map((b) => b.bucketId).sort(),
  );
  assert.equal(totals.agreedPhp, 99_500);
  assert.equal(totals.plannedPhp, null, 'no row has a plan, so there is no planned total');
});

test('a category budgeted but not yet booked still gets a row', () => {
  const { rows } = buildBudgetLedger({
    money: money([]),
    suggestedPhp: new Map([['rings', 40_000]]),
    labelFor: (id) => (id === 'rings' ? 'Rings' : id),
  });
  const rings = rowFor(rows, 'rings');
  assert.equal(rings.label, 'Rings');
  assert.equal(rings.plannedPhp, 40_000);
  assert.equal(rings.agreedPhp, 0);
  assert.equal(rings.nothingAgreedYet, true);
});

// ── Whose number is it ──────────────────────────────────────────────────────

test('a saved plan beats the suggestion, and the row says which', () => {
  const { rows } = buildBudgetLedger({
    money: money([bucket({ bucketId: 'catering', committedPhp: 480_000 })]),
    savedPlanPhp: new Map([['catering', 300_000]]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  const c = rowFor(rows, 'catering');
  assert.equal(c.plannedPhp, 300_000, "the couple's own figure, not ours");
  assert.equal(c.plannedSource, 'saved');
  assert.equal(c.overByPhp, 180_000);
});

test('with no saved plan the suggestion is used and NAMED as a suggestion', () => {
  const { rows } = buildBudgetLedger({
    money: money([bucket({ bucketId: 'catering', committedPhp: 480_000 })]),
    savedPlanPhp: new Map(),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  assert.equal(rowFor(rows, 'catering').plannedSource, 'suggested');
});

test('a saved NULL falls through to the suggestion rather than planning ₱0', () => {
  const { rows } = buildBudgetLedger({
    money: money([bucket({ bucketId: 'catering', committedPhp: 480_000 })]),
    savedPlanPhp: new Map([['catering', null]]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  assert.equal(rowFor(rows, 'catering').plannedPhp, 450_000);
  assert.equal(rowFor(rows, 'catering').plannedSource, 'suggested');
});

// ── Banked vs merely unspent ────────────────────────────────────────────────

test('headroom from a category nobody has booked is named as unbanked', () => {
  const { absorption } = buildBudgetLedger({
    money: money([
      // Booked and over.
      bucket({ bucketId: 'photography', label: 'Photography & Video', committedPhp: 175_000 }),
      // Booked and genuinely under — banked savings.
      bucket({ bucketId: 'host_mc', label: 'Host / MC', committedPhp: 20_000 }),
      // Nothing booked at all — its whole plan reads as headroom, and must not.
      bucket({ bucketId: 'catering', label: 'Catering', committedPhp: 0 }),
    ]),
    suggestedPhp: new Map([
      ['photography', 90_000],
      ['host_mc', 25_000],
      ['catering', 450_000],
    ]),
  });
  assert.ok(absorption);
  assert.equal(absorption.totalOverspendPhp, 85_000);
  // Greedy draws from the deepest headroom first — catering, which is unbooked.
  assert.deepEqual(absorption.unbankedSourceKeys, ['catering']);
  assert.equal(absorption.unbankedCoverPhp, 85_000);
});

test('an over-plan category is never counted as an unbanked source', () => {
  const { absorption } = buildBudgetLedger({
    money: money([
      bucket({ bucketId: 'photography', label: 'Photography', committedPhp: 175_000 }),
      bucket({ bucketId: 'host_mc', label: 'Host / MC', committedPhp: 20_000 }),
    ]),
    suggestedPhp: new Map([
      ['photography', 90_000],
      ['host_mc', 25_000],
    ]),
  });
  assert.ok(absorption);
  assert.deepEqual(absorption.unbankedSourceKeys, [], 'both are booked');
  assert.equal(absorption.unbankedCoverPhp, 0);
});

// ── The ledger's own columns come from the resolver, unaltered ──────────────

test('Paid and Owed are the resolver’s, and Owed is stillOwed — not agreed−paid', () => {
  // R11: the resolver floors per vendor, so an overpayment on one line cannot
  // silently cancel money still owed on another. The row must not re-derive it.
  const { rows } = buildBudgetLedger({
    money: money([
      bucket({
        bucketId: 'photography',
        committedPhp: 100_000,
        paidPhp: 120_000,
        stillOwedPhp: 40_000,
        overpaidPhp: 60_000,
      }),
    ]),
    suggestedPhp: new Map([['photography', 90_000]]),
  });
  const r = rowFor(rows, 'photography');
  assert.equal(r.paidPhp, 120_000);
  assert.equal(r.owedPhp, 40_000, 'stillOwed, verbatim — not committed − paid (which is −20,000)');
  assert.equal(r.overpaidPhp, 60_000);
});

test('an overdue milestone reaches the row (BA5’s `due` band)', () => {
  const { rows, totals } = buildBudgetLedger({
    money: money([
      bucket({
        bucketId: 'catering',
        committedPhp: 480_000,
        stillOwedPhp: 240_000,
        due: { ...NO_DUE, overduePhp: 100_000, overdueCount: 2 },
      }),
    ]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  assert.equal(rowFor(rows, 'catering').overduePhp, 100_000);
  assert.equal(rowFor(rows, 'catering').overdueCount, 2);
  assert.equal(totals.overduePhp, 100_000);
});

// ── Determinism ─────────────────────────────────────────────────────────────

test('row order is deterministic — largest agreed first, ties by label', () => {
  const build = () =>
    buildBudgetLedger({
      money: money([
        bucket({ bucketId: 'b', label: 'Beta', committedPhp: 10_000 }),
        bucket({ bucketId: 'a', label: 'Alpha', committedPhp: 10_000 }),
        bucket({ bucketId: 'c', label: 'Gamma', committedPhp: 50_000 }),
      ]),
      suggestedPhp: new Map(),
    }).rows.map((r) => r.bucketId);
  assert.deepEqual(build(), ['c', 'a', 'b']);
  assert.deepEqual(build(), build());
});

// ── BA6 · what is due, and when ─────────────────────────────────────────────

test('"5 days overdue" / "due today" / "due in 6 days" — spelled out, not a bare date', () => {
  assert.equal(daysUntilDueLabel(-5), '5 days overdue');
  assert.equal(daysUntilDueLabel(-1), '1 day overdue');
  assert.equal(daysUntilDueLabel(0), 'due today');
  assert.equal(daysUntilDueLabel(1), 'due in 1 day');
  assert.equal(daysUntilDueLabel(6), 'due in 6 days');
});

test("a row's chip is its most urgent unpaid milestone — soonest wins", () => {
  const { rows } = buildBudgetLedger({
    money: money(
      [bucket({ bucketId: 'catering', committedPhp: 480_000, stillOwedPhp: 240_000 })],
      [
        line({
          bucket: 'catering',
          label: 'Final balance',
          vendorName: 'Cook & Co.',
          stillOwedPhp: 200_000,
          daysUntilDue: 12,
          dueState: 'upcoming',
        }),
        line({
          bucket: 'catering',
          label: 'Deposit top-up',
          vendorName: 'Cook & Co.',
          stillOwedPhp: 40_000,
          daysUntilDue: -3,
          dueState: 'overdue',
        }),
      ],
    ),
    suggestedPhp: new Map([['catering', 450_000]]),
  });

  const nextDue = rowFor(rows, 'catering').nextDue;
  assert.ok(nextDue);
  assert.equal(nextDue.label, 'Deposit top-up');
  assert.equal(nextDue.vendorName, 'Cook & Co.');
  assert.equal(nextDue.amountPhp, 40_000);
  assert.equal(nextDue.daysUntilDue, -3);
  assert.equal(nextDue.state, 'overdue');
});

test('a settled or undated line never becomes the chip — nothing to chase', () => {
  const { rows } = buildBudgetLedger({
    money: money(
      [bucket({ bucketId: 'catering', committedPhp: 480_000 })],
      [
        line({ bucket: 'catering', dueState: 'settled', daysUntilDue: -3, stillOwedPhp: 0 }),
        line({ bucket: 'catering', dueState: 'none', daysUntilDue: null, stillOwedPhp: 0 }),
        line({ bucket: 'catering', dueState: 'later', daysUntilDue: 60, stillOwedPhp: 10_000 }),
      ],
    ),
    suggestedPhp: new Map(),
  });
  assert.equal(rowFor(rows, 'catering').nextDue, null, 'later is outside the 30-day chip horizon');
});

test('a line in another bucket never becomes this row’s chip', () => {
  const { rows } = buildBudgetLedger({
    money: money(
      [
        bucket({ bucketId: 'catering', committedPhp: 480_000 }),
        bucket({ bucketId: 'florals_decor', committedPhp: 70_000 }),
      ],
      [line({ bucket: 'florals_decor', daysUntilDue: 1, dueState: 'due_soon', stillOwedPhp: 5_000 })],
    ),
    suggestedPhp: new Map(),
  });
  assert.equal(rowFor(rows, 'catering').nextDue, null);
  assert.equal(rowFor(rows, 'florals_decor').nextDue?.daysUntilDue, 1);
});

test('due-soon and upcoming reach the row and roll up into the totals', () => {
  const { rows, totals } = buildBudgetLedger({
    money: money([
      bucket({
        bucketId: 'catering',
        committedPhp: 480_000,
        due: { ...NO_DUE, dueSoonPhp: 30_000, dueSoonCount: 1, upcomingPhp: 20_000, upcomingCount: 1 },
      }),
      bucket({
        bucketId: 'florals_decor',
        committedPhp: 70_000,
        due: { ...NO_DUE, overduePhp: 5_000, overdueCount: 1 },
      }),
    ]),
    suggestedPhp: new Map([['catering', 450_000]]),
  });
  const catering = rowFor(rows, 'catering');
  assert.equal(catering.dueSoonPhp, 30_000);
  assert.equal(catering.dueSoonCount, 1);
  assert.equal(catering.upcomingPhp, 20_000);
  assert.equal(catering.upcomingCount, 1);
  assert.equal(totals.dueSoonPhp, 30_000);
  assert.equal(totals.upcomingPhp, 20_000);
  assert.equal(totals.overduePhp, 5_000);
  assert.equal(totals.overdueCount, 1);
});
