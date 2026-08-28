/**
 * A CUSTOM PLAN CAN BE BOUGHT BY THE YEAR — AND A PURCHASE EXTENDS, NEVER RESETS.
 *
 * Two owner rulings of 2026-08-27, pinned together because they ship together:
 *   · *"subscription will only extend their plans for an additional 28 days …
 *     or 1 year."* — two terms, and a purchase ADDS to what is left.
 *   · Custom's annual is ×10.4 of the 28-day total, like every other tier.
 *
 * 🚨 THE DEFECT THIS FILE EXISTS TO STOP, AND IT WAS LIVE. The Custom activation
 * hook wrote `now + 28 days` STRAIGHT OVER `tier_expires_at` — no read of the
 * existing value, no GREATEST. A shop with 300 days left who renewed came out
 * with 28. The earlier they renewed, the more they lost: it punished the good
 * customer.
 *
 * 🔑 AND THE REASON IT SURVIVED IS THE LESSON. The three ordinary tiers renew
 * through `_apply_subscription_credit`, whose SQL has always carried
 * `GREATEST(now(), COALESCE(tier_expires_at, now())) + period_days`. Reading
 * that function produced a confident all-clear for Custom — which provably never
 * calls it. **A fix on a sibling path is not a fix on this one.** These
 * assertions are written against the Custom path specifically for that reason.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  annualFromMonthly,
  priceForTerm,
  customPlanExpiryFrom,
  computeCustomQuote,
  CUSTOM_ANNUAL_MULTIPLIER,
  CUSTOM_TERM_DAYS,
  CUSTOM_BASE,
  type CustomComposition,
  type CustomUnitPrices,
} from './vendor-custom-pricing';
import {
  customPlanServiceKeyForTerm,
  customPlanTargetFromServiceKey,
  customPlanServiceKey,
  vendorProfileIdFromCustomPlanServiceKey,
  selectActivatableCustomPlan,
} from './vendor-custom-catalog';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const VENDOR_ACTION = readFileSync(
  join(WEB, 'app/vendor-dashboard/subscription/custom/actions.ts'),
  'utf8',
);
const ACTIVATION = readFileSync(join(HERE, 'sku-activation.ts'), 'utf8');

const DAY = 24 * 60 * 60 * 1000;
const VENDOR = '11111111-2222-3333-4444-555555555555';

const PRICES: CustomUnitPrices = {
  base: 11000,
  branch: 1000,
  reachNationwide: 2500,
  seat: 250,
  slot: 500,
  domain: 500,
};
const BASE: CustomComposition = {
  branches: 1,
  reachKm: CUSTOM_BASE.reachKm,
  nationwide: false,
  seats: CUSTOM_BASE.seats,
  slotsPerCategory: CUSTOM_BASE.slotsPerCategory,
  photos: CUSTOM_BASE.photos,
  domain: false,
};

// ── (1) A YEARLY ORDER MINTS AT THE YEARLY AMOUNT ──────────────────────────

test('a yearly purchase costs ×10.4 of the 28-day total, not the 28-day total', () => {
  const q = computeCustomQuote(BASE, PRICES);
  assert.equal(q.final28, 11000);
  assert.equal(priceForTerm(q.final28, 'annual'), 114400);
  assert.notEqual(
    priceForTerm(q.final28, 'annual'),
    q.final28,
    'the yearly charge must not equal the 28-day charge — that is the whole defect',
  );
  assert.equal(priceForTerm(q.final28, '28d'), 11000);
});

test('the order path charges the TERM price and never the raw 28-day figure', () => {
  // Source-scanned: the mint must use the term-derived amount on BOTH money
  // rows. A regression here is a silent 28-day charge for a yearly request —
  // invisible to every behaviour test that does not read the database.
  const code = VENDOR_ACTION.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(code, /const chargePhp = priceForTerm\(final28, term\)/, 'the charge must be term-derived');
  assert.match(code, /requested_total_php: chargePhp/, 'the ORDER must carry the term price');
  assert.match(code, /amount_php: chargePhp/, 'the PAYMENT must carry the term price');
  assert.ok(
    !/requested_total_php: final28/.test(code),
    'the order is minting the raw 28-day figure again — a yearly request would be charged 28 days',
  );
});

// ── (2) THE CHARGED AMOUNT EQUALS THE QUOTED AMOUNT ────────────────────────

test('THE PROMISE: the amount charged is the amount the page quoted', () => {
  /*
    The configurator shows `quote.annual`; the server charges
    `priceForTerm(final28, term)`. If those two are ever different functions of
    the same composition, a supplier is quoted one number and billed another.
    They are asserted equal here for a spread of compositions rather than
    assumed equal because both "use ×10.4".
  */
  const compositions: CustomComposition[] = [
    BASE,
    { ...BASE, branches: 5 },
    { ...BASE, branches: 5, nationwide: true },
    { ...BASE, branches: 3, seats: 14, slotsPerCategory: 12, domain: true },
  ];
  for (const c of compositions) {
    const q = computeCustomQuote(c, PRICES);
    assert.equal(
      priceForTerm(q.final28, 'annual'),
      q.annual,
      `quoted annual ${q.annual} != charged annual ${priceForTerm(q.final28, 'annual')}`,
    );
    assert.equal(priceForTerm(q.final28, '28d'), q.final28);
  }
});

