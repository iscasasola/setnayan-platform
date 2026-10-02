/**
 * A SAVE KEEPS A PRODUCT ON SALE — and the repair puts back exactly the two it
 * took off.
 *
 * The /admin/pricing row card has no on-sale checkbox, but the three save
 * actions read one anyway: absent, so FALSE, so every "Save this price" wrote
 * `is_active = false`. LIVE_STUDIO and LIVE_STUDIO_HOSTED_CHANNEL went off sale
 * at the exact second they were renamed to "Live Watch" (2026-09-30 19:01 UTC).
 *
 * This file proves, against the real replayed schema (triggers included):
 *   1. the UPDATE a save now builds — from `validateRetailRowFields`' own
 *      output, for a title change AND a price change — leaves is_active alone;
 *   2. migration `a_save_took_live_watch_off_sale` restores EXACTLY the two
 *      listed rows and nothing else, even when every other catalogue row in all
 *      three tables carries the same off-sale signature;
 *   3. a row that was retired PROPERLY (retired_at stamped) is never restored.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { validateRetailRowFields, type RawRetailRowFields } from '../../lib/admin/pricing-row-diff';

const RESTORED = ['LIVE_STUDIO', 'LIVE_STUDIO_HOSTED_CHANNEL'] as const;

const MIGRATION_FILE = (() => {
  const hits = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('_a_save_took_live_watch_off_sale.sql'));
  assert.equal(hits.length, 1, 'the repair migration must exist exactly once');
  return join(MIGRATIONS_DIR, hits[0]!);
})();
const MIGRATION_SQL = readFileSync(MIGRATION_FILE, 'utf8');

const TABLES = [
  { table: 'platform_retail_catalog_v2', key: 'service_code' },
  { table: 'platform_package_catalog', key: 'package_code' },
  { table: 'vendor_billing_catalog', key: 'sku_code' },
] as const;

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

type RetailRow = {
  service_code: string;
  title: string;
  description: string | null;
  retail_price_php: string | number;
  saas_overhead_cost_php: string | number;
  is_active: boolean;
  onboarding_price_php: string | number | null;
  billing_period: string;
  is_pax_priced: boolean;
  pax_floor: number | null;
  pax_floor_price_php: string | number | null;
  pax_increment_size: number | null;
  pax_increment_price_php: string | number | null;
};

async function readRetail(code: string): Promise<RetailRow> {
  const r = await db.query<RetailRow>(
    `select service_code, title, description, retail_price_php, saas_overhead_cost_php, is_active,
            onboarding_price_php, billing_period, is_pax_priced, pax_floor, pax_floor_price_php,
            pax_increment_size, pax_increment_price_php
       from public.platform_retail_catalog_v2 where service_code = $1`,
    [code],
  );
  assert.equal(r.rows.length, 1, `${code} must exist in the replay`);
  return r.rows[0]!;
}

/** Exactly what the row card POSTs when the admin touched nothing. */
function untouchedFields(row: RetailRow): RawRetailRowFields {
  const s = (v: unknown) => (v == null ? '' : String(Number(v)));
  return {
    serviceCode: row.service_code,
    title: row.title,
    desc: row.description ?? '',
    price: String(Number(row.retail_price_php)),
    cost: String(Number(row.saas_overhead_cost_php)),
    onboardingPrice: s(row.onboarding_price_php),
    billingPeriod: row.billing_period,
    isPaxPriced: row.is_pax_priced,
    paxFloor: row.pax_floor == null ? '' : String(row.pax_floor),
    paxFloorPrice: s(row.pax_floor_price_php),
    paxIncrementSize: row.pax_increment_size == null ? '' : String(row.pax_increment_size),
    paxIncrementPrice: s(row.pax_increment_price_php),
  };
}

