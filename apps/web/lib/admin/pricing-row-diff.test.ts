/**
 * pricing-row-diff.test.ts — the description-blanking regression, pinned.
 *
 * WHATS_NEXT_Managing_Prices_2026-08-26.md § 2, measured against prod:
 * "Every 'Save all changes' blanks the description of every row whose ⓘ panel
 * was closed." 32 of the last 34 bulk-edited rows lost their note; 0 preserved
 * one. The old bulk form only rendered the description textarea while a
 * per-row disclosure was open, so a closed one meant the field never reached
 * the server, and `desc === '' ? null : desc` wrote NULL over a row that had
 * a real description.
 *
 * The fix is a SHAPE fix: the per-row card renders the description field
 * unconditionally whenever it's open, so a save that only intended to change
 * the price still submits the description exactly as it stood. This test
 * builds the field values a real per-row card submission would produce when
 * only the price field was touched (the `formData.get(...)` extraction for
 * `saveRetailRow` stays inline in actions.ts — see that file's comment — so
 * this validates the same `validateRetailRowFields` step it calls, fed the
 * same shape of values it would receive), and asserts the description
 * survives.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRetailRowFields,
  retailRowUnchanged,
  type RawRetailRowFields,
  type RetailRowPrior,
} from './pricing-row-diff';

const PRIOR: RetailRowPrior = {
  title: 'Papic — add 10,000 shots',
  description: 'Tops the shared pot up by 10,000 shots — the rung most celebrations land on.',
  retail_price_php: 2999,
  saas_overhead_cost_php: 240,
  is_active: true,
  onboarding_price_php: null,
  billing_period: 'one_time',
  is_pax_priced: false,
  pax_floor: null,
  pax_floor_price_php: null,
  pax_increment_size: null,
  pax_increment_price_php: null,
};

/**
 * Every field the real card submits, populated with PRIOR's own values —
 * this is exactly what a browser POSTs for a row whose card is open but
 * whose admin only edited ONE field (here: price). The description field is
 * never absent, because the new card has no collapsible panel to hide it.
 */
function fieldsFor(prior: RetailRowPrior, overrides: Partial<RawRetailRowFields> = {}): RawRetailRowFields {
  return {
    // A real Papic rung, so the family-scoped floor is genuinely exercised
    // rather than skipped by a code that belongs to no family. Every existing
    // case leaves the sign-up price blank, which the floor never judges.
    serviceCode: 'PAPIC_GUEST_10K',
    title: prior.title,
    desc: prior.description ?? '',
    price: String(prior.retail_price_php),
    cost: String(prior.saas_overhead_cost_php),
    active: prior.is_active,
    onboardingPrice: prior.onboarding_price_php != null ? String(prior.onboarding_price_php) : '',
    billingPeriod: prior.billing_period,
    isPaxPriced: prior.is_pax_priced,
    paxFloor: prior.pax_floor != null ? String(prior.pax_floor) : '',
    paxFloorPrice: prior.pax_floor_price_php != null ? String(prior.pax_floor_price_php) : '',
    paxIncrementSize: prior.pax_increment_size != null ? String(prior.pax_increment_size) : '',
    paxIncrementPrice: prior.pax_increment_price_php != null ? String(prior.pax_increment_price_php) : '',
    ...overrides,
  };
}

test('changing only the price leaves an existing description untouched', () => {
  const fields = fieldsFor(PRIOR, { price: '3200' });

  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true, 'a well-formed per-row submission must validate');
  if (!validated.ok) return;

  assert.equal(
    validated.next.description,
    PRIOR.description,
    'the description the row already had must survive a price-only edit',
  );
  assert.equal(validated.next.retail_price_php, 3200, 'the price change must still land');
  assert.notEqual(
    validated.next.description,
    null,
    'REGRESSION: a real description must never come back as null from an edit that never touched it',
  );
});

test('the row correctly reports itself changed (price differs, description does not)', () => {
  const fields = fieldsFor(PRIOR, { price: '3200' });
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(retailRowUnchanged(PRIOR, validated.next), false);
});

test('a genuinely unedited resubmission reports no changes at all', () => {
  const fields = fieldsFor(PRIOR);
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(
    retailRowUnchanged(PRIOR, validated.next),
    true,
    'resubmitting every field at its current value must not read as a change',
  );
});

test('clearing the description field on purpose still works — the fix is not "description can never become null"', () => {
  const fields = fieldsFor(PRIOR, { desc: '' });
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.next.description, null, 'an admin deliberately blanking the field must still be honored');
});

test('a row with NO prior description is not falsely reported as changed by an empty submission', () => {
  const priorNoDesc: RetailRowPrior = { ...PRIOR, description: null };
  const fields = fieldsFor(priorNoDesc);
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(retailRowUnchanged(priorNoDesc, validated.next), true);
});

