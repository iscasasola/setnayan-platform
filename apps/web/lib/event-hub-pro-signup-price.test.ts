/**
 * event-hub-pro-signup-price.test.ts — ₱5,000 regular, ₱3,000 at sign-up, and
 * NOTHING ELSE MOVES.
 *
 * ⚖ Owner, 2026-09-25: *"make it 5000 with 40% off becoming 3000 on
 * onboarding."* Same day, same 40%, carried forward from the ₱3,500 / ₱2,100
 * pair this file pinned a few hours earlier onto the new ₱5,000 / ₱3,000 pair.
 *
 * 🔑 THE DISCOUNT WAS ALREADY PER-SKU. `onboarding_price_php` is each row's own
 * sign-up price (Setnayan AI's since migration 20271139128584; the Papic rungs
 * and AI bands derive theirs from a FAMILY percentage on save). `setupPricePhp`
 * charges the cheaper of that row price and the house percentage. So Pro gets
 * its 40% by carrying its own ₱3,000 — no new mechanism, no global figure moved.
 *
 * This file is the one place the live figures are written on purpose: it pins
 * the migration that sets them. Everything that RENDERS the price reads the row
 * (`event-hub-pro-price-is-never-typed.test.ts` fails if one ever types it).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { setupPricePhp, DEFAULT_ONBOARDING_DISCOUNT_PCT } from './onboarding-discount';
import { FAMILY_DISCOUNT_DEFAULT_PCT, familyForServiceCode } from './onboarding-family-discount';

const MIGRATIONS = join(process.cwd(), '../../supabase/migrations');
const migration = readdirSync(MIGRATIONS).find((f) =>
  f.endsWith('_event_hub_pro_is_5000_and_3000_at_sign_up.sql'),
);

test('the sign-up rule charges Pro its own ₱3,000, not the house percentage', () => {
  // The house rule today (10%) would make it ₱4,500; the row's own price wins.
  assert.equal(setupPricePhp(5000, 3000, DEFAULT_ONBOARDING_DISCOUNT_PCT), 3000);
  // …and the saving the card states is the difference, 40% of regular.
  assert.equal(5000 - setupPricePhp(5000, 3000, DEFAULT_ONBOARDING_DISCOUNT_PCT), 2000);
  assert.equal(2000 / 5000, 0.4);
});

test('Papic and Setnayan AI keep their own numbers — the rule did not change', () => {
  // A Papic rung with no override still follows the house percentage…
  assert.equal(setupPricePhp(1000, null, DEFAULT_ONBOARDING_DISCOUNT_PCT), 900);
  // …the planner's own deeper row price still wins over it…
  assert.equal(setupPricePhp(2499, 1499, DEFAULT_ONBOARDING_DISCOUNT_PCT), 1499);
  // …and the two family defaults are the owner's, untouched by this change.
  assert.deepEqual({ ...FAMILY_DISCOUNT_DEFAULT_PCT }, { papic: 10, ai: 40 });
  // Pro is in NEITHER family, so a family-wide save can never re-derive its
  // ₱2,100 from somebody else's percentage.
  assert.equal(familyForServiceCode('COUPLE_WEBSITE_PRO'), null);
});

test('the migration moves ONE row and no setting', () => {
  assert.ok(migration, 'the Event Hub Pro price migration is missing');
  const sql = readFileSync(join(MIGRATIONS, migration!), 'utf8').replace(/--.*$/gm, '');
  assert.match(sql, /SET\s+retail_price_php\s+=\s+5000,\s+onboarding_price_php\s+=\s+3000/);
  const updates = sql.match(/UPDATE\s+public\.[a-z_0-9]+/gi) ?? [];
  assert.deepEqual(updates, ['UPDATE public.platform_retail_catalog_v2']);
  assert.match(sql, /WHERE\s+service_code = 'COUPLE_WEBSITE_PRO'/);
  assert.doesNotMatch(sql, /platform_settings/, 'no discount percentage is touched');
});
