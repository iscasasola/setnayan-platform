/**
 * A YEAR IS TEN 4-WEEK CYCLES — owner 2026-11-04, DECISION_LOG "EVERY 4-WEEK PURCHASE HAS A YEARLY PRICE = 10× THE
 * 4-WEEK PRICE". Every supplier item sold every 4 weeks has a yearly sibling at EXACTLY 10× its 4-week price.
 *
 * Pairs are found by name in `vendor_billing_catalog`, on the replayed migrations (so a reprice in a migration moves
 * the data and this test together):
 *   · `<x>_monthly` ↔ `<x>_annual`   (the plans: solo · pro · enterprise)
 *   · `<x>`         ↔ `<x>_annual`   (storage · seat · branch · extra category · +2 service cards · and the Ultra
 *                                      add-ons of 2026-11-06: extra service card · extra wait list · extra booking per date)
 * Active or dark, a pair must agree — a dark row is the price the owner already set for the day it goes on sale.
 *
 * ⚠ `all_tools_unlock_annual` is a LEGACY v1 bundle with no 4-week sibling; it is not a pair and is not matched.
 * The Custom plan prices its year in code (final28 × 10.4, lib/vendor-custom-pricing.ts) — not a catalogue pair, and
 * an open owner question in the 2026-11-04 price PR.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/** The 4-week items the owner named; each MUST have its yearly sibling. */
const MUST_HAVE_A_YEAR = [
  'solo_vendor_monthly',
  'pro_vendor_monthly',
  'enterprise_vendor_monthly',
  'vendor_storage_5gb',
  'vendor_storage_10gb',
  'vendor_storage_15gb',
  'vendor_extra_seat',
  'vendor_additional_branch',
  'vendor_extra_category',
  'vendor_service_cards_2',
  // Ultra add-ons, owner 2026-11-06 ("ULTRA ADD-ON PRICES") — migration 20271316466285.
  'vendor_extra_service_card',
  'vendor_extra_waitlist',
  'vendor_extra_booking_per_date',
];

const yearOf = (sku: string) => (sku.endsWith('_monthly') ? sku.replace(/_monthly$/, '_annual') : `${sku}_annual`);

test('every yearly price is exactly 10× its 4-week price', async () => {
  const r = await db.query<{ sku_code: string; price_php: string }>(
    `SELECT sku_code, price_php FROM public.vendor_billing_catalog`,
  );
  const price = new Map(r.rows.map((x) => [x.sku_code, Number(x.price_php)]));

  const missing = MUST_HAVE_A_YEAR.filter((s) => !price.has(s) || !price.has(yearOf(s)));
  assert.deepEqual(missing, [], 'a 4-week item the owner named has no row or no yearly sibling');

  const wrong: string[] = [];
  let pairs = 0;
  for (const [sku, php] of price) {
    if (sku.endsWith('_annual')) continue;
    const year = price.get(yearOf(sku));
    if (year === undefined) continue;
    pairs += 1;
    // Whole centavos, so a float can never pass a ₱0.01 drift.
    if (Math.round(year * 100) !== Math.round(php * 100) * 10) {
      wrong.push(`${sku} ₱${php} → ${yearOf(sku)} ₱${year} (want ₱${php * 10})`);
    }
  }
  assert.deepEqual(wrong, [], 'a yearly price is not 10× its 4-week price');
  assert.ok(pairs >= MUST_HAVE_A_YEAR.length, `checked ${pairs} pairs`);
});

