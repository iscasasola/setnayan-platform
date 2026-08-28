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

test('the admin stores the percentage — it does not sweep prices', () => {
  const actions = strip(read('app/admin/pricing/actions.ts'));
  const form = strip(read('app/admin/pricing/_components/setup-discount-form.tsx'));
  const surface = strip(read('app/admin/pricing/_surfaces/pricing-surface.tsx'));
  assert.match(actions, /formData\.get\('onboarding_discount_pct'\)/, 'the save must read it');
  assert.match(
    actions,
    /\.update\(\{ onboarding_discount_pct: pctR, updated_at: new Date\(\)\.toISOString\(\) \}\)/,
    'and STORE it, so it survives until he changes it again',
  );
  assert.match(form, /name="onboarding_discount_pct"/, 'the screen must offer the field');
  assert.match(
    form,
    /defaultValue=\{discountPct\}/,
    'and show the CURRENT value — a blank box cannot tell him what the discount is',
  );
  assert.match(surface, /<SetupDiscountForm/, 'and the form must actually be mounted');
  // The one-shot sweep is gone: two ways to set one number is how they drift.
  assert.doesNotMatch(actions, /setup_discount_pct/, 'the one-shot knob must not survive');
  assert.doesNotMatch(actions, /bulkPct|bulkValid/, 'nor its sweep');
});

test('🪤 a blank box is REFUSED, never read as 0%', () => {
  // `Number('')` is 0 and 0 is a legal discount, so a blank save would retract
  // the discount from every product at once and report success.
  const actions = strip(read('app/admin/pricing/actions.ts'));
  assert.match(
    actions,
    /if \(raw === '' \|\| !Number\.isFinite\(pct\)/,
    'an empty field must be refused before it is read as a number',
  );
});

test('the change is audited, because it moves every price at once', () => {
  const actions = strip(read('app/admin/pricing/actions.ts'));
  assert.match(actions, /action: 'onboarding_discount_edit'/, 'the edit must be recorded');
  assert.match(actions, /before: priorPct/, 'with what it was');
});
