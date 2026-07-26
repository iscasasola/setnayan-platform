/**
 * PACKAGE CREDIT ENGINE — unit suite (owner-locked model, 2026-07-26).
 *
 * This is money code, so the suite is written adversarially rather than
 * happy-path-first. It walks:
 *
 *   • the FOUR line states — required×fixed, required×choice, optional×fixed,
 *     optional×choice — because REQUIRED and CHOICE are separate axes and
 *     every combination behaves differently;
 *   • 🚨 THE INVARIANT: a required line's value must NEVER reach the
 *     available-credit pool, asserted both directly and by exhaustion (the
 *     pool can never exceed the sum of the OPTIONAL lines);
 *   • the three credit thresholds — surplus / exactly zero / overspent;
 *   • both unspent-credit policies — expiring and refundable;
 *   • the fail-closed cases — unknown ids, duplicate selections, removing a
 *     required line, un-picked required choices, negative / absurd money.
 *
 * Pure module, no mocks, no env, no clock: `pnpm --filter @setnayan/web test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePackageCredit,
  isChoiceLine,
  MAX_MONEY_CENTAVOS,
  MAX_ADDITION_QUANTITY,
  type CreditItem,
  type CreditPackage,
  type PackageCreditErrorCode,
  type PackageCreditOk,
  type PackageCreditResult,
} from './package-credit';
import { computeCustomization, type VendorPackageWithItems } from './vendor-packages';

/* ──────────────────────────────────────────────────────────────────────── */
/* Fixtures — one package covering all four line states                     */
/* ──────────────────────────────────────────────────────────────────────── */

const REQ_FIXED = 'item-req-fixed'; // the venue: required, no alternatives
const REQ_CHOICE = 'item-req-choice'; // the main course: required, 1 of 3
const OPT_FIXED = 'item-opt-fixed'; // chocolate fountain: drop it for credit
const OPT_CHOICE = 'item-opt-choice'; // dessert: optional; pick one if taken

/** Values chosen so no two subsets can collide into the same sum. */
const V_REQ_FIXED = 500_000; // ₱5,000 — must NEVER be creditable
const V_REQ_CHOICE = 300_000; // ₱3,000 — must NEVER be creditable
const V_OPT_FIXED = 70_000; // ₱700
const V_OPT_CHOICE = 40_000; // ₱400

const MAIN_DEFAULT = 'opt-main-lechon'; // delta 0 — the price assumes this
const MAIN_PREMIUM = 'opt-main-wagyu'; // +₱250
const MAIN_RETIRED = 'opt-main-retired'; // no longer offered
const DESSERT_DEFAULT = 'opt-dessert-halo'; // delta 0
const DESSERT_PREMIUM = 'opt-dessert-gateau'; // +₱120

const DELTA_MAIN_PREMIUM = 25_000;
const DELTA_DESSERT_PREMIUM = 12_000;

const TOTAL_PRICE = 2_000_000; // ₱20,000
const CONSUMABLE = 30_000; // ₱300 stated credit

function items(): CreditItem[] {
  return [
    {
      item_id: REQ_FIXED,
      is_required: true,
      is_default_included: true,
      replacement_value_centavos: V_REQ_FIXED,
    },
    {
      item_id: REQ_CHOICE,
      is_required: true,
      is_default_included: true,
      replacement_value_centavos: V_REQ_CHOICE,
      options: [
        { option_id: MAIN_DEFAULT, price_delta_centavos: 0, is_default: true, is_available: true },
        {
          option_id: MAIN_PREMIUM,
          price_delta_centavos: DELTA_MAIN_PREMIUM,
          is_default: false,
          is_available: true,
        },
        {
          option_id: MAIN_RETIRED,
          price_delta_centavos: 9_900,
          is_default: false,
          is_available: false,
        },
      ],
    },
    {
      item_id: OPT_FIXED,
      is_required: false,
      is_default_included: true,
      replacement_value_centavos: V_OPT_FIXED,
    },
    {
      item_id: OPT_CHOICE,
      is_required: false,
      is_default_included: true,
      replacement_value_centavos: V_OPT_CHOICE,
      options: [
        { option_id: DESSERT_DEFAULT, price_delta_centavos: 0, is_default: true, is_available: true },
        {
          option_id: DESSERT_PREMIUM,
          price_delta_centavos: DELTA_DESSERT_PREMIUM,
          is_default: false,
          is_available: true,
        },
      ],
    },
  ];
}

