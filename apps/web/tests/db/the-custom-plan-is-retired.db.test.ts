/**
 * THE CUSTOM SUPPLIER PLAN IS RETIRED — AND THE DATABASE KEEPS IT THAT WAY.
 *
 * Owner, 2026-11-06 (DECISION_LOG), asked whether Custom was gone only from the For Suppliers page or from the app
 * too: *"from the app"*. Migration `20271310256381_retire_the_custom_supplier_plan.sql` is the database half; this
 * file fails the build if any part of it comes undone:
 *
 *   · no shop can be written onto 'custom' — on the plan, on a scheduled plan, or on a subscription row;
 *   · the five `vendor_custom_*` catalogue rows are off sale AND marked retired (not merely switched off — a switch
 *     is how this plan was "hidden" before, and the code warned that hiding is not retiring);
 *   · the Custom-only "no limit" axis (`vendor_pipeline_is_unlimited`) is gone, and the limit grid has no Custom arm;
 *   · the `vendor_custom_plans` table and its write guard are gone;
 *   · Ultra's own add-ons — `vendor_additional_branch`, `vendor_extra_seat` — are still on sale. Retiring Custom must
 *     never take Ultra's add-ons with it.
 *
 * Its unit twin is `lib/the-custom-plan-is-retired.test.ts` (the code half).
 *
 * Run: pnpm --filter @setnayan/web test:db
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

const RETIRED_SKUS = [
  'vendor_custom_base',
  'vendor_custom_domain',
  'vendor_custom_event_slot',
  'vendor_custom_pipeline_unlimited',
  'vendor_custom_reach_nationwide',
] as const;

async function newVendorProfile(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  return (
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Retired Custom Test', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id
  );
}

/** Run `sql` with triggers off, so a refusal can only come from the CHECK itself — and say which constraint refused. */
async function refusedBy(sql: string, params: unknown[]): Promise<string> {
  await db.query(`SET session_replication_role = replica`);
  try {
    await db.query(sql, params);
    return '';
  } catch (e) {
    return String((e as Error).message);
  } finally {
    await db.query(`SET session_replication_role = origin`);
  }
}

test('no shop can be put on the Custom plan', async () => {
  const vp = await newVendorProfile('custom-retired-1@retired.test');
  const msg = await refusedBy(
    `UPDATE public.vendor_profiles SET tier_state = 'custom' WHERE vendor_profile_id = $1`,
    [vp],
  );
  assert.match(msg, /vendor_profiles_tier_state_not_custom/, `tier_state = 'custom' was accepted: ${msg || '(no error)'}`);
});

test('no shop can be SCHEDULED onto the Custom plan', async () => {
  const vp = await newVendorProfile('custom-retired-2@retired.test');
  const msg = await refusedBy(
    `UPDATE public.vendor_profiles SET pending_tier = 'custom' WHERE vendor_profile_id = $1`,
    [vp],
  );
  assert.match(msg, /vendor_profiles_pending_tier_not_custom/, `pending_tier = 'custom' was accepted: ${msg || '(no error)'}`);
});

test('no subscription row can be for the Custom plan', async () => {
  const vp = await newVendorProfile('custom-retired-3@retired.test');
  const msg = await refusedBy(
    `INSERT INTO public.vendor_subscriptions (vendor_id, sku_code, tier) VALUES ($1, 'x', 'custom')`,
    [vp],
  );
  assert.match(msg, /vendor_subscriptions_tier_not_custom/, `a 'custom' subscription row was accepted: ${msg || '(no error)'}`);
});

test('the ordinary plans are still writable — the CHECK refuses only Custom', async () => {
  const vp = await newVendorProfile('custom-retired-4@retired.test');
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise']) {
    const msg = await refusedBy(`UPDATE public.vendor_profiles SET tier_state = $2 WHERE vendor_profile_id = $1`, [vp, tier]);
    assert.equal(msg, '', `${tier} was refused: ${msg}`);
  }
});

