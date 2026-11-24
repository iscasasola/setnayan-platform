/**
 * 🔎 DEEP SEARCH IS INCLUDED MONTHLY, NEVER SOLD (migration *_deep_search_sale_retired_monthly_allowance.sql;
 * DECISION_LOG 2026-11-22 ✂️ "DEEP SEARCH IS RETIRED" — *"Retire it"* — and 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH" —
 * *"Deep Search 1 a month"*).
 *
 * Runs on the PGlite replay of every migration, so it reads what the pipeline leaves in production:
 *   1 · the per-search row is off sale with its reason, and kept;
 *   2 · the allowance is an admin setting on the one platform_settings row, seeded to the owner's 1, ranged 1–31;
 *   3 · a month's included run is ONE row per (shop, month, slot) — a second claim of the same slot is refused by the
 *       database (the atomic claim `claimIncludedDeepSearchRun` relies on it), the next slot is free, a new month starts
 *       again at slot 1, and history rows (no slot) never collide;
 *   4 · the retired one-per-28-day index is gone.
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-24): the month/slot index made non-unique in the migration (red: 3).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
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

async function makeVendor(email: string): Promise<string> {
  await db.exec(`RESET ROLE`).catch(() => {});
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    // A vendor sign-up already makes the shop row (the auth trigger) — take it, as the other replay tests do.
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Deep Search Test Shop')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return vp.rows[0]!.vendor_profile_id;
}

async function claim(vid: string, month: string, slot: number | null, wasFree = true): Promise<string | null> {
  try {
    await db.query(
      `INSERT INTO public.vendor_deep_search_uses (vendor_profile_id, was_free, free_cycle_start, allowance_slot)
       VALUES ($1, $2, $3, $4)`,
      [vid, wasFree, month, slot],
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

test('1 · the per-search sale is off — kept, with the owner’s reason', async () => {
  const r = await db.query<{ is_active: boolean; retired_at: string | null; retirement_reason: string | null }>(
    `SELECT is_active, retired_at::text, retirement_reason FROM public.vendor_billing_catalog WHERE sku_code = $1`,
    [VENDOR_DEEP_SEARCH_SKU_CODE],
  );
  assert.equal(r.rows.length, 1, 'the retired row was deleted — retire it, never delete it');
  assert.equal(r.rows[0]!.is_active, false, 'Deep Search is sold per search again');
  assert.notEqual(r.rows[0]!.retired_at, null);
  assert.match(r.rows[0]!.retirement_reason ?? '', /"Retire it"/);
  assert.match(r.rows[0]!.retirement_reason ?? '', /Deep Search 1 a month/);
});

test('2 · the allowance is the admin’s setting, seeded to the owner’s 1, ranged 1–31', async () => {
  const r = await db.query<{ n: number | null }>(`SELECT deep_search_runs_per_month AS n FROM public.platform_settings WHERE id = 1`);
  assert.equal(r.rows[0]?.n, 1, 'the owner’s "Deep Search 1 a month" is not the seeded allowance');
  for (const bad of [0, 32]) {
    const e = await db.query(`UPDATE public.platform_settings SET deep_search_runs_per_month = $1 WHERE id = 1`, [bad]).then(
      () => null,
      (err: unknown) => (err instanceof Error ? err.message : String(err)),
    );
    assert.match(e ?? 'accepted', /platform_settings_deep_search_runs_per_month_range/, `${bad} runs a month was accepted`);
  }
  await db.query(`UPDATE public.platform_settings SET deep_search_runs_per_month = NULL WHERE id = 1`);
  await db.query(`UPDATE public.platform_settings SET deep_search_runs_per_month = 1 WHERE id = 1`);
});

test('3 · one row per (shop, month, slot): the same slot twice is refused; the next slot and a new month are not', async () => {
  const vid = await makeVendor('deep-search-monthly@test.local');
  const nov = '2026-11-03T04:00:00.000Z';
  const dec = '2026-12-03T04:00:00.000Z';
  assert.equal(await claim(vid, nov, 1), null, 'the month’s first run could not be claimed');
  assert.match(await claim(vid, nov, 1) ?? 'accepted', /vendor_deep_search_uses_month_slot_uidx|duplicate key/, 'the same run was claimed twice');
  assert.equal(await claim(vid, nov, 2), null, 'a second included run (allowance 2+) could not be claimed');
  assert.equal(await claim(vid, dec, 1), null, 'a new paid month did not start again at its first run');
  // History rows — the retired 28-day free search and paid orders — carry no slot and never collide.
  assert.equal(await claim(vid, nov, null), null);
  assert.equal(await claim(vid, nov, null), null);
  assert.equal(await claim(vid, nov, 1, false), null, 'a paid-order row was held to the included runs’ index');
  assert.match(await claim(vid, nov, 40) ?? 'accepted', /vendor_deep_search_uses_allowance_slot_range/, 'slot 40 was accepted');
});

test('4 · the retired one-free-per-28-days index is gone', async () => {
  const r = await db.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'vendor_deep_search_uses'`,
  );
  const names = r.rows.map((x) => x.indexname);
  assert.ok(names.includes('vendor_deep_search_uses_month_slot_uidx'), 'the month/slot index is missing');
  assert.ok(!names.includes('vendor_deep_search_uses_free_cycle_uidx'), 'the retired 28-day index is back');
});
