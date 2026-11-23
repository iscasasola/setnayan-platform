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
 * (The Custom plan, which priced its year in code, was retired from the app 2026-11-06.)
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

/*
 * ⛔ SUPERSEDED 2026-11-22. The 4 Nov "a year = 10× the 4-week price" rule ended with the owner's *"no yearly for any
 * supplier subscription. remove the annual subscription everywhere"* (DECISION_LOG "NO YEARLY SUPPLIER/COORDINATOR
 * PLAN ANYWHERE"; migration 20271360321657). A retired yearly row is history at the price it last sold for — it is no
 * longer required to track its 4-week sibling, whose price moved (owner "SUPPLIER PLAN PRICES, FINAL").
 */
test('no yearly supplier item is on sale — a yearly sibling is retired history, never a price', async () => {
  const r = await db.query<{ sku_code: string; is_active: boolean; retired_at: string | null }>(
    `SELECT sku_code, is_active, retired_at FROM public.vendor_billing_catalog`,
  );
  const row = new Map(r.rows.map((x) => [x.sku_code, x]));
  const onSale = MUST_HAVE_A_YEAR.map(yearOf).filter((y) => row.get(y)?.is_active === true);
  assert.deepEqual(onSale, [], 'a yearly supplier row is on sale again');
  for (const plan of ['solo_vendor_annual', 'pro_vendor_annual', 'enterprise_vendor_annual']) {
    const y = row.get(plan);
    assert.ok(y, `${plan} was deleted — a retired row is kept, never deleted`);
    assert.ok(y.retired_at, `${plan} is off sale without a retired_at`);
  }
});

