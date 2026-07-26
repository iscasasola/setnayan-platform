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
 *   • the single unspent-credit policy — expiring (refundable is RETIRED);
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
import { computeCustomization, keptItems, type VendorPackageWithItems } from './vendor-packages';

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

  // ...and asking for those values must not produce them either. Without
  // this half the test passes with the guard deleted (it only ever measured
  // the no-removal baseline, which never touches the guard).
  for (const id of [REQ_FIXED, REQ_CHOICE]) {
    const attempt = computePackageCredit({ pkg: pkg(), removedItemIds: [id], ...BASELINE });
    assert.equal(attempt.ok, false, `removing ${id} must be refused, got ${JSON.stringify(attempt)}`);
  }
});

test('INVARIANT (by exhaustion): EVERY subset of removals — the pool can never exceed budget + the OPTIONAL lines', () => {
  // This test previously enumerated only the OPTIONAL ids, so it passed with
  // the required-removal guard deleted: it never asked the engine to do the
  // one thing the invariant forbids. It now walks the full power set of ALL
  // FOUR lines (16 subsets), which is the real exhaustion claim.
  const ceiling = CONSUMABLE + V_OPT_FIXED + V_OPT_CHOICE;
  const ALL = [REQ_FIXED, REQ_CHOICE, OPT_FIXED, OPT_CHOICE];
  const required = new Set([REQ_FIXED, REQ_CHOICE]);

  let acceptedCount = 0;
  let refusedCount = 0;

  for (let mask = 0; mask < 1 << ALL.length; mask += 1) {
    const removedItemIds = ALL.filter((_, i) => (mask & (1 << i)) !== 0);
    const touchesRequired = removedItemIds.some((id) => required.has(id));
    const r = computePackageCredit({ pkg: pkg(), removedItemIds, ...BASELINE });

    if (touchesRequired) {
      // Not merely "bounded" — REFUSED. A subset naming a required line must
      // never produce a credit figure at all.
      assert.equal(
        r.ok,
        false,
        `removing ${JSON.stringify(removedItemIds)} touches a required line and must be refused, got ${JSON.stringify(r)}`,
      );
      if (!r.ok) {
        assert.ok(
          r.errors.some((e) => e.code === 'required_item_removed'),
          `expected required_item_removed for ${JSON.stringify(removedItemIds)}, got ${JSON.stringify(r.errors.map((e) => e.code))}`,
        );
      }
      refusedCount += 1;
      continue;
    }

    const okr = ok(r);
    assert.ok(
      okr.availableCreditCentavos <= ceiling,
      `pool ${okr.availableCreditCentavos} exceeded ceiling ${ceiling} for ${JSON.stringify(removedItemIds)}`,
    );
    acceptedCount += 1;
  }

  // The walk really covered both halves — guards against a future refactor
  // that makes every subset vacuously "accepted" or "refused".
  assert.equal(acceptedCount, 4, 'exactly the 4 optional-only subsets are accepted');
  assert.equal(refusedCount, 12, 'the other 12 subsets name a required line and are refused');

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

test('SURPLUS: leftover credit is FORFEITED — it never comes off the price', () => {
  // Owner-locked 2026-07-26: "credits can be shifted to other services, but
  // will not discount the price." Previously this asserted the opposite under
  // policy 'refundable', which is now retired.
  const r = ok(
    computePackageCredit({ pkg: pkg(), chosenOptionIds: [MAIN_PREMIUM] }),
  );
  const leftover = CONSUMABLE - DELTA_MAIN_PREMIUM;
  assert.equal(r.creditRefundCentavos, 0, 'credit must never be refunded as money');
  assert.equal(r.forfeitedCreditCentavos, leftover, 'unspent credit is forfeited');
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE, 'the price does not move');
});

test('EXACTLY ZERO: spend meets credit — no leftover, no overspend, either policy', () => {
  // Budget tuned so the premium main exactly consumes the pool.
  const exact = pkg({ consumable_budget_centavos: DELTA_MAIN_PREMIUM });
  for (const policy of ['expiring'] as const) {
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

test('OVERSPENT: the excess bills, and nothing is ever refunded', () => {
  const tiny = pkg({ consumable_budget_centavos: 5_000 });
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

test('a pool larger than the price can NEVER drive the total below the price', () => {
  // The old 'refundable' path clamped the booking total at ₱0 here. With credit
  // barred from discounting, a huge pool is simply a huge amount of spending
  // power inside the package — the couple still pays the sticker price.
  const r = ok(
    computePackageCredit({
      pkg: pkg({ total_price_centavos: 1_000, consumable_budget_centavos: 900_000 }),
      ...BASELINE,
    }),
  );
  assert.equal(r.bookingTotalCentavos, 1_000, 'the price stands');
  assert.equal(r.creditRefundCentavos, 0);
  assert.equal(r.forfeitedCreditCentavos, 900_000, 'the whole unused pool is forfeited');
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Catalogue additions — credit spends across the WHOLE catalogue            */
/* ──────────────────────────────────────────────────────────────────────── */

test('credit spends on catalogue items outside the package', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-extra-hour', quantity: 2 }],
      catalogue: [{ addition_id: 'svc-extra-hour', unit_price_centavos: 8_000 }],
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
      additions: [{ addition_id: 'svc-extra-hour', quantity: 1 }],
      catalogue: [{ addition_id: 'svc-extra-hour', unit_price_centavos: 8_000 }],
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
        { addition_id: 'svc-x', quantity: 1 },
        { addition_id: 'svc-x', quantity: 1 },
      ],
      catalogue: [{ addition_id: 'svc-x', unit_price_centavos: 1_000 }],
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
        additions: [{ addition_id: 'svc-x', quantity }],
        catalogue: [{ addition_id: 'svc-x', unit_price_centavos: 1_000 }],
      }),
      'invalid_addition',
    );
  }
});

test('a negative catalogue price cannot mint credit', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-x', quantity: 1 }],
      catalogue: [{ addition_id: 'svc-x', unit_price_centavos: -50_000 }],
    }),
    'invalid_addition',
  );
});

