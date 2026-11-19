/**
 * PLAN ALLOWANCES IN THE DATABASE — the two numbers SQL holds, against the TypeScript table, plus the included-branch
 * gate. Covers 20271307996183_supplier_plan_allowances_2026_11_04.
 *
 * Owner 2026-11-04 (DECISION_LOG "SUPPLIER PLAN ALLOWANCES" + "BRANCHES PER PLAN"), verbatim: *"waitlist 0,0,1,5"* ·
 * *"branches 0,0,3,10"*. Free·Verified / Solo / Pro / Ultra. (The Custom plan was retired 2026-11-06.)
 * Ultra trimmed the same day ("WITH TRIMMED ALLOWANCES"): waitlist 3, branches 6. Expectations read TIER_CAPS.
 *
 * 🔑 PARITY DERIVES FROM THE TYPESCRIPT SIDE (`TIER_CAPS`), so editing one side alone turns CI red.
 * 🔑 GRANDFATHERING is asserted, not assumed: a shop over its allowance keeps every live included branch, renames and
 *    cancels them freely, and is refused only the NEXT one.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  VENDOR_TIERS,
  TIER_CAPS,
  type VendorTier,
} from '../../lib/vendor-tier-caps';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function newVendor(label: string, tier: VendorTier): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@allowances.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Allowance Test', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET tier_state = $2 WHERE vendor_profile_id = $1`, [vendorProfileId, tier]);
  return vendorProfileId;
}

async function addBranch(vendor: string, included: boolean): Promise<{ id: string | null; error: string | null }> {
  try {
    const r = await db.query<{ branch_id: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km, included_in_plan)
       VALUES ($1, $2, 'Cebu', 100, $3) RETURNING branch_id`,
      [vendor, uniq('branch'), included],
    );
    return { id: r.rows[0]!.branch_id, error: null };
  } catch (e) {
    return { id: null, error: String((e as Error).message) };
  }
}

test('vendor_tier_limit says exactly what TIER_CAPS says — waitlist and branches, every tier; no bookings-per-date key', async () => {
  for (const tier of VENDOR_TIERS) {
    const r = await db.query<{ wa: number; br: number; bpd: number | null }>(
      `SELECT public.vendor_tier_limit($1,'waitlist_acceptances') AS wa,
              public.vendor_tier_limit($1,'branches_included') AS br,
              public.vendor_tier_limit($1,'bookings_per_date_per_service') AS bpd`,
      [tier],
    );
    assert.equal(r.rows[0]!.wa, TIER_CAPS[tier].waitlistAcceptances, `${tier} waitlist`);
    assert.equal(r.rows[0]!.br, TIER_CAPS[tier].branchesIncluded, `${tier} branches`);
    // Owner 2026-11-18 (ruling 17): bookings per date are not a plan limit — the key answers NULL on every plan.
    assert.equal(r.rows[0]!.bpd, null, `${tier} bookings per date per service`);
  }
  const unknown = await db.query<{ br: number; bpd: number | null }>(
    `SELECT public.vendor_tier_limit(NULL,'branches_included') AS br,
            public.vendor_tier_limit(NULL,'bookings_per_date_per_service') AS bpd`,
  );
  assert.equal(unknown.rows[0]!.br, 0, 'an unknown tier reads as Free — no included branches');
  assert.equal(unknown.rows[0]!.bpd, null, 'no plan serves a bookings-per-date number');
});

test('Pro may add its included branches and is refused the next one', async () => {
  const pro = await newVendor('pro', 'pro');
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) {
    const r = await addBranch(pro, true);
    assert.equal(r.error, null, `included branch ${i + 1} refused: ${r.error}`);
  }
  const over = await addBranch(pro, true);
  assert.match(over.error ?? '', /included_branch_allowance/, 'a 4th included branch was let in');
});

test('Free, Verified and Solo have no included branches', async () => {
  for (const tier of ['free', 'verified', 'solo'] as const) {
    const v = await newVendor(tier, tier);
    const r = await addBranch(v, true);
    assert.match(r.error ?? '', /included_branch_allowance/, `${tier} got a free branch`);
  }
});

test('a PAID branch (included_in_plan false) is never counted or refused here', async () => {
  const solo = await newVendor('solo-paid', 'solo');
  assert.equal((await addBranch(solo, false)).error, null);
});

test('cancelling an included branch frees its place; un-cancelling past the allowance is refused', async () => {
  const pro = await newVendor('pro-cancel', 'pro');
  const ids: string[] = [];
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) ids.push((await addBranch(pro, true)).id!);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [ids[0]]);
  const again = await addBranch(pro, true);
  assert.equal(again.error, null, 'the freed place was not given back');
  await assert.rejects(
    db.query(`UPDATE public.vendor_branches SET cancelled_at = NULL WHERE branch_id = $1`, [ids[0]]),
    /included_branch_allowance/,
    'un-cancelling took a 4th included branch',
  );
});

test('GRANDFATHERED: a shop over a lowered allowance keeps its branches, edits them, and is refused only the next', async () => {
  const ent = await newVendor('ultra-down', 'enterprise');
  const ids: string[] = [];
  const held = TIER_CAPS.enterprise.branchesIncluded; // Ultra 3 (owner 2026-11-19) — more than Pro's 1
  assert.ok(held > TIER_CAPS.pro.branchesIncluded + 1, 'the scenario needs Ultra to hold more than Pro + 1');
  for (let i = 0; i < held; i++) ids.push((await addBranch(ent, true)).id!);
  // Drop the plan underneath them (admin path — the downgrade guard is a separate concern, so write tier directly).
  await db.query(`ALTER TABLE public.vendor_profiles DISABLE TRIGGER USER`);
  try {
    await db.query(`UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`, [ent]);
  } finally {
    await db.query(`ALTER TABLE public.vendor_profiles ENABLE TRIGGER USER`);
  }
  const live = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_branches
      WHERE parent_vendor_profile_id = $1 AND included_in_plan AND cancelled_at IS NULL`,
    [ent],
  );
  assert.equal(live.rows[0]!.n, held, 'a lowered allowance removed a branch the shop already had');
  await db.query(`UPDATE public.vendor_branches SET branch_label = 'Renamed' WHERE branch_id = $1`, [ids[1]]);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [ids[2]]);
  const next = await addBranch(ent, true);
  assert.match(next.error ?? '', /included_branch_allowance/, 'an over-allowance shop added another included branch');
});

/**
 * One Ultra Add-on payment, as the activation hook leaves it: a PAID `vendor_ultra_addon__<id>` order with its own
 * 28-day window (`expires_at`). `endsInDays` < 0 = a window that has already run out.
 */