test('the seven previously-locked fields round-trip through the same validation step', () => {
  const priorWithExtras: RetailRowPrior = {
    ...PRIOR,
    onboarding_price_php: 1499,
    billing_period: 'per_28d',
    is_pax_priced: true,
    pax_floor: 100,
    pax_floor_price_php: 2999,
    pax_increment_size: 50,
    pax_increment_price_php: 350,
  };
  const fields = fieldsFor(priorWithExtras, { price: '3500' });
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.next.onboarding_price_php, 1499);
  assert.equal(validated.next.billing_period, 'per_28d');
  assert.equal(validated.next.is_pax_priced, true);
  assert.equal(validated.next.pax_floor, 100);
  assert.equal(validated.next.pax_floor_price_php, 2999);
  assert.equal(validated.next.pax_increment_size, 50);
  assert.equal(validated.next.pax_increment_price_php, 350);
  // And the description — the field this whole file exists to protect —
  // survives alongside them.
  assert.equal(validated.next.description, PRIOR.description);
});

test('a bad per-head config is refused in plain English, not with a raw DB error', () => {
  const fields = fieldsFor(PRIOR, { isPaxPriced: true });
  // paxFloor etc. deliberately left blank.
  const validated = validateRetailRowFields(fields);
  assert.equal(validated.ok, false);
  if (validated.ok) return;
  assert.match(validated.message, /per-head pricing needs/i);
});

// ═══════════════════════════════════════════════════════════════════════════
// THE SIGN-UP PRICE ANSWERS TO THE REGULAR PRICE (owner ruled 2026-08-29)
//
// Until this shipped, the ONLY rule on this field was "blank, or ₱0 or more".
// The family-wide discount box could never write a bad sign-up price — it takes
// a percentage and range-checks it — so this card was the one writer with no
// opinion about the number it stored. Both cases below SAVED before.
// ═══════════════════════════════════════════════════════════════════════════

test('a sign-up price ABOVE the regular price is refused', () => {
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { price: '2999', onboardingPrice: '3500' }),
  );

  assert.equal(validated.ok, false, 'charging more during set-up must not save');
  if (validated.ok) return;
  assert.match(
    validated.message,
    /can't be more than the regular price/,
    'the refusal must name the rule, not print a database error',
  );
});

test('the nonsense rule is NOT family-scoped — it holds for a row in neither family', () => {
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { serviceCode: 'LIVE_STUDIO', price: '2500', onboardingPrice: '2600' }),
  );

  assert.equal(
    validated.ok,
    false,
    'a sign-up price above the regular price is wrong for ANY product that has one',
  );
});

test('a Papic sign-up price under the floor is refused, and the message says what would clear it', () => {
  // ₱2,900 off ₱2,999 is 3.3% — a real discount, and under the 10% floor.
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { price: '2999', onboardingPrice: '2900' }),
  );

  assert.equal(validated.ok, false, 'below the Papic floor must not save');
  if (validated.ok) return;
  assert.match(validated.message, /at least 10% off/, 'the floor must be named');
  assert.match(
    validated.message,
    /2,699/,
    'the refusal must name a price that WOULD clear the floor, not just say no',
  );
});

test('the Papic floor is family-scoped — Setnayan AI sets its own discount freely', () => {
  // The same 3.3% discount, on an AI row. The owner scoped the floor to Papic.
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { serviceCode: 'SETNAYAN_AI', price: '2999', onboardingPrice: '2900' }),
  );

  assert.equal(validated.ok, true, 'no floor applies outside Papic');
});

test('a sign-up price exactly ON the floor saves — a rounding tail must not refuse it', () => {
  // 10% off ₱2,999 is ₱2,699.10; the ladder stores whole pesos, so ₱2,699 is
  // 10.003% off and ₱2,700 is 9.97%. The nearer side of the tie must still save.
  const at = validateRetailRowFields(fieldsFor(PRIOR, { price: '2999', onboardingPrice: '2699' }));
  assert.equal(at.ok, true, 'a whole-peso price landing on the floor must save');

  const justUnder = validateRetailRowFields(
    fieldsFor(PRIOR, { price: '2999', onboardingPrice: '2700' }),
  );
  assert.equal(justUnder.ok, false, '9.97% is under the floor and must not save');
});

test('a free row is never judged against a floor it cannot have', () => {
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { price: '0', onboardingPrice: '0' }),
  );

  assert.equal(validated.ok, true, 'a ₱0 product with a ₱0 sign-up price is legal');
});

test('a blank sign-up price is still legal — most rows have none', () => {
  const validated = validateRetailRowFields(
    fieldsFor(PRIOR, { price: '2999', onboardingPrice: '' }),
  );

  assert.equal(validated.ok, true, 'the field is optional and must stay optional');
  if (!validated.ok) return;
  assert.equal(validated.next.onboarding_price_php, null, 'blank means no sign-up price');
});
