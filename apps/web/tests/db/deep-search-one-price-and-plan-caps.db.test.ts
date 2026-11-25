/**
 * 🔎💳 DEEP SEARCH = ₱499, ONE USE, EVERY PLAN · 🗂 THE PLAN ROWS' CAPS FOLLOW TIER_CAPS
 * (migration 20271335272180_deep_search_one_price_and_plan_caps.sql; DECISION_LOG rows dated 2026-11-09, 🔎💳 and 💳⬢).
 *
 * Runs on the PGlite replay of every migration, so it reads the rows the pipeline will leave in production:
 *   1 · the one Deep Search row — since 2026-11-22 RETIRED (no longer sold; the paid plans include it monthly);
 *   2 · the ₱799 entry row is RETIRED — never deleted — and points at it;
 *   3 · the AI chatbot keeps BOTH its price rows (owner: "AI chatbot keeps ₱1,490 … and ₱1,990") — off sale since
 *       2026-11-14 ("SIMPLER SUPPLIER PLANS": folded into Pro and Ultra);
 *   4 · every plan row's max_categories / max_sub_seats equals TIER_CAPS — read from the code, never typed here, so
 *       the next allowance change cannot leave the catalogue behind silently.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { TIER_CAPS } from '../../lib/vendor-tier-caps';
import { VENDOR_ADDON_BAND_SKU_CODES } from '../../lib/vendor-addon-tier-pricing';
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

test('1 · the Deep Search row is RETIRED (owner 2026-11-22, "Retire it") — kept, never deleted, never sold', async () => {
  // ⚖ Superseded 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED"): the ₱499 sale ends; the paid plans include
  // Deep Search monthly (migration *_deep_search_sale_retired_monthly_allowance.sql — pinned in
  // deep-search-is-included-monthly.db.test.ts). The row stays: orders already paid still name it.
  const r = await row(VENDOR_DEEP_SEARCH_SKU_CODE);
  assert.ok(r, 'the vendor_deep_search row was deleted — retire it, never delete it');
  assert.equal(r.is_active, false, 'Deep Search is on sale again');
  assert.notEqual(r.retired_at, null);
  assert.match(r.retirement_reason ?? '', /Retire it/);
  assert.equal(Number(r.price_php), 499, 'the retired row keeps the price it was sold at');
  assert.equal('deep_search_about_you' in VENDOR_ADDON_BAND_SKU_CODES, false, 'the app prices Deep Search again');
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

test('3 · the AI chatbot keeps BOTH its price rows — off sale since it folded into Pro and Ultra (2026-11-14)', async () => {
  // Owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS" item 3: Pro includes the chatbot, Ultra the smarter level,
  // Plus cannot buy it. The rows stay (every order names them; a bought window runs to its end) — retired by flag.
  const band = VENDOR_ADDON_BAND_SKU_CODES.ai_chatbot_basic;
  const growth = await row(band.growth);
  const entry = await row(band.entry);
  assert.ok(growth && entry, 'a retired chatbot row was deleted');
  assert.deepEqual([Number(growth.price_php), growth.is_active], [1490, false]);
  assert.deepEqual([Number(entry.price_php), entry.is_active], [1990, false]);
});

const fin = (v: number): number | null => (Number.isFinite(v) ? v : null);

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
        // NULL = no limit, as TIER_CAPS' Infinity (every paid size's categories; Pro and Ultra seats — 2026-11-22).
        { max_categories: fin(TIER_CAPS[tier].parentCategories), max_sub_seats: fin(TIER_CAPS[tier].agentAccounts) },
        `${sku} disagrees with TIER_CAPS.${tier}`,
      );
    }
  }
});
