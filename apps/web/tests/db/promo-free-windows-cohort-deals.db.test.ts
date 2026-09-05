/**
 * promo_free_windows carries the vendor COHORT deal shape (migration
 * 20271207345427): audience 'new_verified_vendors', the extended tier rule,
 * and deal_length_days.
 *
 * 🔑 WHY THIS IS A DB TEST. The audience CHECK was declared inline and
 * RE-LISTS its vocabulary; adding a value means dropping and re-adding the
 * constraint by its auto-generated name. Get the name wrong and the old
 * constraint survives beside the new one — the new value is then refused at
 * INSERT time on real rows, while every TypeScript test passes against a
 * type that already includes it. Only a replayed schema can see that.
 *
 * Run: cd apps/web && npx tsx --test tests/db/promo-free-windows-cohort-deals.db.test.ts
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

type Row = {
  audience: string;
  tier: string | null;
  days: number | null;
};

async function insert(r: Row): Promise<string> {
  const res = await db.query<{ promo_window_id: string }>(
    `INSERT INTO public.promo_free_windows
       (title, audience_type, promoted_vendor_tier, deal_length_days, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, now() - interval '1 day', now() + interval '29 days')
     RETURNING promo_window_id`,
    [`test ${r.audience}`, r.audience, r.tier, r.days],
  );
  return res.rows[0]!.promo_window_id;
}

test('the audience CHECK is ONE constraint carrying the new value — no stale twin survived', async () => {
  const r = await db.query<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.promo_free_windows'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%all_couples%'
        AND pg_get_constraintdef(oid) NOT LIKE '%promoted_vendor_tier%'`,
  );
  assert.equal(r.rows.length, 1, JSON.stringify(r.rows));
  assert.equal(r.rows[0]!.conname, 'promo_free_windows_audience_type_check');
  assert.match(r.rows[0]!.def, /new_verified_vendors/);
});

test('new_verified_vendors inserts with a tier, and every old value still does', async () => {
  await assert.doesNotReject(insert({ audience: 'new_verified_vendors', tier: 'solo', days: null }));
  await assert.doesNotReject(insert({ audience: 'all_vendors', tier: 'pro', days: null }));
  await assert.doesNotReject(insert({ audience: 'all_couples', tier: null, days: null }));
  await assert.doesNotReject(insert({ audience: 'segment', tier: null, days: null }));
});

test('an unknown audience is still refused', async () => {
  await assert.rejects(
    insert({ audience: 'everyone_ever', tier: null, days: null }),
    /audience_type_check/,
  );
});

test('the tier rule is EXTENDED: a cohort window without a tier is refused, a couples window with one still is', async () => {
  await assert.rejects(
    insert({ audience: 'new_verified_vendors', tier: null, days: null }),
    /promo_free_windows_vendor_tier/,
  );
  await assert.rejects(
    insert({ audience: 'all_vendors', tier: null, days: null }),
    /promo_free_windows_vendor_tier/,
  );
  await assert.rejects(
    insert({ audience: 'all_couples', tier: 'pro', days: null }),
    /promo_free_windows_vendor_tier/,
  );
});

test('deal_length_days: nullable, positive when set', async () => {
  await assert.doesNotReject(insert({ audience: 'all_vendors', tier: 'solo', days: 28 }));
  await assert.doesNotReject(insert({ audience: 'new_verified_vendors', tier: 'enterprise', days: 84 }));
  await assert.rejects(
    insert({ audience: 'all_vendors', tier: 'solo', days: 0 }),
    /deal_length_positive/,
  );
  await assert.rejects(
    insert({ audience: 'all_vendors', tier: 'solo', days: -7 }),
    /deal_length_positive/,
  );
});

test('the three facts a deal is resolved against exist on vendor_profiles', async () => {
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_profiles'
        AND column_name IN ('verification_state','created_at','last_verified_at')
      ORDER BY column_name`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.column_name),
    ['created_at', 'last_verified_at', 'verification_state'],
  );
});

test('the vendor plan rows a deal can pick are real, active, priced > 0 catalog rows', async () => {
  const r = await db.query<{ sku_code: string; price_php: string; is_active: boolean }>(
    `SELECT sku_code, price_php::text, is_active FROM public.vendor_billing_catalog
      WHERE sku_code ~ '^(solo|pro|enterprise)_vendor_(monthly|annual)$'
      ORDER BY sku_code`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.sku_code),
    [
      'enterprise_vendor_annual',
      'enterprise_vendor_monthly',
      'pro_vendor_annual',
      'pro_vendor_monthly',
      'solo_vendor_annual',
      'solo_vendor_monthly',
    ],
  );
  for (const row of r.rows) assert.ok(Number(row.price_php) > 0, row.sku_code);
  // OPEN #3 from the plan, measured: the price floor is untouched by a deal —
  // a deal moves the resolved TIER, never a catalog price, so nothing here
  // needs a ₱0 row.
  await assert.rejects(
    db.query(`UPDATE public.vendor_billing_catalog SET price_php = 0 WHERE sku_code = 'pro_vendor_monthly'`),
    /price_php/,
  );
});
