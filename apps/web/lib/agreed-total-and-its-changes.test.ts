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
 *   6. Only the two SECURITY DEFINER functions may author a change delta, and the couple’s
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
import { legacyCommittedVendorsPhp } from '@/lib/budget-page-money';
import { stripComments } from '@/lib/strip-comments';
import { lockFreezeLine } from '@/lib/lock-freeze-copy';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(
  HERE,
  '../../../supabase/migrations/20271218458148_a_change_rides_on_the_agreed_total.sql',
);
const BUDGET_TS = join(HERE, 'budget.ts');
const BUDGET_TRUTH_TS = join(HERE, 'budget-truth.ts');
const BUDGET_PAGE = join(HERE, '../app/dashboard/[eventId]/budget/page.tsx');
const AMENDMENT_CARD = join(HERE, '../app/_components/chat-amendment-card.tsx');
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
              // COUNTED ⇔ DRAWN. `billBreakdown` is what tells a surface to
              // draw the breakdown rows; if the total counted them while the
              // surface did not draw them, the number on screen and the rows
              // under it would disagree — which is the entire defect, wearing
              // the other costume.
              assert.equal(
                r.breakdownPart,
                r.billBreakdown ? breakdown : 0,
                'the total counts breakdown lines the surface is told not to draw',
              );
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

  // Pinned at the BRANCH as well as at the total, because the total alone is
  // satisfied by two different wrong answers cancelling out.
  const r = resolveAgreedTotal({ headline: 225_000, catalogue: 0, breakdown: 225_000, changes: 0 });
  assert.equal(r.baseSource, 'breakdown');
  assert.equal(r.pricePart, 0, 'the headline is superseded by the breakdown, not added to it');
  assert.equal(r.billBreakdown, true);
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

test('the flag-OFF strip counts changes too — the two numbers on that screen match', () => {
  // THE SCREEN THE OWNER WILL ACTUALLY BE LOOKING AT. `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`
  // is read on the server only, so a session cannot know its value; with it OFF
  // the strip prints this legacy figure while each supplier's card prints
  // `itemizedTotal`. Before the ruling those two could not agree after a change
  // order, and the reassuring one was on top.
  const confirmed = (s: string) => s === 'contracted' || s === 'deposit_paid';
  const rows = [
    {
      vendor: { status: 'contracted', total_cost_php: 100_000 },
      lineItems: [
        { amount_php: -15_000, is_change_delta: true },
        { amount_php: 60_000, is_change_delta: false },
      ],
    },
    {
      // Not confirmed → contributes nothing, change or no change (BA2).
      vendor: { status: 'considering', total_cost_php: 80_000 },
      lineItems: [{ amount_php: 9_000, is_change_delta: true }],
    },
  ];
  assert.equal(
    legacyCommittedVendorsPhp(rows, confirmed),
    85_000,
    'The strip is back to summing headlines alone: a change the couple and the ' +
      'supplier agreed is missing from Committed while the supplier’s own card ' +
      'shows it. Two numbers, one screen, disagreeing.',
  );

  // And the BREAKDOWN line above must NOT be added — it itemises the ₱100,000,
  // it does not extend it. 100,000 + 60,000 = 160,000 is the doubling bug.
  assert.notEqual(legacyCommittedVendorsPhp(rows, confirmed), 145_000);
  assert.notEqual(legacyCommittedVendorsPhp(rows, confirmed), 160_000);
});