function pkg(over: Partial<CreditPackage> = {}): CreditPackage {
  return {
    total_price_centavos: TOTAL_PRICE,
    consumable_budget_centavos: CONSUMABLE,
    is_consumable_flexible: true,
    unspent_credit_policy: 'expiring',
    items: items(),
    ...over,
  };
}

/** Unwrap an expected-OK result, failing loudly (with the errors) otherwise. */
function ok(result: PackageCreditResult): PackageCreditOk {
  assert.equal(result.ok, true, `expected ok, got ${JSON.stringify(result)}`);
  return result as PackageCreditOk;
}

/** Assert the result failed and carries `code`. */
function failsWith(result: PackageCreditResult, code: PackageCreditErrorCode) {
  assert.equal(result.ok, false, `expected failure ${code}, got ${JSON.stringify(result)}`);
  if (result.ok) return;
  const codes = result.errors.map((e) => e.code);
  assert.ok(codes.includes(code), `expected error ${code}, got ${JSON.stringify(codes)}`);
}

/** Baseline: nothing removed, the required choice explicitly picked. */
const BASELINE = { chosenOptionIds: [MAIN_DEFAULT] };

/* ──────────────────────────────────────────────────────────────────────── */
/* 🚨 THE INVARIANT — a required line's value never becomes credit           */
/* ──────────────────────────────────────────────────────────────────────── */

test('INVARIANT: required line values never enter the available-credit pool', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), ...BASELINE }));
  // Only the stated consumable budget is available: nothing was removed.
  assert.equal(r.availableCreditCentavos, CONSUMABLE);
  assert.notEqual(r.availableCreditCentavos, CONSUMABLE + V_REQ_FIXED);
  assert.notEqual(r.availableCreditCentavos, CONSUMABLE + V_REQ_CHOICE);
});

test('INVARIANT (by exhaustion): the pool can never exceed budget + the OPTIONAL lines', () => {
  // Every subset of removals the engine will accept — required lines are
  // refused outright, so the ceiling is budget + optional values.
  const ceiling = CONSUMABLE + V_OPT_FIXED + V_OPT_CHOICE;
  const subsets: string[][] = [
    [],
    [OPT_FIXED],
    [OPT_CHOICE],
    [OPT_FIXED, OPT_CHOICE],
  ];
  for (const removedItemIds of subsets) {
    const r = ok(computePackageCredit({ pkg: pkg(), removedItemIds, ...BASELINE }));
    assert.ok(
      r.availableCreditCentavos <= ceiling,
      `pool ${r.availableCreditCentavos} exceeded ceiling ${ceiling} for ${JSON.stringify(removedItemIds)}`,
    );
  }
  // And the maximum really is that ceiling — the bound is tight, not vacuous.
  const maxed = ok(
    computePackageCredit({ pkg: pkg(), removedItemIds: [OPT_FIXED, OPT_CHOICE], ...BASELINE }),
  );
  assert.equal(maxed.availableCreditCentavos, ceiling);
});

test('INVARIANT: removing a REQUIRED+FIXED line is refused', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), removedItemIds: [REQ_FIXED], ...BASELINE }),
    'required_item_removed',
  );
});

test('INVARIANT: removing a REQUIRED+CHOICE line is refused', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), removedItemIds: [REQ_CHOICE], ...BASELINE }),
    'required_item_removed',
  );
});

test('INVARIANT: a refused removal yields NO credit at all (no partial success)', () => {
  const r = computePackageCredit({
    pkg: pkg(),
    // One legal removal + one illegal one. The legal one must not sneak
    // through with a credit figure attached.
    removedItemIds: [OPT_FIXED, REQ_FIXED],
    ...BASELINE,
  });
  assert.equal(r.ok, false);
  assert.ok(!('availableCreditCentavos' in r));
});

