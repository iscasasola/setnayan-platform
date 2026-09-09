/**
 * agreed-total-and-its-changes.test.ts — THE GUARD IS THE DELIVERABLE.
 *
 * Owner, 2026-09-09, asked whether a price change after a lock should REPLACE
 * the agreed total or sit BESIDE it: **"Both, shown separately."** He was told
 * plainly that this is the most work, and that TWO NUMBERS TO KEEP IN STEP IS
 * EXACTLY HOW THE CURRENT DEFECT HAPPENED — and chose it anyway.
 *
 * ⇒ So this file is not decoration around a feature. It is the other half of
 *   the ruling: the two numbers are pinned AGAINST EACH OTHER, not merely both
 *   computed.
 *
 * What it holds, in the order the money moves:
 *   1. `agreed` is the SUM OF THE PARTS THAT DRAW IT. Not a second total that
 *      happens to match — the same expression, so there is nothing to drift.
 *   2. A CHANGE never erases the agreed price. ₱100,000 with a −₱15,000 change
 *      is ₱85,000 — and the −₱15,000 is still on screen as its own line.
 *   3. A BREAKDOWN still replaces it. This is not symmetric and must not be
 *      "tidied" into symmetry: all 12 suppliers carrying line items in
 *      production sum to their headline EXACTLY, so riding those on top doubles
 *      every one of them.
 *   4. A change rides in EVERY branch — headline, breakdown, catalogue, package,
 *      listing — because a delta that only lands for some suppliers is the worst
 *      shape a money bug can have.
 *   5. The THREE readers agree on one fixture. `lib/budget-truth.ts` (centavos)
 *      and `lib/budget.ts` (pesos, twice) each used to carry a hand-copied
 *      cascade; two of the three had never inherited R12. They now share one
 *      function, and this file fails if a fourth cascade appears.
 *   6. Only the SECURITY DEFINER RPC may author a change delta, and the couple's
 *      surface shows it separately with no delete control.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveAgreedTotal,
  splitVendorLines,
  sumAmountPhp,
} from '@/lib/agreed-total-and-its-changes';
import {
  computeEventMoney,
  type LineItemMoneyRow,
  type MoneyInputs,
  type VendorMoneyRow,
} from '@/lib/budget-truth';
import type { VendorPricingLookup } from '@/lib/budget';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(
  HERE,
  '../../../supabase/migrations/20271218458148_a_change_rides_on_the_agreed_total.sql',
);
const BUDGET_TS = join(HERE, 'budget.ts');
const BUDGET_TRUTH_TS = join(HERE, 'budget-truth.ts');
const ITEMIZATION_CARD = join(
  HERE,
  '../app/dashboard/[eventId]/_components/vendor-itemization-card.tsx',
);

const NOW = new Date('2026-06-01T00:00:00Z');

const inputs = (over: Partial<MoneyInputs> = {}): MoneyInputs => ({
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
  vendor_name: 'Kasal Studios',
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

const line = (
  id: string,
  amountPhp: number,
  isChange: boolean | null | undefined,
): LineItemMoneyRow => ({
  line_item_id: id,
  vendor_id: 'a',
  label: isChange ? 'Change order: extra hour' : 'Deposit',
  amount_php: amountPhp,
  due_date: null,
  ...(isChange === undefined ? {} : { is_change_delta: isChange }),
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE PIN ITSELF
// ───────────────────────────────────────────────────────────────────────────

test('agreed IS the sum of the parts that draw it — across every branch', () => {
  // A matrix, not one happy case: a surface prints `agreed` while the rows
  // under it print the parts, so the only defensible guarantee is that they are
  // the same arithmetic in every combination, including the signs.
  const money = [0, 100_000, -15_000];
  let checked = 0;
  for (const headline of money) {
    for (const catalogue of [0, 60_000]) {
      for (const breakdown of money) {
        for (const changes of money) {
          for (const isPackageAnchor of [false, true]) {
            for (const listingEstimate of [false, true]) {
              const r = resolveAgreedTotal({
                headline,
                catalogue,
                breakdown,
                changes,
                isPackageAnchor,
                packageLocked: 250_000,
                listingEstimate,
              });
              assert.equal(
                r.agreed,
                r.pricePart + r.breakdownPart + r.changesPart,
                `agreed drifted from its parts at ${JSON.stringify({
                  headline,
                  catalogue,
                  breakdown,
                  changes,
                  isPackageAnchor,
                  listingEstimate,
                })}`,
              );
              assert.equal(r.basePart, r.pricePart + r.breakdownPart, 'basePart drifted');
              // 4 · THE CHANGE RIDES IN EVERY BRANCH. Never gated, never
              // dropped — not on a package, not on a listing estimate, not on a
              // catalogue-priced supplier.
              assert.equal(
                r.changesPart,
                changes,
                'a settled change was dropped by a branch — a delta that lands ' +
                  'for only some suppliers is the worst shape a money bug has',
              );
              checked += 1;
            }
          }
        }
      }
    }
  }
  assert.ok(checked >= 200, `the matrix collapsed to ${checked} cases — it proves nothing`);
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE RULING, IN MONEY
// ───────────────────────────────────────────────────────────────────────────

test('a CHANGE adjusts the agreed price — it does not erase it', () => {
  const before = computeEventMoney(
    inputs({ vendors: [vendor({ vendor_id: 'a', total_cost_php: 100_000 })] }),
  );
  assert.equal(before.committed, 100_000);

  const after = computeEventMoney(
    inputs({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100_000 })],
      lineItems: [line('chg-1', -15_000, true)],
    }),
  );

  // ⚠ THE NUMBER THE OWNER ASKED FOR. Before the ruling this was −15,000: the
  // ₱100,000 was deleted and the couple was billed the delta alone.
  assert.equal(
    after.committed,
    85_000,
    'A settled change must ADJUST the agreed total, not replace it (owner ' +
      '2026-09-09, "Both, shown separately").',
  );

  // …AND SHOWN SEPARATELY. The second half of the ruling: the change is still a
  // line of its own, traceable to its row, under its own source.
  const changeLines = after.lines.filter((l) => l.source === 'vendor_change_delta');
  assert.equal(changeLines.length, 1, 'the change vanished from the ledger');
  assert.equal(changeLines[0]!.amountPhp, -15_000);
  assert.equal(changeLines[0]!.sourceRef, 'chg-1');
  assert.ok(
    after.sources.some((s) => s.source === 'vendor_change_delta'),
    'the change has no source note, so no surface can name where it came from',
  );

  // And the two halves are the same arithmetic, not two computations that agree.
  const priceLines = after.lines.filter((l) => l.vendorId === 'a');
  assert.equal(
    priceLines.reduce((acc, l) => acc + l.amountPhp, 0),
    after.committed,
    'the lines on screen do not add up to the total on screen',
  );
});

test('a BREAKDOWN still replaces the headline — production forbids the symmetric fix', () => {
  // Hain Catering: ₱225,000 headline, 2 lines summing to ₱225,000. Riding those
  // on top reports ₱450,000. This asymmetry is deliberate; do not "tidy" it.
  const m = computeEventMoney(
    inputs({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 225_000 })],
      lineItems: [line('b1', 125_000, false), line('b2', 100_000, undefined)],
    }),
  );
  assert.equal(
    m.committed,
    225_000,
    'Breakdown lines began riding ON TOP of the headline. Every supplier in ' +
      'production that carries line items sums to their headline exactly — this ' +
      'change doubles all 12 of them.',
  );
});

test('an unflagged row means BREAKDOWN — the safe direction for every row that already exists', () => {
  const { breakdown, changes } = splitVendorLines([
    { is_change_delta: undefined },
    { is_change_delta: null },
    { is_change_delta: false },
    { is_change_delta: true },
  ]);
  assert.equal(breakdown.length, 3, 'absent/null must keep today’s meaning');
  assert.equal(changes.length, 1);
});

test('both meanings on one supplier: the breakdown prices them, the change adjusts it', () => {
  const m = computeEventMoney(
    inputs({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 999_999 })],
      lineItems: [
        line('b1', 60_000, false),
        line('b2', 40_000, false),
        line('c1', 12_500, true),
      ],
    }),
  );
  // Headline superseded by the breakdown (100,000), change rides on top.
  assert.equal(m.committed, 112_500);
  assert.equal(m.lines.filter((l) => l.source === 'vendor_line_item').length, 2);
  assert.equal(m.lines.filter((l) => l.source === 'vendor_change_delta').length, 1);
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · THE THREE READERS CANNOT DRIFT
// ───────────────────────────────────────────────────────────────────────────

test('budget-truth (centavos) and the shared rule (pesos) report the same agreed total', () => {
  const cases = [
    { headline: 100_000, lines: [line('c', -15_000, true)] },
    { headline: 100_000, lines: [line('b', 40_000, false), line('c', 5_000, true)] },
    { headline: 0, lines: [line('b', 40_000, false)] },
    { headline: 80_000, lines: [] as LineItemMoneyRow[] },
    { headline: 80_000, lines: [line('c1', -90_000, true)] }, // net-negative: R12
  ];
  for (const c of cases) {
    const viaTruth = computeEventMoney(
      inputs({
        vendors: [vendor({ vendor_id: 'a', total_cost_php: c.headline })],
        lineItems: c.lines,
      }),
    ).committed;
    const split = splitVendorLines(c.lines);
    const viaRule = resolveAgreedTotal({
      headline: c.headline,
      catalogue: 0,
      breakdown: sumAmountPhp(split.breakdown),
      changes: sumAmountPhp(split.changes),
    }).agreed;
    assert.equal(
      viaTruth,
      viaRule,
      `the money resolver and the shared rule disagree at ${JSON.stringify(c)} — ` +
        'they are supposed to BE the same rule',
    );
  }
});

test('no reader keeps a fourth copy of the cascade', () => {
  // ANCHOR FIRST: if the shared rule were renamed, "nobody hand-rolls it" would
  // pass vacuously on files that no longer call anything.
  for (const [name, path] of [
    ['budget.ts', BUDGET_TS],
    ['budget-truth.ts', BUDGET_TRUTH_TS],
  ] as const) {
    const src = stripComments(readFileSync(path, 'utf8'));
    assert.ok(
      (src.match(/resolveAgreedTotal\s*\(/g) ?? []).length >= 1,
      `${name} no longer calls resolveAgreedTotal — it grew its own cascade back.`,
    );
    assert.ok(
      (src.match(/splitVendorLines\s*\(/g) ?? []).length >= 1,
      `${name} no longer splits change lines from breakdown lines.`,
    );
    // The shape of the old hand-rolled cascade. Its distinguishing feature was
    // a `> 0` test on a summed manual total — the exact form that discarded a
    // net credit (R12) and that `lib/budget.ts` never inherited the fix for.
    assert.equal(
      (src.match(/manualItemized\s*>\s*0/g) ?? []).length,
      0,
      `${name} has a hand-rolled itemised cascade again. There is one rule, in ` +
        'lib/agreed-total-and-its-changes.ts. Three copies is how these drifted.',
    );
  }
  // budget.ts had TWO copies; both must be routed.
  const budgetSrc = stripComments(readFileSync(BUDGET_TS, 'utf8'));
  assert.equal(
    (budgetSrc.match(/resolveAgreedTotal\s*\(/g) ?? []).length,
    2,
    'budget.ts has two vendor-total readers (fetchVendorBudgetSummary and ' +
      'fetchBudgetSnapshot). Both must go through the shared rule — fixing one ' +
      'of a pair is how this defect survived its first repair.',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · WHO MAY AUTHOR A CHANGE, AND HOW IT IS SHOWN
// ───────────────────────────────────────────────────────────────────────────

test('only accept_change_order stamps is_change_delta', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.ok(
    /CREATE OR REPLACE FUNCTION public\.accept_change_order/.test(sql),
    'the migration no longer re-signs accept_change_order',
  );
  assert.ok(
    /is_change_delta\)\s*\n\s*VALUES[\s\S]*?TRUE\)/.test(sql),
    'accept_change_order stopped stamping is_change_delta = TRUE. Without it a ' +
      'settled delta reads as an itemisation and DELETES the price it adjusts.',
  );

  // No application code may set it. The fact is authored by the SECURITY
  // DEFINER function that is the only legitimate author of a settled delta;
  // an insert path that set it from the browser would let a hand-typed line
  // ride on top of a price the supplier never agreed to move.
  const appWriters = [
    join(HERE, '../app/dashboard/[eventId]/budget/actions.ts'),
    join(HERE, '../app/dashboard/[eventId]/budget/cost-actions.ts'),
  ];
  for (const f of appWriters) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.equal(
      (src.match(/is_change_delta/g) ?? []).length,
      0,
      `${f} writes is_change_delta. Only accept_change_order may.`,
    );
  }
});

test('the couple’s card shows a change separately, and cannot delete it', () => {
  const src = stripComments(readFileSync(ITEMIZATION_CARD, 'utf8'));
  assert.ok(
    src.includes('Changes you both agreed'),
    'the change section lost its heading — a settled delta is back among the ' +
      'couple’s own additions with nothing saying the supplier agreed to it',
  );
  assert.ok(
    (src.match(/changeLines\.map/g) ?? []).length === 1,
    'the change lines are no longer rendered as their own list',
  );
  assert.ok(
    (src.match(/manualLines\.map/g) ?? []).length === 1,
    'the couple’s own additions list stopped iterating the BREAKDOWN lines — ' +
      'it is showing change deltas again, with a delete control on them',
  );
  // The delete control belongs to the couple's own lines only. Exactly one
  // deleteLineItem form may exist in this file.
  assert.equal(
    (src.match(/action=\{deleteLineItem\}/g) ?? []).length,
    1,
    'a second delete control appeared. If it is on the change list, one side ' +
      'can now erase something both sides agreed — and the change-order trail ' +
      'keeps saying "accepted", which is the drift this whole build removes.',
  );
});
