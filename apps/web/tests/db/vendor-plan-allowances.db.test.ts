/**
 * PLAN ALLOWANCES IN THE DATABASE — the two numbers SQL holds, against the TypeScript table, plus the included-branch
 * gate. Covers 20271307996183_supplier_plan_allowances_2026_11_04.
 *
 * Owner 2026-11-04 (DECISION_LOG "SUPPLIER PLAN ALLOWANCES" + "BRANCHES PER PLAN"), verbatim: *"waitlist 0,0,1,5"* ·
 * *"branches 0,0,3,10"*. Free·Verified / Solo / Pro / Ultra; Custom runs as Ultra.
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

test('vendor_tier_limit says exactly what TIER_CAPS says — waitlist, branches and bookings per date, every tier', async () => {
  for (const tier of VENDOR_TIERS) {
    const r = await db.query<{ wa: number; br: number; bpd: number | null }>(
      `SELECT public.vendor_tier_limit($1,'waitlist_acceptances') AS wa,
              public.vendor_tier_limit($1,'branches_included') AS br,
              public.vendor_tier_limit($1,'bookings_per_date_per_service') AS bpd`,
      [tier],
    );
    assert.equal(r.rows[0]!.wa, TIER_CAPS[tier].waitlistAcceptances, `${tier} waitlist`);
    assert.equal(r.rows[0]!.br, TIER_CAPS[tier].branchesIncluded, `${tier} branches`);
    // Owner 2026-11-06 ("BOOKINGS PER DATE PER SERVICE IS A PLAN ALLOWANCE"): Solo 1 · Pro 3 · Ultra 5; and the owner
    // click the same day ("… FREE AND VERIFIED"): Free 1 · Verified 1, like Solo. Every plan has a number — no NULL.
    assert.equal(r.rows[0]!.bpd, TIER_CAPS[tier].bookingsPerDatePerService, `${tier} bookings per date per service`);
  }
  const unknown = await db.query<{ br: number; bpd: number | null }>(
    `SELECT public.vendor_tier_limit(NULL,'branches_included') AS br,
            public.vendor_tier_limit(NULL,'bookings_per_date_per_service') AS bpd`,
  );
  assert.equal(unknown.rows[0]!.br, 0, 'an unknown tier reads as Free — no included branches');
  assert.equal(unknown.rows[0]!.bpd, TIER_CAPS.free.bookingsPerDatePerService, 'an unknown tier reads as Free — 1 per date');
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
  for (let i = 0; i < 5; i++) ids.push((await addBranch(ent, true)).id!);
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
  assert.equal(live.rows[0]!.n, 5, 'a lowered allowance removed a branch the shop already had');
  await db.query(`UPDATE public.vendor_branches SET branch_label = 'Renamed' WHERE branch_id = $1`, [ids[1]]);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [ids[2]]);
  const next = await addBranch(ent, true);
  assert.match(next.error ?? '', /included_branch_allowance/, 'an over-allowance shop added another included branch');
});
