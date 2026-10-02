/**
 * A SAVE NEVER CHANGES ON-SALE STATE.
 *
 * The /admin/pricing row card has no on-sale checkbox. The three save actions
 * read one anyway, got FALSE every time (an absent checkbox is not "on"), and
 * wrote `is_active = false` — so any "Save this price", even a rename, took
 * the product off sale. LIVE_STUDIO and LIVE_STUDIO_HOSTED_CHANNEL went off
 * sale at the exact second they were renamed to "Live Watch" (2026-09-30).
 *
 * On-sale state moves ONLY through Retire / Put back on sale. This file pins:
 *   1. the validated save payload, for a title change and a price change, has
 *      no is_active — so the prior value stands (on sale stays on sale, a
 *      draft stays a draft);
 *   2. none of saveRetailRow / saveBundleRow / saveVendorRow reads an
 *      on-sale value or writes the column (comments stripped, so the docblock
 *      explaining the bug cannot satisfy or trip it);
 *   3. retire + reactivate still DO write it — the guard is on the save, not
 *      on the column.
 *
 * The same property is proved against the real schema in
 * tests/db/a-save-keeps-on-sale.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { validateRetailRowFields, type RawRetailRowFields } from '@/lib/admin/pricing-row-diff';
import { changedPriceFields } from '@/lib/retail-price-change';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = stripComments(readFileSync(join(HERE, 'actions.ts'), 'utf8'));

const PRIOR = {
  title: 'Live Studio',
  description: 'Stream the day to everyone who could not come.',
  retail_price_php: 2500,
  saas_overhead_cost_php: 0,
  onboarding_price_php: null,
  billing_period: 'one_time',
  is_pax_priced: false,
  pax_floor: null,
  pax_floor_price_php: null,
  pax_increment_size: null,
  pax_increment_price_php: null,
};

function submitted(overrides: Partial<RawRetailRowFields>): RawRetailRowFields {
  return {
    serviceCode: 'LIVE_STUDIO',
    title: PRIOR.title,
    desc: PRIOR.description,
    price: String(PRIOR.retail_price_php),
    cost: String(PRIOR.saas_overhead_cost_php),
    onboardingPrice: '',
    billingPeriod: PRIOR.billing_period,
    isPaxPriced: false,
    paxFloor: '',
    paxFloorPrice: '',
    paxIncrementSize: '',
    paxIncrementPrice: '',
    ...overrides,
  };
}

/** What the row looks like after `.update(next)` lands on it. */
function afterSave(isActive: boolean, overrides: Partial<RawRetailRowFields>) {
  const v = validateRetailRowFields(submitted(overrides));
  assert.equal(v.ok, true, v.ok ? '' : v.message);
  if (!v.ok) throw new Error('unreachable');
  return { next: v.next, row: { ...PRIOR, is_active: isActive, ...v.next } };
}

test('saving a title change keeps is_active true', () => {
  const { next, row } = afterSave(true, { title: 'Live Watch' });
  assert.ok(!('is_active' in next), 'the save payload must not carry is_active');
  assert.equal(row.title, 'Live Watch');
  assert.equal(row.is_active, true, 'REGRESSION: a rename took the product off sale');
});

test('saving a price change keeps is_active true — on both the direct and the two-admin path', () => {
  const { next, row } = afterSave(true, { price: '2600' });
  assert.equal(row.retail_price_php, 2600);
  assert.equal(row.is_active, true, 'REGRESSION: a price change took the product off sale');

  // The two-admin path writes "everything except the price" right away.
  const copyOnly: Record<string, unknown> = { ...next };
  for (const f of changedPriceFields(PRIOR, next)) delete copyOnly[f];
  assert.ok(!('is_active' in copyOnly), 'the copy-now write must not carry is_active either');
});

test('a save never puts a draft row on sale either', () => {
  const { row } = afterSave(false, { title: 'Renamed draft' });
  assert.equal(row.is_active, false);
});

/** The body of one exported async function, by brace matching. */
function bodyOf(name: string): string {
  const start = ACTIONS.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found in actions.ts — the guard is blind`);
  const open = ACTIONS.indexOf('{', ACTIONS.indexOf(')', ACTIONS.indexOf('formData', start)));
  let depth = 0;
  for (let i = open; i < ACTIONS.length; i++) {
    if (ACTIONS[i] === '{') depth++;
    else if (ACTIONS[i] === '}' && --depth === 0) return ACTIONS.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

for (const name of ['saveRetailRow', 'saveBundleRow', 'saveVendorRow']) {
  test(`${name} neither reads an on-sale value nor writes is_active`, () => {
    const body = bodyOf(name);
    assert.ok(body.includes('.update('), `${name} has no update — the guard is reading the wrong body`);
    assert.doesNotMatch(body, /is_active/, `${name} must not read or write is_active — on-sale state moves only via retire / put back`);
    assert.doesNotMatch(body, /formData\.get\(\s*['"]active['"]/, `${name} reads an "active" field the row card never sends`);
  });
}

for (const name of ['retireRetailRow', 'reactivateRetailRow', 'retireBundleRow', 'reactivateBundleRow', 'retireVendorRow', 'reactivateVendorRow']) {
  test(`${name} still owns on-sale state`, () => {
    assert.match(bodyOf(name), /is_active/, `${name} is the door for on-sale state and must still write it`);
  });
}