/* ──────────────────────────────────────────────────────────────────────── */
/* The four line states                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

test('required+fixed: always kept, contributes no delta', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), ...BASELINE }));
  assert.ok(r.keptItemIds.includes(REQ_FIXED));
  assert.ok(!r.selections.some((s) => s.item_id === REQ_FIXED));
});

test('required+choice: exactly one option must be picked — none is an error', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [] }),
    'required_choice_unselected',
  );
});

test('required+choice: does NOT silently fall back to the default', () => {
  const r = computePackageCredit({ pkg: pkg(), chosenOptionIds: [] });
  assert.equal(r.ok, false); // a decision the couple owns is never made for them
});

test('required+choice: two options for the same line is an error', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_DEFAULT, MAIN_PREMIUM] }),
    'multiple_options_for_item',
  );
});

test('optional+fixed: removal returns exactly its value to the pool', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), removedItemIds: [OPT_FIXED], ...BASELINE }));
  assert.equal(r.removedTotalCentavos, V_OPT_FIXED);
  assert.equal(r.availableCreditCentavos, CONSUMABLE + V_OPT_FIXED);
  assert.ok(!r.keptItemIds.includes(OPT_FIXED));
});

test('optional+choice: kept with nothing picked falls back to its default (delta 0)', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), ...BASELINE }));
  const dessert = r.selections.find((s) => s.item_id === OPT_CHOICE);
  assert.ok(dessert, 'expected a resolved selection for the optional choice line');
  assert.equal(dessert.option_id, DESSERT_DEFAULT);
  assert.equal(dessert.source, 'default');
  assert.equal(dessert.price_delta_centavos, 0);
});

test('optional+choice: removed entirely returns its value and needs no selection', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), removedItemIds: [OPT_CHOICE], ...BASELINE }));
  assert.equal(r.availableCreditCentavos, CONSUMABLE + V_OPT_CHOICE);
  assert.ok(!r.selections.some((s) => s.item_id === OPT_CHOICE));
});

test('optional+choice kept with no available default → fail closed', () => {
  const broken = pkg();
  const dessert = broken.items.find((i) => i.item_id === OPT_CHOICE)!;
  const patched: CreditItem = {
    ...dessert,
    options: (dessert.options ?? []).map((o) =>
      o.is_default ? { ...o, is_available: false } : o,
    ),
  };
  failsWith(
    computePackageCredit({
      pkg: { ...broken, items: broken.items.map((i) => (i.item_id === OPT_CHOICE ? patched : i)) },
      ...BASELINE,
    }),
    'choice_line_has_no_default',
  );
});

test('isChoiceLine distinguishes the axes', () => {
  const [reqFixed, reqChoice, optFixed, optChoice] = items();
  assert.equal(isChoiceLine(reqFixed!), false);
  assert.equal(isChoiceLine(reqChoice!), true);
  assert.equal(isChoiceLine(optFixed!), false);
  assert.equal(isChoiceLine(optChoice!), true);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Option deltas                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

test('a premium pick spends its delta, not its full price', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_PREMIUM] }));
  assert.equal(r.spentCreditCentavos, DELTA_MAIN_PREMIUM);
  assert.equal(r.remainingCreditCentavos, CONSUMABLE - DELTA_MAIN_PREMIUM);
});

test('deltas from two choice lines both apply', () => {
  const r = ok(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_PREMIUM, DESSERT_PREMIUM] }),
  );
  assert.equal(r.spentCreditCentavos, DELTA_MAIN_PREMIUM + DELTA_DESSERT_PREMIUM);
});

test('a retired (unavailable) option cannot be chosen', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_RETIRED] }),
    'option_unavailable',
  );
});

test('an option chosen on a REMOVED line is an error', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      removedItemIds: [OPT_CHOICE],
      chosenOptionIds: [MAIN_DEFAULT, DESSERT_PREMIUM],
    }),
    'option_on_removed_item',
  );
});

test('an option id the vendor deleted no longer resolves — fail closed, not re-priced', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_DEFAULT, 'opt-deleted-by-vendor'] }),
    'unknown_option',
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* The three credit thresholds × both unspent policies                      */
/* ──────────────────────────────────────────────────────────────────────── */