// ── (3) A PURCHASE EXTENDS — THE REGRESSION TEST ───────────────────────────

test('REGRESSION: a purchase EXTENDS remaining time, on both terms', () => {
  /*
    🚨 This is the test that goes RED against the pre-fix code. The old hook was
    `new Date(Date.now() + 28 days)` with no read of the existing expiry, so a
    shop with time remaining lost it.
  */
  const now = Date.parse('2026-08-27T00:00:00.000Z');
  const remaining = now + 300 * DAY; // 300 days still paid for

  const extended28 = Date.parse(customPlanExpiryFrom(now, remaining, '28d'));
  assert.equal(
    extended28,
    remaining + 28 * DAY,
    'a 28-day purchase must ADD 28 days to the remaining time, not replace it',
  );

  const extendedYear = Date.parse(customPlanExpiryFrom(now, remaining, 'annual'));
  assert.equal(
    extendedYear,
    remaining + 365 * DAY,
    'a yearly purchase must ADD 365 days to the remaining time',
  );

  // The shape of the old bug, stated as the thing that must NOT happen.
  assert.notEqual(extended28, now + 28 * DAY, 'the term was RESET — remaining time was discarded');
  assert.ok(extendedYear > now + 365 * DAY, 'the remaining 300 days vanished from a yearly renewal');
});

test('a lapsed or brand-new plan starts from now — same as GREATEST(now(), …)', () => {
  const now = Date.parse('2026-08-27T00:00:00.000Z');
  // No prior expiry at all.
  assert.equal(Date.parse(customPlanExpiryFrom(now, null, '28d')), now + 28 * DAY);
  // An expiry already in the past must not drag the new term backwards.
  const lapsed = now - 90 * DAY;
  assert.equal(Date.parse(customPlanExpiryFrom(now, lapsed, 'annual')), now + 365 * DAY);
});