async function ultraAddOnOrder(vendor: string, endsInDays: number, status = 'paid'): Promise<void> {
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vendor]);
  await db.query(
    `INSERT INTO public.orders (user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code, expires_at)
     VALUES ($1, $2, $3, 'Ultra Add-on', 2490, $4, 'SN' || upper(substr(md5(random()::text), 1, 8)), now() + make_interval(days => $5))`,
    [owner.rows[0]!.user_id, vendor, `vendor_ultra_addon__${vendor}`, status, endsInDays],
  );
}

test('THE ULTRA ADD-ON (owner 2026-11-19): +1 included branch per LIVE add-on, on Ultra only', async () => {
  const ultra = await newVendor('ultra-addon', 'enterprise');
  await ultraAddOnOrder(ultra, 20); // live
  await ultraAddOnOrder(ultra, 3); // live — it stacks
  await ultraAddOnOrder(ultra, -1); // ⏳ its 28 days ran out — must NOT count (review 2026-11-19)
  await ultraAddOnOrder(ultra, 20, 'refunded'); // refunded — must NOT count
  const live = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1) AS n`, [ultra]);
  assert.equal(live.rows[0]!.n, 2, 'the live count is not "paid AND in window"');
  const cap = TIER_CAPS.enterprise.branchesIncluded + 2;
  for (let i = 0; i < cap; i++) {
    const r = await addBranch(ultra, true);
    assert.equal(r.error, null, `Ultra + 2 live add-ons: included branch ${i + 1} of ${cap} refused: ${r.error}`);
  }
  assert.match((await addBranch(ultra, true)).error ?? '', /included_branch_allowance/, 'one past Ultra + its live add-ons was let in');

  // A live add-on on a plan that is not Ultra adds nothing (a lapsed Ultra keeps its orders until they run out).
  const pro = await newVendor('pro-addon', 'pro');
  await ultraAddOnOrder(pro, 20);
  for (let i = 0; i < TIER_CAPS.pro.branchesIncluded; i++) assert.equal((await addBranch(pro, true)).error, null);
  assert.match((await addBranch(pro, true)).error ?? '', /included_branch_allowance/, 'a Pro shop was given an Ultra Add-on branch');
});

test('ONE PAYMENT IS 28 DAYS, NOT FOREVER: an Ultra Add-on whose window ran out gives nothing', async () => {
  const ultra = await newVendor('ultra-lapsed', 'enterprise');
  await ultraAddOnOrder(ultra, -1);
  assert.equal((await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons($1) AS n`, [ultra])).rows[0]!.n, 0);
  for (let i = 0; i < TIER_CAPS.enterprise.branchesIncluded; i++) assert.equal((await addBranch(ultra, true)).error, null);
  assert.match((await addBranch(ultra, true)).error ?? '', /included_branch_allowance/, 'a lapsed add-on still gave a branch');
});

test('the app\'s read of the live count answers only for the caller\'s own shop', async () => {
  const mine = await newVendor('ultra-read-mine', 'enterprise');
  const theirs = await newVendor('ultra-read-theirs', 'enterprise');
  await ultraAddOnOrder(mine, 10);
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [mine]);
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const own = await db.query<{ n: number }>(`SELECT public.vendor_live_ultra_addons_for($1) AS n`, [mine]);
    assert.equal(own.rows[0]!.n, 1);
    await assert.rejects(() => db.query(`SELECT public.vendor_live_ultra_addons_for($1)`, [theirs]), /not your shop/);
    await assert.rejects(() => db.query(`SELECT public.vendor_live_ultra_addons($1)`, [mine]), /permission denied/, 'the internal count is callable by a shop');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
});