test('SURPLUS · expiring: leftover is forfeited, price unchanged', () => {
  const r = ok(computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_PREMIUM] }));
  assert.equal(r.availableCreditCentavos, CONSUMABLE);
  assert.equal(r.spentCreditCentavos, DELTA_MAIN_PREMIUM);
  assert.equal(r.remainingCreditCentavos, CONSUMABLE - DELTA_MAIN_PREMIUM);
  assert.equal(r.overspendCentavos, 0);
  assert.equal(r.forfeitedCreditCentavos, CONSUMABLE - DELTA_MAIN_PREMIUM);
  assert.equal(r.creditRefundCentavos, 0);
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE);
});

test('SURPLUS · refundable: leftover comes off the price', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg({ unspent_credit_policy: 'refundable' }),
      chosenOptionIds: [MAIN_PREMIUM],
    }),
  );
  const leftover = CONSUMABLE - DELTA_MAIN_PREMIUM;
  assert.equal(r.creditRefundCentavos, leftover);
  assert.equal(r.forfeitedCreditCentavos, 0);
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE - leftover);
});

test('EXACTLY ZERO: spend meets credit — no leftover, no overspend, either policy', () => {
  // Budget tuned so the premium main exactly consumes the pool.
  const exact = pkg({ consumable_budget_centavos: DELTA_MAIN_PREMIUM });
  for (const policy of ['expiring', 'refundable'] as const) {
    const r = ok(
      computePackageCredit({
        pkg: { ...exact, unspent_credit_policy: policy },
        chosenOptionIds: [MAIN_PREMIUM],
      }),
    );
    assert.equal(r.remainingCreditCentavos, 0, policy);
    assert.equal(r.overspendCentavos, 0, policy);
    assert.equal(r.forfeitedCreditCentavos, 0, policy);
    assert.equal(r.creditRefundCentavos, 0, policy);
    // The policy is irrelevant at the boundary: both pay the sticker price.
    assert.equal(r.bookingTotalCentavos, TOTAL_PRICE, policy);
  }
});

test('OVERSPENT: the excess is added to the booking total (existing pay rail)', () => {
  const tiny = pkg({ consumable_budget_centavos: 5_000 });
  const r = ok(computePackageCredit({ pkg: tiny, chosenOptionIds: [MAIN_PREMIUM] }));
  const overspend = DELTA_MAIN_PREMIUM - 5_000;
  assert.equal(r.overspendCentavos, overspend);
  assert.equal(r.remainingCreditCentavos, 0);
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE + overspend);
});

test('OVERSPENT · refundable: nothing to refund, overspend still bills', () => {
  const tiny = pkg({ consumable_budget_centavos: 5_000, unspent_credit_policy: 'refundable' });
  const r = ok(computePackageCredit({ pkg: tiny, chosenOptionIds: [MAIN_PREMIUM] }));
  assert.equal(r.creditRefundCentavos, 0);
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE + (DELTA_MAIN_PREMIUM - 5_000));
});

test('removed credit funds a premium pick — the price never moves (expiring)', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg(),
      removedItemIds: [OPT_FIXED],
      chosenOptionIds: [MAIN_PREMIUM],
    }),
  );
  assert.equal(r.availableCreditCentavos, CONSUMABLE + V_OPT_FIXED);
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE); // "changes WHAT you get, not what you pay"
});

test('refundable + huge credit vs a tiny price clamps the total at zero', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg({
        unspent_credit_policy: 'refundable',
        total_price_centavos: 1_000,
        consumable_budget_centavos: 900_000,
      }),
      ...BASELINE,
    }),
  );
  assert.equal(r.bookingTotalCentavos, 0);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Catalogue additions — credit spends across the WHOLE catalogue            */
/* ──────────────────────────────────────────────────────────────────────── */

test('credit spends on catalogue items outside the package', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-extra-hour', unit_price_centavos: 8_000, quantity: 2 }],
    }),
  );
  assert.equal(r.spentCreditCentavos, 16_000);
  assert.equal(r.remainingCreditCentavos, CONSUMABLE - 16_000);
});

test('additions and option deltas draw on the same pool', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg(),
      chosenOptionIds: [MAIN_PREMIUM],
      additions: [{ addition_id: 'svc-extra-hour', unit_price_centavos: 8_000, quantity: 1 }],
    }),
  );
  assert.equal(r.spentCreditCentavos, DELTA_MAIN_PREMIUM + 8_000);
  assert.equal(r.overspendCentavos, DELTA_MAIN_PREMIUM + 8_000 - CONSUMABLE);
});

