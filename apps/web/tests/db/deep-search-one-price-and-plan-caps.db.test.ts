/**
 * 🔎💳 DEEP SEARCH = ₱499, ONE USE, EVERY PLAN · 🗂 THE PLAN ROWS' CAPS FOLLOW TIER_CAPS
 * (migration 20271335272180_deep_search_one_price_and_plan_caps.sql; DECISION_LOG rows dated 2026-11-09, 🔎💳 and 💳⬢).
 *
 * Runs on the PGlite replay of every migration, so it reads the rows the pipeline will leave in production:
 *   1 · one Deep Search row on sale, and it is the row the app charges from on EVERY plan;
 *   2 · the ₱799 entry row is RETIRED — never deleted — and points at it;
 *   3 · the AI chatbot keeps BOTH its prices (owner: "AI chatbot keeps ₱1,490 … and ₱1,990");
 *   4 · every plan row's max_categories / max_sub_seats equals TIER_CAPS — read from the code, never typed here, so
 *       the next allowance change cannot leave the catalogue behind silently.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { TIER_CAPS } from '../../lib/vendor-tier-caps';
import { VENDOR_ADDON_BAND_SKU_CODES, vendorAddonSkuCode } from '../../lib/vendor-addon-tier-pricing';
import { VENDOR_DEEP_SEARCH_SKU_CODE } from '../../lib/vendor-deep-search-addon';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

type Row = {
  sku_code: string;
  price_php: string;
  is_active: boolean;
  retired_at: string | null;
  retirement_reason: string | null;
  replaced_by_sku_code: string | null;
  max_categories: number | null;
  max_sub_seats: number | null;
};
async function row(sku: string): Promise<Row | undefined> {
  const r = await db.query<Row>(
    `SELECT sku_code, price_php::text, is_active, retired_at::text, retirement_reason, replaced_by_sku_code,
            max_categories, max_sub_seats
       FROM public.vendor_billing_catalog WHERE sku_code = $1`,
    [sku],
  );
  return r.rows[0];
}

test('1 · ONE Deep Search row, on sale at ₱499.00, charged on every plan', async () => {
  const r = await row(VENDOR_DEEP_SEARCH_SKU_CODE);
  assert.ok(r, 'the vendor_deep_search row is missing');
  assert.equal(Number(r.price_php), 499);
  assert.equal(r.is_active, true);
  assert.equal(r.retired_at, null);
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise']) {
    assert.equal(vendorAddonSkuCode('deep_search_about_you', tier), VENDOR_DEEP_SEARCH_SKU_CODE, tier);
  }
});

test('2 · the ₱799 entry row is RETIRED into it — never deleted', async () => {
  const r = await row('vendor_deep_search_entry');
  assert.ok(r, 'the entry row was deleted — retire it, never delete it');
  assert.equal(r.is_active, false);
  assert.notEqual(r.retired_at, null);
  assert.equal(r.replaced_by_sku_code, VENDOR_DEEP_SEARCH_SKU_CODE);
  assert.match(r.retirement_reason ?? '', /2026-11-09/);
  assert.equal(Number(r.price_php), 799, 'the retired row keeps the price it was sold at');
});

test('3 · the AI chatbot keeps BOTH its prices, both on sale', async () => {
  const band = VENDOR_ADDON_BAND_SKU_CODES.ai_chatbot_basic;
  const growth = await row(band.growth);
  const entry = await row(band.entry);
  assert.ok(growth && entry);
  assert.deepEqual([Number(growth.price_php), growth.is_active], [1490, true]);
  assert.deepEqual([Number(entry.price_php), entry.is_active], [1990, true]);
});

test('4 · every plan row carries TIER_CAPS — categories and team seats', async () => {
  const plans = [
    ['solo', ['solo_vendor_monthly', 'solo_vendor_annual']],
    ['pro', ['pro_vendor_monthly', 'pro_vendor_annual']],
    ['enterprise', ['enterprise_vendor_monthly', 'enterprise_vendor_annual']],
  ] as const;
  for (const [tier, skus] of plans) {
    for (const sku of skus) {
      const r = await row(sku);
      assert.ok(r, `${sku} is missing`);
      assert.deepEqual(
        { max_categories: r.max_categories, max_sub_seats: r.max_sub_seats },
        { max_categories: TIER_CAPS[tier].parentCategories, max_sub_seats: TIER_CAPS[tier].agentAccounts },
        `${sku} disagrees with TIER_CAPS.${tier}`,
      );
    }
  }
});