test('the activation hook reads the existing expiry before writing a new one', () => {
  // The pure function can only extend if the CALLER hands it the current value.
  // A regression that stops reading `tier_expires_at` would leave every unit
  // assertion above green while the live path resets again.
  const code = ACTIVATION.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(code, /customPlanExpiryFrom\(/, 'the Custom hook no longer derives its expiry');
  assert.match(
    code,
    /select\('tier_expires_at'\)/,
    'the hook stopped reading the existing expiry — it can only reset now',
  );
  assert.ok(
    !/const expiresAt = new Date\(Date\.now\(\) \+ 28 \* 24 \* 60 \* 60 \* 1000\)\.toISOString\(\);[\s\S]{0,400}tier_state: 'custom'/.test(code),
    'the hard-coded 28-day reset is back on the Custom tier write',
  );
});

// ── THE BRANCH ADD-ON EXTENDS TOO ──────────────────────────────────────────

test('REGRESSION: a branch renewal EXTENDS its window, it does not reset it', () => {
  /*
    The branch add-on had the SAME defect as Custom and was fixed in the same
    change, because it is the same ruling: a subscription extends.

    ⚠ WHAT IS AND IS NOT CLAIMED HERE. The confirmed harm is that renewing early
    LOST the remaining days — 20 left plus a renewal gave 28 from today, not 48.
    An earlier note of mine called it "arguably worse, it can shorten"; that was
    withdrawn because it was never measured. Every activation through this path
    writes exactly `now + 28d`, so this path cannot itself create a window longer
    than 28 days, and no other path that could was demonstrated. The lost-days
    harm stands on its own and needs no embellishment.

    🔑 The branch row has NO expiry column — the window lives on
    `orders.expires_at` — so the helper is fed the prior PAID order's expiry.
  */
  const now = Date.parse('2026-08-27T00:00:00.000Z');
  const twentyLeft = now + 20 * DAY;

  assert.equal(
    Date.parse(customPlanExpiryFrom(now, twentyLeft, '28d')),
    twentyLeft + 28 * DAY,
    'an early branch renewal must ADD 28 days to the 20 remaining, giving 48',
  );
  assert.notEqual(
    Date.parse(customPlanExpiryFrom(now, twentyLeft, '28d')),
    now + 28 * DAY,
    'the branch window was RESET — the remaining 20 days were discarded',
  );
  // A first purchase, or one after the window lapsed, starts from now.
  assert.equal(Date.parse(customPlanExpiryFrom(now, null, '28d')), now + 28 * DAY);
});

test('the branch hook reads its prior window before writing a new one', () => {
  // The branch has no expiry column, so the ONLY way to extend is to read the
  // prior paid order. A regression that drops that read resets again, silently.
  const code = ACTIVATION.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const branchBlock = code.slice(code.indexOf('branchIdFromServiceKey(ctx.serviceKey)'));
  assert.match(
    branchBlock.slice(0, 2000),
    /customPlanExpiryFrom\(/,
    'the branch hook no longer derives its expiry — it is resetting again',
  );
  assert.ok(
    !/new Date\(Date\.now\(\) \+ 28 \* 24 \* 60 \* 60 \* 1000\)/.test(code),
    'a hard-coded 28-day reset is back in sku-activation.ts',
  );
});

// ── (4) THE EXACT-MATCH BINDING STILL REFUSES A MISMATCH ───────────────────

const plan = (quoted: number) => [
  { custom_plan_id: 'p1', status: 'pending_payment', quoted_28d_php: quoted, updated_at: '2026-08-27T00:00:00Z' },
];

test('binding: a yearly payment matches ×10.4 of the plan, and nothing else', () => {
  assert.equal(selectActivatableCustomPlan(plan(11000), 114400, 'annual'), 'p1');
  // The 28-day amount must NOT activate a yearly order…
  assert.equal(selectActivatableCustomPlan(plan(11000), 11000, 'annual'), null);
  // …and the yearly amount must NOT activate a 28-day one.
  assert.equal(selectActivatableCustomPlan(plan(11000), 114400, '28d'), null);
});

test('binding: the exact-match property survives, on both terms', () => {
  // One peso out, either way, on either term → refuse. The tolerance is half a
  // peso and must not have become a range.
  for (const [term, exact] of [['28d', 11000], ['annual', 114400]] as const) {
    assert.equal(selectActivatableCustomPlan(plan(11000), exact, term), 'p1');
    assert.equal(selectActivatableCustomPlan(plan(11000), exact + 1, term), null);
    assert.equal(selectActivatableCustomPlan(plan(11000), exact - 1, term), null);
  }
});

test('binding: an edited composition still breaks the match — pay-cheap/get-expensive stays closed', () => {
  // The plan was re-quoted upward after this order was raised.
  assert.equal(selectActivatableCustomPlan(plan(15000), 114400, 'annual'), null);
  assert.equal(selectActivatableCustomPlan(plan(15000), 11000, '28d'), null);
});

// ── THE TERM CARRIER ───────────────────────────────────────────────────────

test('the two service-key prefixes are DISJOINT — an annual key can never read as 28-day', () => {
  /*
    🔑 LOAD-BEARING. If `vendor_custom_plan_annual__x` also matched the 28-day
    prefix, a year's money would bind against the 28-day expected amount, refuse,
    and strand a paid order — or worse, match and grant 28 days for a year's fee.
  */
  const annual = customPlanServiceKeyForTerm(VENDOR, 'annual');
  const monthly = customPlanServiceKeyForTerm(VENDOR, '28d');
  assert.notEqual(annual, monthly);
  assert.equal(monthly, customPlanServiceKey(VENDOR));
  assert.equal(
    vendorProfileIdFromCustomPlanServiceKey(annual),
    null,
    'the 28-day parser accepted an ANNUAL key — the prefixes have collided',
  );
  assert.deepEqual(customPlanTargetFromServiceKey(annual), { vendorProfileId: VENDOR, term: 'annual' });
  assert.deepEqual(customPlanTargetFromServiceKey(monthly), { vendorProfileId: VENDOR, term: '28d' });
  assert.equal(customPlanTargetFromServiceKey('something_else__x'), null);
});

test('the terms and the multiplier are what the owner set', () => {
  assert.equal(CUSTOM_ANNUAL_MULTIPLIER, 10.4);
  assert.equal(CUSTOM_TERM_DAYS['28d'], 28);
  assert.equal(CUSTOM_TERM_DAYS.annual, 365);
  assert.equal(annualFromMonthly(11000), 114400);
  // Whole pesos, always — ×10.4 of a discounted total can land on a fraction.
  assert.equal(annualFromMonthly(13501) % 1, 0);
  assert.equal(annualFromMonthly(0), 0);
  assert.equal(annualFromMonthly(-5), 0);
});