test('the same catalogue id twice is an error — use quantity', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [
        { addition_id: 'svc-x', unit_price_centavos: 1_000, quantity: 1 },
        { addition_id: 'svc-x', unit_price_centavos: 1_000, quantity: 1 },
      ],
    }),
    'duplicate_addition',
  );
});

test('addition quantity must be a positive integer within bounds', () => {
  for (const quantity of [0, -1, 1.5, Number.NaN, MAX_ADDITION_QUANTITY + 1]) {
    failsWith(
      computePackageCredit({
        pkg: pkg(),
        ...BASELINE,
        additions: [{ addition_id: 'svc-x', unit_price_centavos: 1_000, quantity }],
      }),
      'invalid_addition',
    );
  }
});

test('a negative addition price cannot mint credit', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-x', unit_price_centavos: -50_000, quantity: 1 }],
    }),
    'invalid_addition',
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Fail-closed: unknown ids, duplicates, malformed money                    */
/* ──────────────────────────────────────────────────────────────────────── */

test('an unknown removed item id is refused', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), removedItemIds: ['item-from-another-package'], ...BASELINE }),
    'unknown_item',
  );
});

test('the same item removed twice is refused', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), removedItemIds: [OPT_FIXED, OPT_FIXED], ...BASELINE }),
    'duplicate_removal',
  );
});

test('the same option chosen twice is refused', () => {
  failsWith(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_DEFAULT, MAIN_DEFAULT] }),
    'duplicate_option',
  );
});

test('removing a line that was not included frees nothing — refused', () => {
  const withExtra = pkg();
  const extras: CreditItem[] = [
    ...withExtra.items,
    {
      item_id: 'item-not-included',
      is_required: false,
      is_default_included: false,
      replacement_value_centavos: 999_000,
    },
  ];
  failsWith(
    computePackageCredit({
      pkg: { ...withExtra, items: extras },
      removedItemIds: ['item-not-included'],
      ...BASELINE,
    }),
    'remove_not_included',
  );
});

test('a line that is neither required nor included is not kept and carries no delta', () => {
  const withExtra = pkg();
  const extras: CreditItem[] = [
    ...withExtra.items,
    {
      item_id: 'item-not-included',
      is_required: false,
      is_default_included: false,
      replacement_value_centavos: 999_000,
    },
  ];
  const r = ok(computePackageCredit({ pkg: { ...withExtra, items: extras }, ...BASELINE }));
  assert.ok(!r.keptItemIds.includes('item-not-included'));
  assert.equal(r.availableCreditCentavos, CONSUMABLE);
});

test('a duplicated item row in the package is refused', () => {
  const dupes = pkg();
  failsWith(
    computePackageCredit({
      pkg: { ...dupes, items: [...dupes.items, dupes.items[2]!] },
      ...BASELINE,
    }),
    'duplicate_item',
  );
});

test('negative money anywhere is refused', () => {
  const bad = pkg();
  failsWith(
    computePackageCredit({
      pkg: {
        ...bad,
        items: bad.items.map((i) =>
          i.item_id === OPT_FIXED ? { ...i, replacement_value_centavos: -10_000 } : i,
        ),
      },
      ...BASELINE,
    }),
    'invalid_money',
  );
  failsWith(
    computePackageCredit({ pkg: pkg({ consumable_budget_centavos: -1 }), ...BASELINE }),
    'invalid_money',
  );
  failsWith(
    computePackageCredit({ pkg: pkg({ total_price_centavos: -1 }), ...BASELINE }),
    'invalid_money',
  );
});

test('absurd money is refused (above the sanity ceiling)', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg({ consumable_budget_centavos: MAX_MONEY_CENTAVOS + 1 }),
      ...BASELINE,
    }),
    'invalid_money',
  );
});

test('non-finite money is refused', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    failsWith(
      computePackageCredit({ pkg: pkg({ consumable_budget_centavos: value }), ...BASELINE }),
      'invalid_money',
    );
  }
});