/** Runs the same `.update({...nextRow})` saveRetailRow sends, as SQL. */
async function applySave(code: string, overrides: Partial<RawRetailRowFields>): Promise<void> {
  const row = await readRetail(code);
  const v = validateRetailRowFields({ ...untouchedFields(row), ...overrides });
  assert.equal(v.ok, true, `the save must validate: ${v.ok ? '' : v.message}`);
  if (!v.ok) return;
  const cols = Object.keys(v.next);
  assert.ok(!cols.includes('is_active'), 'a save must not carry is_active at all');
  const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
  await db.query(
    `update public.platform_retail_catalog_v2 set ${sets} where service_code = $1`,
    [code, ...cols.map((c) => (v.next as unknown as Record<string, unknown>)[c])],
  );
}

test('saving a title change keeps a product on sale', async () => {
  await db.query(`update public.platform_retail_catalog_v2 set is_active = true where service_code = 'LIVE_STUDIO'`);
  await applySave('LIVE_STUDIO', { title: 'Live Watch (renamed by the test)' });
  const saved = await readRetail('LIVE_STUDIO');
  assert.equal(saved.title, 'Live Watch (renamed by the test)', 'the rename must land');
  assert.equal(saved.is_active, true, 'REGRESSION: a rename took the product off sale');
});

test('saving a price change keeps a product on sale', async () => {
  await db.query(
    `update public.platform_retail_catalog_v2 set is_active = true where service_code = 'LIVE_STUDIO_HOSTED_CHANNEL'`,
  );
  const prior = await readRetail('LIVE_STUDIO_HOSTED_CHANNEL');
  const newPrice = String(Number(prior.retail_price_php) + 1);
  await applySave('LIVE_STUDIO_HOSTED_CHANNEL', { price: newPrice });
  const saved = await readRetail('LIVE_STUDIO_HOSTED_CHANNEL');
  assert.equal(Number(saved.retail_price_php), Number(newPrice), 'the price change must land');
  assert.equal(saved.is_active, true, 'REGRESSION: a price change took the product off sale');
});

test('a save never puts a draft row ON sale either', async () => {
  await db.query(`update public.platform_retail_catalog_v2 set is_active = false where service_code = 'LIVE_STUDIO'`);
  await applySave('LIVE_STUDIO', { title: 'Live Watch (draft rename)' });
  assert.equal((await readRetail('LIVE_STUDIO')).is_active, false, 'on-sale state moves only via retire / put back');
});

test('the repair restores exactly the two listed rows and nothing else', async () => {
  // Every row in all three catalogues gets the bug's signature: off sale,
  // never retired, touched just now. The repair must pick out only the two.
  for (const { table } of TABLES) {
    await db.query(`update public.${table} set is_active = false, retired_at = null, updated_at = now()`);
  }

  await db.exec(MIGRATION_SQL);

  for (const { table, key } of TABLES) {
    const on = await db.query<{ code: string }>(
      `select ${key} as code from public.${table} where is_active order by 1`,
    );
    const expected = table === 'platform_retail_catalog_v2' ? [...RESTORED].sort() : [];
    assert.deepEqual(
      on.rows.map((r) => r.code),
      expected,
      `${table}: the repair must put back on sale exactly ${expected.join(', ') || 'nothing'}`,
    );
  }
});

test('a row retired properly is never put back on sale', async () => {
  await db.query(
    `update public.platform_retail_catalog_v2
        set is_active = false, retired_at = now(), updated_at = now()
      where service_code = 'LIVE_STUDIO'`,
  );
  await db.query(
    `update public.platform_retail_catalog_v2
        set is_active = false, retired_at = null, updated_at = now()
      where service_code = 'LIVE_STUDIO_HOSTED_CHANNEL'`,
  );

  await db.exec(MIGRATION_SQL);

  assert.equal((await readRetail('LIVE_STUDIO')).is_active, false, 'a stamped retire must stand');
  assert.equal((await readRetail('LIVE_STUDIO_HOSTED_CHANNEL')).is_active, true, 'the unstamped one is restored');
});