/* ── The client cannot supply a price at all ─────────────────────────────── */

test('an addition with no server-resolved price is REFUSED, not treated as free', () => {
  // The whole point of splitting `additions` (ids + quantity) from
  // `catalogue` (server-read prices): a client-named id the server did not
  // price must not silently cost 0 and eat none of the pool.
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-not-in-catalogue', quantity: 3 }],
      catalogue: [{ addition_id: 'svc-something-else', unit_price_centavos: 1_000 }],
    }),
    'unknown_addition',
  );
});

test('an addition with no catalogue at all is refused', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-x', quantity: 1 }],
    }),
    'unknown_addition',
  );
});

test('two prices for one catalogue id is ambiguous and refused', () => {
  failsWith(
    computePackageCredit({
      pkg: pkg(),
      ...BASELINE,
      additions: [{ addition_id: 'svc-x', quantity: 1 }],
      catalogue: [
        { addition_id: 'svc-x', unit_price_centavos: 1_000 },
        { addition_id: 'svc-x', unit_price_centavos: 9_000 },
      ],
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
  // CONVERGED 2026-07-26. This test previously pinned the OPPOSITE — that the
  // legacy accrual half ignored required-ness — on the argument that changing
  // it would re-price a flag-OFF booking. That argument does not survive the
  // facts: prod holds zero packages and zero package bookings, so there is no
  // booking to re-price, and leaving it meant the shipped (flag-OFF) lock path
  // refunded a host for a line the vendor marked mandatory. Both engines now
  // agree: a required line is never removable and never accrues credit.
  const out = computeCustomization(legacy, [REQ_FIXED]);
  assert.equal(out.removedTotalCentavos, 0);
  assert.equal(out.remainingConsumableCentavos, CONSUMABLE);
  assert.equal(out.totalLockedCentavos, TOTAL_PRICE);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* REQUIRED implies INCLUDED                                                */
/*                                                                          */
/* is_required=TRUE + is_default_included=FALSE used to resolve as "keep it" */
/* — the couple was DELIVERED a line they never bought, and (per the         */
/* cascade, which prices event_vendors off replacement_value_centavos) the   */
/* 5% platform-fee base was inflated by revenue nobody collected. Wrong in   */
/* both directions, so the shape is refused outright.                       */
/* ──────────────────────────────────────────────────────────────────────── */

function ghostPkg(): CreditPackage {
  return pkg({
    items: [
      ...items(),
      {
        item_id: 'item-ghost',
        is_required: true,
        is_default_included: false,
        replacement_value_centavos: 900_000,
      },
    ],
  });
}

test('required + NOT included is refused — never silently delivered for free', () => {
  failsWith(computePackageCredit({ pkg: ghostPkg(), ...BASELINE }), 'invalid_package');
});

test('required + NOT included never reaches keptItemIds (the cascade set)', () => {
  const r = computePackageCredit({ pkg: ghostPkg(), ...BASELINE });
  assert.equal(r.ok, false);
  if (r.ok) return;
  const refs = r.errors.map((e) => e.ref);
  assert.ok(refs.includes('item-ghost'), `the offending line must be named, got ${JSON.stringify(refs)}`);
});

test('optional + NOT included is still fine — it is simply not in the booking', () => {
  const r = ok(
    computePackageCredit({
      pkg: pkg({
        items: [
          ...items(),
          {
            item_id: 'item-upsell',
            is_required: false,
            is_default_included: false,
            replacement_value_centavos: 900_000,
          },
        ],
      }),
      ...BASELINE,
    }),
  );
  assert.ok(!r.keptItemIds.includes('item-upsell'), 'an unticked line is not in the booking');
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* An option chosen on an EXCLUDED line is an error, not a silent no-op      */
/* ──────────────────────────────────────────────────────────────────────── */

test('choosing an option on a line that is not included is refused', () => {
  // Previously this returned ok:true with the pick simply gone from
  // `selections` — so a stored upgrade whose line the vendor later un-ticked
  // would vanish with no error and the booking would be written without it.
  const withExcludedChoice = pkg({
    items: [
      ...items(),
      {
        item_id: 'item-excluded-choice',
        is_required: false,
        is_default_included: false,
        replacement_value_centavos: 0,
        options: [
          { option_id: 'opt-exc-std', price_delta_centavos: 0, is_default: true, is_available: true },
          { option_id: 'opt-exc-prem', price_delta_centavos: 30_000, is_default: false, is_available: true },
        ],
      },
    ],
  });
  failsWith(
    computePackageCredit({ pkg: withExcludedChoice, chosenOptionIds: [MAIN_DEFAULT, 'opt-exc-prem'] }),
    'option_on_excluded_item',
  );
});

/* ──────────────────────────────────────────────────────────────────────── */
/* The result tuple RECONCILES — no phantom refunds                         */
/*                                                                          */
/* Two identities must hold for every accepted input, or a caller writing    */
/* creditRefundCentavos onto a ledger books money that was never applied:    */
/*   bookingTotal  === basePrice + overspend − creditRefund                  */
/*   available     === spent + refund + forfeited   (when not overspent)     */
/* ──────────────────────────────────────────────────────────────────────── */

test('RECONCILES: a refund is never larger than the price it comes off', () => {
  // The exact shape that used to report a ₱40,000 phantom refund: pool far
  // exceeds the price, total floors at 0, refund claimed the whole pool and
  // forfeited claimed nothing was lost.
  const r = ok(
    computePackageCredit({
      pkg: {
        total_price_centavos: 1_000_000,
        consumable_budget_centavos: 5_000_000,
        is_consumable_flexible: true,
        unspent_credit_policy: 'expiring',
        items: [],
      },
    }),
  );
  assert.equal(r.bookingTotalCentavos, 1_000_000, 'the price stands — credit never discounts');
  assert.equal(r.creditRefundCentavos, 0, 'nothing is ever refunded');
  assert.equal(r.forfeitedCreditCentavos, 5_000_000, 'the WHOLE unused pool is LOST, and says so');
  // The identity, stated directly.
  assert.equal(
    r.bookingTotalCentavos,
    1_000_000 + r.overspendCentavos - r.creditRefundCentavos,
  );
  assert.equal(
    r.creditRefundCentavos + r.forfeitedCreditCentavos,
    r.remainingCreditCentavos,
    'every centavo of leftover is either refunded or forfeited — never both, never neither',
  );
});

test('RECONCILES: both identities hold across a matrix of shapes and policies', () => {
  const removalSets: string[][] = [[], [OPT_FIXED], [OPT_CHOICE], [OPT_FIXED, OPT_CHOICE]];
  const choiceSets: string[][] = [[MAIN_DEFAULT], [MAIN_PREMIUM], [MAIN_PREMIUM, DESSERT_PREMIUM]];
  const budgets = [0, 5_000, CONSUMABLE, 900_000, 5_000_000];
  const prices = [1_000, 100_000, TOTAL_PRICE];
  let checked = 0;

  for (const policy of ['expiring'] as const) {
    for (const flexible of [true, false]) {
      for (const budget of budgets) {
        for (const price of prices) {
          for (const removedItemIds of removalSets) {
            for (const chosenOptionIds of choiceSets) {
              const r = computePackageCredit({
                pkg: pkg({
                  unspent_credit_policy: policy,
                  is_consumable_flexible: flexible,
                  consumable_budget_centavos: budget,
                  total_price_centavos: price,
                }),
                removedItemIds,
                chosenOptionIds,
              });
              if (!r.ok) continue;
              checked += 1;

              const basePrice = flexible ? price : Math.max(0, price - r.removedTotalCentavos);

              assert.equal(
                r.bookingTotalCentavos,
                basePrice + r.overspendCentavos - r.creditRefundCentavos,
                `total identity broke for ${JSON.stringify({ policy, flexible, budget, price, removedItemIds, chosenOptionIds })}`,
              );
              assert.ok(r.bookingTotalCentavos >= 0, 'a booking total can never be negative');
              assert.equal(
                r.creditRefundCentavos + r.forfeitedCreditCentavos,
                r.remainingCreditCentavos,
                'leftover must be fully accounted for',
              );
              assert.ok(
                r.creditRefundCentavos <= basePrice,
                `refund ${r.creditRefundCentavos} exceeded the price ${basePrice} it comes off`,
              );
              // Spend + leftover reconstructs the pool whenever nothing was
              // overspent (and the overspend case is its own mirror).
              if (r.overspendCentavos === 0) {
                assert.equal(
                  r.spentCreditCentavos + r.remainingCreditCentavos,
                  r.availableCreditCentavos,
                  'pool identity broke',
                );
              } else {
                assert.equal(r.remainingCreditCentavos, 0);
                assert.equal(
                  r.spentCreditCentavos - r.availableCreditCentavos,
                  r.overspendCentavos,
                );
              }
            }
          }
        }
      }
    }
  }
  assert.ok(checked >= 300, `the matrix must actually exercise the engine, only ${checked} cases ran`);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* CREDIT NEVER DISCOUNTS — owner-locked 2026-07-26                         */
/*                                                                          */
/* "Credits can be shifted to other services, but will not discount the      */
/* price." This block used to PIN the opposite under policy 'refundable',    */
/* with a note that these are the tests that change if the owner confirms    */
/* the other reading. The owner confirmed. They changed.                     */
/* ──────────────────────────────────────────────────────────────────────── */

test('a zero-customization booking pays the FULL sticker price', () => {
  // The real seeded Sofitel shape: ₱1,400,000 package, ₱200,000 consumable.
  // Under the retired 'refundable' this returned ₱1,200,000 — ₱200,000 given
  // away to a couple who customized nothing and still received every inclusion.
  const sofitel = pkg({
    total_price_centavos: 140_000_000,
    consumable_budget_centavos: 20_000_000,
  });
  const r = ok(computePackageCredit({ pkg: sofitel, ...BASELINE }));
  assert.equal(r.bookingTotalCentavos, 140_000_000, 'the pool is spending power, not a discount');
  assert.equal(r.creditRefundCentavos, 0);
});

test('the retired policy REFUSES rather than quietly discounting', () => {
  // A row still carrying 'refundable' must fail closed. Silently honouring it
  // would reintroduce the giveaway on exactly the packages nobody re-saved.
  const r = computePackageCredit({
    pkg: { ...pkg(), unspent_credit_policy: 'refundable' as never },
    ...BASELINE,
  });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errors.some((e) => e.code === 'invalid_package'));
});

test("PINNED: 'expiring' (the DEFAULT) charges the full sticker price for the same booking", () => {
  const sofitel = pkg({
    total_price_centavos: 140_000_000,
    consumable_budget_centavos: 20_000_000,
    unspent_credit_policy: 'expiring',
  });
  const r = ok(computePackageCredit({ pkg: sofitel, ...BASELINE }));
  assert.equal(r.bookingTotalCentavos, 140_000_000, 'the shipped default must not move money');
  assert.equal(r.forfeitedCreditCentavos, 20_000_000);
  assert.equal(r.creditRefundCentavos, 0);
});

test("PINNED: under 'expiring', removals never move the price (the model's pillar)", () => {
  const r = ok(
    computePackageCredit({ pkg: pkg(), removedItemIds: [OPT_FIXED, OPT_CHOICE], ...BASELINE }),
  );
  assert.equal(r.bookingTotalCentavos, TOTAL_PRICE);
  assert.equal(r.availableCreditCentavos, CONSUMABLE + V_OPT_FIXED + V_OPT_CHOICE);
});

/* ──────────────────────────────────────────────────────────────────────── */
/* keptItemIds DIVERGES from the shipped keptItems() — documented, not a bug */
/* ──────────────────────────────────────────────────────────────────────── */

test('CONVERGED: keptItems() and keptItemIds agree on un-ticked lines', () => {
  // Was DIVERGENCE. keptItems() filtered only on removal, so a line the vendor
  // never ticked still cascaded into event_vendors while the credit engine
  // excluded it — the host was delivered a service they never bought, and the
  // fee base was inflated by revenue nobody collected. The lock wave resolved
  // it in the credit engine's favour (2026-07-26): both now drop it.
  const legacy: VendorPackageWithItems = {
    package_id: 'pkg-div',
    vendor_profile_id: 'vp-1',
    package_name: 'Divergence',
    description: null,
    total_price_centavos: TOTAL_PRICE,
    consumable_budget_centavos: 0,
    is_consumable_flexible: true,
    primary_canonical_service: 'reception_venue',
    is_active: true,
    created_at: '2026-07-26T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
    items: [
      {
        item_id: 'ticked',
        package_id: 'pkg-div',
        canonical_service: 'reception_venue',
        service_description: 'Ballroom',
        is_default_included: true,
        replacement_value_centavos: 0,
        display_order: 1,
        created_at: '2026-07-26T00:00:00Z',
      },
      {
        item_id: 'unticked',
        package_id: 'pkg-div',
        canonical_service: 'catering',
        service_description: 'Optional upsell',
        is_default_included: false,
        replacement_value_centavos: 50_000,
        display_order: 2,
        created_at: '2026-07-26T00:00:00Z',
      },
    ],
  };
  assert.deepEqual(
    keptItems(legacy, []).map((i) => i.item_id),
    ['ticked'],
    'CONVERGED: an un-ticked line no longer cascades — it was never bought',
  );

  const r = ok(
    computePackageCredit({
      pkg: {
        total_price_centavos: TOTAL_PRICE,
        consumable_budget_centavos: 0,
        is_consumable_flexible: true,
        unspent_credit_policy: 'expiring',
        items: [
          { item_id: 'ticked', is_required: false, is_default_included: true, replacement_value_centavos: 0 },
          { item_id: 'unticked', is_required: false, is_default_included: false, replacement_value_centavos: 50_000 },
        ],
      },
    }),
  );
  assert.deepEqual(r.keptItemIds, ['ticked'], 'credit engine: an un-ticked line is NOT in the booking');
});