test('the budget page does not keep its own copy of that sum', () => {
  const src = stripComments(readFileSync(BUDGET_PAGE, 'utf8'));
  assert.equal(
    (src.match(/legacyCommittedVendorsPhp\s*\(/g) ?? []).length,
    1,
    'budget/page.tsx no longer calls legacyCommittedVendorsPhp — the committed ' +
      'figure went back to being six untestable lines inside a page.',
  );
  assert.equal(
    (src.match(/total_cost_php/g) ?? []).length,
    0,
    'budget/page.tsx reads total_cost_php directly again. That is the hand-rolled ' +
      'committed figure returning, and it cannot see change lines.',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 6 · WHO MAY AUTHOR A CHANGE, AND HOW IT IS SHOWN
// ───────────────────────────────────────────────────────────────────────────

test('only the two server functions stamp is_change_delta', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  // Each author's OWN body must write TRUE — a single regex over the whole file
  // would be satisfied by one of them alone.
  const bodyOf = (fn: string): string => {
    const at = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
    assert.ok(at >= 0, `the migration no longer defines ${fn}`);
    const end = sql.indexOf('$function$;', at);
    assert.ok(end > at, `${fn} has no closing $function$ — re-anchor this guard`);
    return sql.slice(at, end);
  };
  for (const fn of ['accept_change_order', 'record_agreed_price_change']) {
    assert.ok(
      /is_change_delta\)\s*\n\s*VALUES[\s\S]*?TRUE\)/.test(bodyOf(fn)),
      `${fn} stopped stamping is_change_delta = TRUE. Without it a settled delta ` +
        'reads as an itemisation and DELETES the price it adjusts.',
    );
  }

  // No application code may set it. The fact is authored by the SECURITY
  // DEFINER functions that are the only legitimate authors of a settled delta
  // (and the database refuses a browser session that tries — see
  // tests/db/a-change-after-the-lock-keeps-both-numbers.db.test.ts); an insert
  // path that set it from the app would let a hand-typed line ride on top of a
  // price the supplier never agreed to move.
  const appWriters = [
    join(HERE, '../app/dashboard/[eventId]/budget/actions.ts'),
    join(HERE, '../app/dashboard/[eventId]/budget/cost-actions.ts'),
    join(HERE, 'chat-lock-booking.server.ts'),
    join(HERE, '../app/_components/negotiation-actions.ts'),
  ];
  for (const f of appWriters) {
    const src = stripComments(readFileSync(f, 'utf8'));
    assert.equal(
      (src.match(/is_change_delta/g) ?? []).length,
      0,
      `${f} writes is_change_delta. Only the server functions may.`,
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

// ───────────────────────────────────────────────────────────────────────────
// 7 · AND THE SENTENCE THAT WENT WITH IT
//
// ⚖ WHICH SENTENCE IS TRUE — decided 2026-09-11, and the test now agrees with
// the code rather than being silenced. This branch once wrote its own inline
// notice ("You locked this price" / "The couple locked this price"). #5393 then
// landed `lockFreezeLine`, which READS THE BOOKING'S OWN `lock_request_state`
// and can reach the booked sentence ("Deal locked — price frozen.") only from a
// real booking; every other state says, in the viewer's own words, that the
// price is frozen and nobody is booked yet. That is the TRUE one: it claims a
// booking exactly when one exists, where the inline sentence could only ever
// claim the press. So the card delegates to it, and this section pins that —
// including the case this build adds (a new Deal on an already-booked
// supplier: state 'locked', and "Deal locked" is then simply true).
// ───────────────────────────────────────────────────────────────────────────

test('the lock notice comes from lockFreezeLine, and only a real booking says "Deal locked"', () => {
  const src = stripComments(readFileSync(AMENDMENT_CARD, 'utf8'));

  // ANCHOR: if the lock block were removed or renamed, "no false claim" would
  // pass vacuously on a file that no longer renders anything.
  assert.ok(
    src.includes('data.lockedAt'),
    'the amendment card no longer renders a locked state — re-anchor this guard',
  );
  assert.equal(
    (src.match(/lockFreezeLine\s*\(/g) ?? []).length,
    1,
    'the card no longer asks lockFreezeLine for its sentence — the one module that ' +
      'knows whether a booking exists',
  );
  assert.ok(
    src.includes('{freezeLine.text}'),
    'the card computes the sentence but no longer renders it',
  );

  // 🔴 NO INLINE COPY OF THE MONEY CLAIM. Two sentences for one claim is how a
  // screen ends up saying "locked" beside a request that has not been answered.
  assert.equal(
    (src.match(/Deal locked/g) ?? []).length,
    0,
    'The card carries its own "Deal locked" again. Only lockFreezeLine may say it, ' +
      'and only from a real booking.',
  );
  assert.equal((src.match(/price frozen/gi) ?? []).length, 0, 'an inline frozen sentence is back');

  // BEHAVIOUR, not source: every state that is NOT a booking, for both voices,
  // with and without a saved price, must not claim one.
  const notBooked = ['requested', 'declined', 'expired', 'cancelled', 'none', null, undefined] as const;
  for (const state of notBooked) {
    for (const viewerRole of ['couple', 'vendor'] as const) {
      for (const priceFrozen of [true, false]) {
        const line = lockFreezeLine({ state, viewerRole, priceFrozen });
        assert.ok(
          !line.text.includes('Deal locked'),
          `"Deal locked" was claimed with no booking (state=${String(state)}, ${viewerRole})`,
        );
      }
    }
  }
  // …and the one state that IS a booking says so — the post-lock Deal case.
  assert.equal(
    lockFreezeLine({ state: 'locked', viewerRole: 'couple', priceFrozen: true }).tone,
    'booked',
  );

  // ROLE. The supplier must not read an announcement about an act they did not
  // perform: an ASK reads differently to each side.
  const toCouple = lockFreezeLine({ state: 'requested', viewerRole: 'couple', priceFrozen: true });
  const toSupplier = lockFreezeLine({ state: 'requested', viewerRole: 'vendor', priceFrozen: true });
  assert.notEqual(toCouple.text, toSupplier.text, 'both people read the same sentence again');
});
