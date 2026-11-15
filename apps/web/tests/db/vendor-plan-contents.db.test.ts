/**
 * 🧮 PLAN CONTENTS IN THE DATABASE (migration 20271344452857). Owner 2026-11-13, "Yes, add both".
 *
 *   · the seed equals TIER_CAPS, key by key (derived from the TypeScript side, so editing one alone turns CI red);
 *   · A CAP EDIT CHANGES WHAT vendor_tier_limit() RETURNS — and a missing row falls back to the code value;
 *   · every change writes a history row (the trigger — no edit path can skip it);
 *   · the table is public-read, written only by the service role; the four keys vendor_tier_limit() serves can never
 *     be "no limit";
 *   · approve_plan_contents_change is an allowed approval action.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { TIER_CAPS, VENDOR_TIERS } from '../../lib/vendor-tier-caps';
import { EDITABLE_PLAN_KEYS, codeValue } from '../../lib/vendor-plan-contents';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function asRole(role: 'anon' | 'authenticated' | null): Promise<void> {
  if (role) {
    await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
    await db.exec(`SET ROLE ${role}`);
  } else {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

async function limit(tier: string, key: string): Promise<number | null> {
  const r = await db.query<{ v: number | null }>(`SELECT public.vendor_tier_limit($1, $2) AS v`, [tier, key]);
  return r.rows[0]!.v;
}

test('the seed equals TIER_CAPS for every plan and every editable allowance', async () => {
  await asRole(null);
  const r = await db.query<{ plan: string; key: string; value: number | null }>(
    `SELECT plan, key, value FROM public.vendor_plan_contents`,
  );
  const got = new Map(r.rows.map((x) => [`${x.plan}|${x.key}`, x.value]));
  let n = 0;
  for (const t of VENDOR_TIERS) {
    for (const def of EDITABLE_PLAN_KEYS) {
      const k = `${t}|${def.key}`;
      assert.ok(got.has(k), `no seed row for ${k}`);
      assert.equal(got.get(k), codeValue(t, def.capKey), `seed ${k} ≠ TIER_CAPS`);
      n += 1;
    }
  }
  assert.equal(r.rows.length, n, 'a seed row exists that no editable key names');
  assert.ok(n >= 35);
});

test('a cap edit changes what vendor_tier_limit() returns — and a missing row falls back to the code value', async () => {
  await asRole(null);
  const before = await limit('pro', 'branches_included');
  assert.equal(before, TIER_CAPS.pro.branchesIncluded);

  await db.query(`UPDATE public.vendor_plan_contents SET value = 2 WHERE plan = 'pro' AND key = 'branches_included'`);
  assert.equal(await limit('pro', 'branches_included'), 2, 'the edit did not reach vendor_tier_limit()');
  // Another plan is untouched.
  assert.equal(await limit('enterprise', 'branches_included'), TIER_CAPS.enterprise.branchesIncluded);

  await db.query(`UPDATE public.vendor_plan_contents SET value = 4 WHERE plan = 'enterprise' AND key = 'waitlist_acceptances'`);
  assert.equal(await limit('enterprise', 'waitlist_acceptances'), 4);

  // Row gone → the code value again (the fallback arms are kept).
  await db.query(`DELETE FROM public.vendor_plan_contents WHERE plan = 'pro' AND key = 'branches_included'`);
  assert.equal(await limit('pro', 'branches_included'), TIER_CAPS.pro.branchesIncluded);

  // An unknown tier reads as Free; an unknown key is still NULL, never a silent 0.
  await db.query(`UPDATE public.vendor_plan_contents SET value = 3 WHERE plan = 'free' AND key = 'bookings_per_date_per_service'`);
  assert.equal(await limit('platinum', 'bookings_per_date_per_service'), 3);
  assert.equal(await limit('pro', 'no_such_key'), null);

  // put things back for the tests below
  await db.query(
    `INSERT INTO public.vendor_plan_contents (plan, key, value) VALUES ('pro','branches_included',$1)
     ON CONFLICT (plan, key) DO UPDATE SET value = EXCLUDED.value`,
    [TIER_CAPS.pro.branchesIncluded],
  );
  await db.query(`UPDATE public.vendor_plan_contents SET value = $1 WHERE plan = 'free' AND key = 'bookings_per_date_per_service'`, [
    TIER_CAPS.free.bookingsPerDatePerService,
  ]);
});

test('the branch gate in the database obeys the edited number', async () => {
  await asRole(null);
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('plan-branch@plan.test', jsonb_build_object('account_type','vendor')) RETURNING id`,
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [userId]);
  const shop =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city) VALUES ($1,'Plan Test','Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`, [shop]);
  await db.query(`UPDATE public.vendor_plan_contents SET value = 1 WHERE plan = 'pro' AND key = 'branches_included'`);

  const add = async () =>
    db.query(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km, included_in_plan)
       VALUES ($1, 'B-' || gen_random_uuid()::text, 'Cebu', 100, TRUE)`,
      [shop],
    );
  await add(); // the first one fits the edited allowance of 1
  await assert.rejects(add(), 'a second included branch got past an allowance edited down to 1');

  await db.query(`UPDATE public.vendor_plan_contents SET value = $1 WHERE plan = 'pro' AND key = 'branches_included'`, [
    TIER_CAPS.pro.branchesIncluded,
  ]);
});

test('every change writes a history row; an unchanged write writes none', async () => {
  await asRole(null);
  const count = async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_plan_content_changes WHERE plan='solo' AND key='agent_accounts'`)).rows[0]!.n;
  const n0 = await count();
  await db.query(`UPDATE public.vendor_plan_contents SET value = 2 WHERE plan = 'solo' AND key = 'agent_accounts'`);
  await db.query(`UPDATE public.vendor_plan_contents SET value = 2 WHERE plan = 'solo' AND key = 'agent_accounts'`);
  assert.equal(await count(), n0 + 1);
  const h = await db.query<{ old_value: number; new_value: number }>(
    `SELECT old_value, new_value FROM public.vendor_plan_content_changes WHERE plan='solo' AND key='agent_accounts' ORDER BY change_id DESC LIMIT 1`,
  );
  assert.deepEqual(h.rows[0], { old_value: TIER_CAPS.solo.agentAccounts, new_value: 2 });
  await db.query(`UPDATE public.vendor_plan_contents SET value = $1 WHERE plan = 'solo' AND key = 'agent_accounts'`, [
    TIER_CAPS.solo.agentAccounts,
  ]);
});

test('anyone may read the plan table; nobody but the service role may write it; history is not public', async () => {
  await asRole('anon');
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_plan_contents`);
  assert.ok(r.rows[0]!.n >= 35, 'anon cannot read the plan table (the Plans page and vendor_tier_limit need it)');
  await assert.rejects(db.query(`UPDATE public.vendor_plan_contents SET value = 99 WHERE plan='pro' AND key='agent_accounts'`));
  await asRole('authenticated');
  await assert.rejects(db.query(`UPDATE public.vendor_plan_contents SET value = 99 WHERE plan='pro' AND key='agent_accounts'`));
  await assert.rejects(db.query(`INSERT INTO public.vendor_plan_contents (plan,key,value) VALUES ('pro','agent_accounts',99)`));
  await asRole('anon');
  await assert.rejects(db.query(`SELECT * FROM public.vendor_plan_content_changes`));
  await asRole(null);
  assert.equal(await limit('pro', 'agent_accounts'), TIER_CAPS.pro.agentAccounts);
});

test('the four allowances vendor_tier_limit() serves can never be "no limit"', async () => {
  await asRole(null);
  for (const key of ['whitelist_per_date', 'waitlist_acceptances', 'branches_included', 'bookings_per_date_per_service']) {
    await assert.rejects(
      db.query(`UPDATE public.vendor_plan_contents SET value = NULL WHERE plan = 'pro' AND key = $1`, [key]),
      /vendor_plan_contents_sql_keys_finite_ck/,
    );
  }
  // …while a seat count may be.
  await db.query(`UPDATE public.vendor_plan_contents SET value = NULL WHERE plan = 'enterprise' AND key = 'agent_accounts'`);
  await db.query(`UPDATE public.vendor_plan_contents SET value = $1 WHERE plan = 'enterprise' AND key = 'agent_accounts'`, [
    TIER_CAPS.enterprise.agentAccounts,
  ]);
});

test('approve_plan_contents_change is an allowed approval action', async () => {
  await asRole(null);
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'admin_approval_requests_action_type_check'`,
  );
  assert.match(r.rows[0]!.def, /approve_plan_contents_change/);
  assert.match(r.rows[0]!.def, /approve_retail_price_change/, 'the rebuild dropped an existing action');
});