test('the five Custom catalogue rows are off sale AND marked retired', async () => {
  const r = await db.query<{ sku_code: string; is_active: boolean; retired_at: string | null; retirement_reason: string | null }>(
    `SELECT sku_code, is_active, retired_at, retirement_reason
       FROM public.vendor_billing_catalog WHERE sku_code = ANY($1::text[])`,
    [[...RETIRED_SKUS]],
  );
  // Anti-vacuity: every row must still EXIST (retired, never deleted — an order may name one).
  assert.deepEqual(r.rows.map((x) => x.sku_code).sort(), [...RETIRED_SKUS].sort(), 'a Custom row was deleted or never seeded');
  for (const row of r.rows) {
    assert.equal(row.is_active, false, `${row.sku_code} is still on sale`);
    assert.ok(row.retired_at, `${row.sku_code} is switched off but not marked retired`);
    assert.match(row.retirement_reason ?? '', /Custom/, `${row.sku_code} has no retirement reason`);
  }
  const live = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_billing_catalog WHERE sku_code LIKE 'vendor\\_custom\\_%' AND is_active`,
  );
  assert.equal(live.rows[0]!.n, 0, 'a vendor_custom_* row is on sale');
});

test("Ultra's add-ons stay on sale — retiring Custom must not take them", async () => {
  const r = await db.query<{ sku_code: string; is_active: boolean }>(
    `SELECT sku_code, is_active FROM public.vendor_billing_catalog
      WHERE sku_code IN ('vendor_additional_branch', 'vendor_extra_seat')`,
  );
  assert.equal(r.rows.length, 2, 'an Ultra add-on row is missing');
  for (const row of r.rows) assert.equal(row.is_active, true, `${row.sku_code} was taken off sale`);
});

test('the Custom-only "no limit" axis is gone, and no limit has a Custom arm', async () => {
  const fn = await db.query<{ p: string | null }>(`SELECT to_regprocedure('public.vendor_pipeline_is_unlimited(uuid)')::text AS p`);
  assert.equal(fn.rows[0]!.p, null, 'vendor_pipeline_is_unlimited still exists');

  // The plan table and its write guard are gone too (dropped empty — the migration refuses while it holds a row).
  const tbl = await db.query<{ t: string | null; g: string | null }>(
    `SELECT to_regclass('public.vendor_custom_plans')::text AS t,
            to_regprocedure('public.guard_vendor_custom_plans_entitlement()')::text AS g`,
  );
  assert.deepEqual([tbl.rows[0]!.t, tbl.rows[0]!.g], [null, null], 'vendor_custom_plans or its write guard still exists');

  for (const sig of [
    'public.vendor_tier_limit(text,text)',
    'public.vendor_tier_rank(public.vendor_tier_state)',
    'public.sweep_vendor_tier_expiry(uuid)',
    'public.enforce_vendor_whitelist_per_date()',
    'public.vendor_whitelist_pressure(uuid)',
    'public.clamp_vendor_waitlist_to_tier()',
  ]) {
    const d = await db.query<{ def: string }>(`SELECT pg_get_functiondef($1::regprocedure) AS def`, [sig]);
    const body = d.rows[0]!.def;
    assert.ok(body.length > 100, `${sig}: empty definition — the check would be vacuous`);
    assert.doesNotMatch(body, /'custom'|vendor_custom_plans|vendor_pipeline_is_unlimited/, `${sig} still reads the Custom plan`);
  }

  // A stray 'custom' now reads the grid's ELSE — the Free row — never Ultra's.
  const r = await db.query<{ wa: number; br: number }>(
    `SELECT public.vendor_tier_limit('custom','waitlist_acceptances') AS wa,
            public.vendor_tier_limit('custom','branches_included')    AS br`,
  );
  assert.deepEqual([r.rows[0]!.wa, r.rows[0]!.br], [0, 0]);
});
