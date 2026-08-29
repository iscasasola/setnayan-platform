/**
 * the-onboarding-discount-is-a-dial.test.ts
 *
 * ⚖ Owner, 2026-08-28: *"I want to be able to change 10% anytime. so I can set
 * discount on onboarding today and change it tomorrow. or anytime i want."*
 *
 * 🔴 THE FIRST BUILD GAVE HIM A STAMP, NOT A DIAL. The 10% shipped as sixteen
 * per-row prices written once by a migration. Three things were wrong with that
 * and only the third is obvious:
 *   • it did not follow a reprice;
 *   • an admin could not see what the discount currently WAS;
 *   • **it could only ever deepen.** A stored 10%-off price is cheaper than a
 *     5%-off calculation, so cheapest-wins pins it there forever — turning the
 *     dial down would have done nothing at all, silently.
 *
 * 🔑 SO THE PERCENTAGE IS THE STORED RULE AND EVERY PRICE DERIVES FROM IT, and
 * the sixteen stamped copies are cleared — because **a stored copy of a derived
 * value is exactly the thing that stops the rule being editable.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  setupPricePhp,
  readOnboardingDiscountPct,
  DEFAULT_ONBOARDING_DISCOUNT_PCT,
  MAX_ONBOARDING_DISCOUNT_PCT,
} from './onboarding-discount';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('🔴 the dial turns BOTH ways — the failure the first build had', () => {
  // A Papic rung with no override of its own follows the house rule exactly.
  assert.equal(setupPricePhp(2400, null, 10), 2160);
  assert.equal(setupPricePhp(2400, null, 15), 2040);
  // …and DOWN again. Under a stamped model this was impossible.
  assert.equal(setupPricePhp(2400, null, 5), 2280);
  assert.equal(setupPricePhp(2400, null, 0), 2400);
});

test('a deliberate per-row price is an exception, not a copy of the rule', () => {
  // Setnayan AI: ₱2,499 → ₱1,499 is somebody's decision, made months earlier.
  assert.equal(setupPricePhp(2499, 1499, 10), 1499, 'the house 10% must not RAISE it to ₱2,249');
  assert.equal(setupPricePhp(2499, 1499, 5), 1499, 'nor a smaller house discount');
  // But the house rule is a FLOOR: go deeper than the exception and the buyer
  // gets the deeper one.
  assert.equal(setupPricePhp(2499, 1499, 50), 1249.5);
});

test('⛔ bad data can never charge somebody MORE for buying early', () => {
  // An override above retail is not an offer.
  assert.equal(setupPricePhp(1000, 1500, 10), 900);
  assert.equal(setupPricePhp(1000, 0, 10), 900, 'zero is "unset", not "free"');
  assert.equal(setupPricePhp(1000, null, 0), 1000, 'no discount is the retail price, never more');
});

test('⚠ a percentage we cannot read falls to the DEFAULT, never to zero', () => {
  // A settings read that fails must not silently retract a discount the screen
  // is advertising — nor invent a huge one.
  for (const bad of [null, undefined, '', 'abc', NaN, -1, 91, 1000]) {
    assert.equal(readOnboardingDiscountPct(bad), DEFAULT_ONBOARDING_DISCOUNT_PCT, String(bad));
  }
  assert.equal(readOnboardingDiscountPct('15'), 15, 'a numeric string is a number');
  assert.equal(readOnboardingDiscountPct(MAX_ONBOARDING_DISCOUNT_PCT), MAX_ONBOARDING_DISCOUNT_PCT);
});

test('🔒 the card and the charge read the SAME function', () => {
  // A screen must not be able to quote a figure the checkout will not honour.
  const card = strip(read('lib/onboarding/services-step-server.ts'));
  const charge = strip(read('lib/onboarding-services-orders.ts'));
  for (const [name, src] of [['card', card], ['charge', charge]] as const) {
    assert.match(src, /setupPricePhp\(/, `the ${name} must price through the shared rule`);
    assert.match(src, /onboarding_discount_pct/, `the ${name} must read the live setting`);
  }
});

test('🪤 no stamped copy of the rule survives in the catalog', () => {
  const sql = read('../../supabase/migrations/20271176771940_onboarding_discount_is_a_setting.sql');
  assert.match(
    sql,
    /SET onboarding_price_php = NULL[\s\S]*?WHERE service_code LIKE 'PAPIC_GUEST%'/,
    'the stamped rungs must be cleared, or the dial only turns one way',
  );
  assert.match(sql, /still carry a stamped price/, 'and the migration must refuse if any remain');
  // …while the deliberate overrides survive. Clearing them would RAISE four
  // prices — the same failure as the last migration, in the other direction.
  assert.match(sql, /expected 4 AI overrides intact/, 'the AI exceptions must be asserted');
  // Scoped to the STATEMENT, not the file: the assertion block below names the
  // AI rows on purpose, to prove they survived. A whole-file match would read
  // that proof as the bug it is proving against.
  const clearing = /UPDATE public\.platform_retail_catalog_v2[\s\S]*?;/.exec(sql)?.[0] ?? '';
  assert.ok(clearing.length > 0, 'the clearing statement must exist');
  assert.doesNotMatch(clearing, /SETNAYAN_AI/, 'the AI rows must never be cleared');
});

test('the set-up discount box is RETIRED, and its column is not', () => {
  /*
    ⚖ OWNER 2026-08-29: *"this one doesn't exist anymore. onboarding discounts
    are already placed for setnayan AI and Papic which are the only services we
    sell on the onboarding."* That REVERSES his 2026-08-28 *"I want to be able to
    change 10% anytime"*, which is what this test used to pin.

    🔑 THE ASSERTION FLIPS, AND THE REASON IS THE POINT. A test that keeps
    asserting a superseded ruling is not a guard, it is a fossil that blocks the
    decision it used to protect.
  */
  const surface = strip(read('app/admin/pricing/_surfaces/pricing-surface.tsx'));
  const actions = strip(read('app/admin/pricing/actions.ts'));

  assert.doesNotMatch(
    surface,
    /<SetupDiscountForm/,
    'the box is off the screen — the per-family discounts are the mechanism now',
  );
  assert.doesNotMatch(
    actions,
    /export async function saveOnboardingDiscount/,
    'and its save goes with it: an action nothing can reach is the shape this repo keeps paying for',
  );
});