test('a negative option delta is refused (it would let a required line mint credit)', () => {
  const bad = pkg();
  const main = bad.items.find((i) => i.item_id === REQ_CHOICE)!;
  failsWith(
    computePackageCredit({
      pkg: {
        ...bad,
        items: bad.items.map((i) =>
          i.item_id === REQ_CHOICE
            ? {
                ...main,
                options: (main.options ?? []).map((o) =>
                  o.option_id === MAIN_PREMIUM ? { ...o, price_delta_centavos: -50_000 } : o,
                ),
              }
            : i,
        ),
      },
      chosenOptionIds: [MAIN_PREMIUM],
    }),
    'invalid_money',
  );
});

test('a non-zero default option is refused (it would surcharge a couple who chose nothing)', () => {
  const bad = pkg();
  const dessert = bad.items.find((i) => i.item_id === OPT_CHOICE)!;
  failsWith(
    computePackageCredit({
      pkg: {
        ...bad,
        items: bad.items.map((i) =>
          i.item_id === OPT_CHOICE
            ? {
                ...dessert,
                options: (dessert.options ?? []).map((o) =>
                  o.is_default ? { ...o, price_delta_centavos: 7_700 } : o,
                ),
              }
            : i,
        ),
      },
      ...BASELINE,
    }),
    'invalid_package',
  );
});

test('two defaults on one choice line is refused', () => {
  const bad = pkg();
  const dessert = bad.items.find((i) => i.item_id === OPT_CHOICE)!;
  failsWith(
    computePackageCredit({
      pkg: {
        ...bad,
        items: bad.items.map((i) =>
          i.item_id === OPT_CHOICE
            ? {
                ...dessert,
                options: (dessert.options ?? []).map((o) => ({ ...o, is_default: true, price_delta_centavos: 0 })),
              }
            : i,
        ),
      },
      ...BASELINE,
    }),
    'multiple_default_options',
  );
});

test('an unknown unspent-credit policy is refused', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg({ unspent_credit_policy: 'whatever' as unknown as 'expiring' }),
      ...BASELINE,
    }),
    'invalid_package',
  );
});

test('a missing package is refused rather than treated as empty', () => {
  failsWith(
    computePackageCredit({ pkg: undefined as unknown as CreditPackage }),
    'invalid_package',
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Legacy (non-flexible) packages keep their existing shape                 */
/* ──────────────────────────────────────────────────────────────────────── */

test('non-flexible: removal cuts the PRICE and does not feed the pool', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg({ is_consumable_flexible: false }),
      removedItemIds: [OPT_FIXED],
      ...BASELINE,
    }),
  );
  assert.equal(r.availableCreditCentavos, CONSUMABLE); // pool unchanged
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE - V_OPT_FIXED);
});

test('non-flexible: required lines are still un-removable', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg({ is_consumable_flexible: false }),
      removedItemIds: [REQ_FIXED],
      ...BASELINE,
    }),
    'required_item_removed',
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* The OLD accrual half is untouched (flag-OFF behaviour is byte-identical)  */
/* ──────────────────────────────────────────────────────────────────────── */

test('legacy computeCustomization still ignores is_required (flag-OFF path unchanged)', () => {
  const legacy: VendorPackageWithItems = {
    package_id: 'pkg-1',
    vendor_profile_id: 'vp-1',
    package_name: 'Legacy',
    description: null,
    total_price_centavos: TOTAL_PRICE,
    consumable_budget_centavos: CONSUMABLE,
    is_consumable_flexible: true,
    primary_canonical_service: 'reception_venue',
    is_active: true,
    created_at: '2026-07-26T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
    items: [
      {
        item_id: REQ_FIXED,
        package_id: 'pkg-1',
        canonical_service: 'reception_venue',
        service_description: 'Ballroom',
        is_default_included: true,
        replacement_value_centavos: V_REQ_FIXED,
        display_order: 1,
        created_at: '2026-07-26T00:00:00Z',
        is_required: true,
      },
    ],
  };
  // The legacy function is the ACCRUAL half only — it has never known about
  // required-ness and must keep behaving exactly as it does on main, or a
  // flag-OFF booking would silently re-price.
  const out = computeCustomization(legacy, [REQ_FIXED]);
  assert.equal(out.removedTotalCentavos, V_REQ_FIXED);
  assert.equal(out.remainingConsumableCentavos, CONSUMABLE + V_REQ_FIXED);
  assert.equal(out.totalLockedCentavos, TOTAL_PRICE);
});