test('⚠ the column and its READERS survive — do not "tidy up" the fallback', () => {
  /*
    🔑 THE HALF THAT MUST NOT FOLLOW THE BOX. Removing a CONTROL is not removing
    a CAPABILITY. `platform_settings.onboarding_discount_pct` is still read live
    as the fallback for a product with no sign-up price of its own.

    It governs nothing TODAY — measured 2026-08-29, the set-up step sells exactly
    two families and every row in both carries its own `onboarding_price_php` —
    but "inert today" is not "safe to delete", and the next product added at
    set-up may well arrive without one. Deleting it is its own change with its
    own measurement, not a loose end of this one.
  */
  const orders = strip(read('lib/onboarding-services-orders.ts'));
  const step = strip(read('lib/onboarding/services-step-server.ts'));

  assert.match(orders, /onboarding_discount_pct/, 'the order mint still reads it');
  assert.match(step, /onboarding_discount_pct/, 'and so does the set-up step');
});

test('🪤 A BLANK BOX IS STILL REFUSED — the guard moved with the control', () => {
  /*
    `Number('')` is 0, 0 is finite, and 0 is a LEGAL discount — so a blank save
    reads as "0% off" and strips the sign-up saving from an entire family at
    once, reporting success. Sixteen Papic prices on one slip.

    🔑 THIS TEST USED TO POINT AT THE HOUSE SET-UP DISCOUNT, WHICH IS RETIRED.
    Rather than delete it with its subject, it was aimed at the control that
    REPLACED it — and that control did not have the guard. The bug was live when
    this was written. That is the argument against deleting a guard just because
    the thing it watched moved: the lesson outlives the code.
  */
  const control = strip(read('app/admin/pricing/price-control-actions.ts'));
  assert.match(
    control,
    /if \(raw_str === ''\) return null;/,
    'an empty percentage must be refused BEFORE it is read as a number',
  );
});

test('a family-wide discount edit is audited — it moves every price at once', () => {
  const control = strip(read('app/admin/pricing/price-control-actions.ts'));
  assert.match(
    control,
    /action: 'family_signup_discount_edit'/,
    'the edit must be recorded — one box moves sixteen prices',
  );
  assert.match(control, /rowsMoved/, 'with how many actually moved');
});
