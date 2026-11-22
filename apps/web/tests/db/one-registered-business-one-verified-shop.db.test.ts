/**
 * "UNLIMITED" = ONE REGISTERED BUSINESS. Executed against replayed migrations.
 *
 * ⚖ OWNER, 2026-11-22 (DECISION_LOG "SUPPLIER PLAN ANTI-ABUSE RULES LOCKED", owner: "Lock all three"; build spec
 * SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22 § ★ I): Pro and Ultra give unlimited cards, people and branches for ONE
 * registered business (one DTI/SEC number) and its own staff. Migration 20271359913146.
 *
 *   1 · ONE VERIFIED SHOP PER REGISTRATION NUMBER — a second shop under a number another real shop is verified under
 *       cannot become verified (written another way, too), by any write; a different number can; the admin desk still
 *       lists both (`booking_fee_business_matches`).
 *   2 · A VERIFIED SHOP cannot take another verified shop's number either.
 *   3 · NOTHING GIVEN IS TAKEN BACK — a pair verified before the rule keeps both badges, and a re-approval of either
 *       (verified → verified) is not refused.
 *   4 · DEMO SHOPS never count, on either side — until a demo shop becomes real.
 *   5 · A SHOP WITH NO NUMBER is not matched with anyone.
 *   6 · THE ONE PREDICATE is service-role only (another shop's number is not session-readable).
 *   7 · EVERY BRANCH CARRIES THE SHOP'S NUMBER — a shop with none cannot open (insert, re-parent, un-cancel) a branch;
 *       a branch already open is untouched.
 *   8 · ONE SHOP PER PERSON — one account owns one shop (vendor_profiles.user_id UNIQUE).
 *
 * SABOTAGE (2026-11-22, each run against the replayed migrations, then reverted):
 *   · `RETURN NEW;` put first in `enforce_one_verified_shop_per_registration` → 1a, 1b, 2, 3, 4 RED.
 *   · the "already verified with this number" early return removed → 3 RED alone.
 *   · `AND o.is_demo IS NOT TRUE` dropped from the holder → 4 RED alone.
 *   · `RETURN NEW;` put first in `enforce_branch_carries_shop_registration` → 7a, 7c, 7d RED.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { seededBeforeTheOneVerifiedShopRule } from './shop-registration-fixture';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `onebiz-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  return u.rows[0]!.id;
}

type ShopArgs = { reg?: string | null; verified?: boolean; demo?: boolean; userId?: string };

async function newShop(a: ShopArgs = {}): Promise<string> {
  const userId = a.userId ?? (await newUser());
  const verified = a.verified === true;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        registration_number_raw, is_demo, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], $3::vendor_verification_state,
             CASE WHEN $3 = 'verified' THEN NOW() END, $4, $5,
             (CASE WHEN $3 = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [userId, `Shop ${uniq()}`, verified ? 'verified' : 'unverified', a.reg ?? null, a.demo ?? false],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** What every approval writes: the state, the stamp and the listing together. */
async function verify(vpid: string): Promise<void> {
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified'
      WHERE vendor_profile_id = $1`,
    [vpid],
  );
}

async function stateOf(vpid: string): Promise<string> {
  const r = await db.query<{ s: string }>(
    `SELECT verification_state::text AS s FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vpid],
  );
  return r.rows[0]!.s;
}

async function holderOf(vpid: string, raw: string | null): Promise<string | null> {
  const r = await db.query<{ h: string | null }>(
    `SELECT public.registration_number_verified_holder($1, $2) AS h`,
    [vpid, raw],
  );
  return r.rows[0]!.h;
}

const REFUSED = /already belongs to another verified shop/;

async function newBranch(vpid: string, cancelled = false): Promise<string> {
  const r = await db.query<{ b: string }>(
    `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km, cancelled_at)
     VALUES ($1, $2, 'Cebu', 30, CASE WHEN $3 THEN NOW() END) RETURNING branch_id AS b`,
    [vpid, uniq(), cancelled],
  );
  return r.rows[0]!.b;
}

const NO_NUMBER = /branch carries its shop's DTI or SEC registration number/;

test('0 · the migration replayed', async () => {
  assert.ok(
    !replay.skipped.some((s) => s.file.includes('one_registered_business_one_verified_shop')),
    'migration 20271359913146 was skipped',
  );
  const t = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger
      WHERE tgname IN ('vendor_profiles_one_verified_per_registration','vendor_branches_carry_shop_registration')
        AND NOT tgisinternal`,
  );
  assert.equal(t.rows[0]!.n, 2, 'a trigger is missing');
});

test('1a · a second shop under a verified shop’s number cannot be verified — written another way, too', async () => {
  const first = await newShop({ reg: 'DTI-1234-0001', verified: true });
  const second = await newShop({ reg: 'dti 1234 0001' });
  await assert.rejects(verify(second), (e: { code?: string; message?: string }) => {
    assert.equal(e.code, '23514');
    assert.match(String(e.message), REFUSED);
    return true;
  });
  assert.equal(await stateOf(second), 'unverified', 'the refused approval moved the shop');
  assert.equal(await holderOf(second, 'dti 1234 0001'), first, 'the predicate names the holder');
  // The admin desk still sees both shops, matched on the number.
  const m = await db.query<{ other_vendor_profile_id: string; matched_on: string[] }>(
    `SELECT other_vendor_profile_id, matched_on FROM public.booking_fee_business_matches(ARRAY[$1]::uuid[])`,
    [second],
  );
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0]!.other_vendor_profile_id, first);
  assert.ok(m.rows[0]!.matched_on.includes('registration_number'));
});

test('1b · a shop inserted already verified under a held number is refused too', async () => {
  await newShop({ reg: 'SEC-5555-0002', verified: true });
  await assert.rejects(newShop({ reg: 'SEC 5555 0002', verified: true }), REFUSED);
});

test('1c · a different number verifies; the holder rule is per number', async () => {
  await newShop({ reg: 'DTI-2000-0003', verified: true });
  const other = await newShop({ reg: 'DTI-2000-0004' });
  await verify(other);
  assert.equal(await stateOf(other), 'verified');
});

test('2 · a verified shop cannot take another verified shop’s number', async () => {
  await newShop({ reg: 'DTI-3000-0005', verified: true });
  const mine = await newShop({ reg: 'DTI-3000-0006', verified: true });
  await assert.rejects(
    db.query(`UPDATE public.vendor_profiles SET registration_number_raw = 'dti-3000-0005' WHERE vendor_profile_id = $1`, [mine]),
    REFUSED,
  );
});

test('3 · a pair verified before the rule keeps both badges; re-approving either is not refused', async () => {
  const a = await newShop({ reg: 'DTI-4000-0007', verified: true });
  const b = await seededBeforeTheOneVerifiedShopRule(db, () => newShop({ reg: 'DTI-4000-0007', verified: true }));
  await verify(a);
  await verify(b);
  await db.query(`UPDATE public.vendor_profiles SET business_name = 'Renamed' WHERE vendor_profile_id = $1`, [b]);
  assert.equal(await stateOf(a), 'verified');
  assert.equal(await stateOf(b), 'verified');
  // …but once one loses the badge, coming back is asked like anyone else.
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'demoted' WHERE vendor_profile_id = $1`, [b]);
  await assert.rejects(verify(b), REFUSED);
});

test('4 · demo shops never count — until a demo shop becomes real', async () => {
  // 4a · a verified demo shop holds nothing.
  await newShop({ reg: 'MP-6000-0008', verified: true, demo: true });
  const real = await newShop({ reg: 'MP-6000-0008' });
  await verify(real);
  assert.equal(await stateOf(real), 'verified', 'a demo shop blocked a real business');
  // 4b · a demo shop may be verified under a held number.
  const demo = await newShop({ reg: 'MP-6000-0008', demo: true });
  await verify(demo);
  assert.equal(await stateOf(demo), 'verified');
  // 4c · …but cannot then become a real shop under it.
  await assert.rejects(
    db.query(`UPDATE public.vendor_profiles SET is_demo = FALSE WHERE vendor_profile_id = $1`, [demo]),
    REFUSED,
  );
});

test('5 · a shop with no number is matched with nobody', async () => {
  await newShop({ verified: true });
  const none = await newShop();
  await verify(none);
  assert.equal(await stateOf(none), 'verified');
  assert.equal(await holderOf(none, null), null);
  assert.equal(await holderOf(none, '12'), null, 'a number too short to be one matched');
});

test('6 · the one predicate is service-role only', async () => {
  const shop = await newShop({ reg: 'DTI-7000-0009', verified: true });
  for (const role of ['authenticated', 'anon']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(holderOf(shop, 'DTI-7000-0009'), /permission denied/, `${role} can ask who holds a number`);
    } finally {
      await db.exec('RESET ROLE');
    }
  }
  await db.exec('SET ROLE service_role');
  try {
    assert.equal(await holderOf(shop, 'DTI-7000-0009'), null, 'a shop is never its own other holder');
  } finally {
    await db.exec('RESET ROLE');
  }
});

test('7a · a shop with no registration number cannot open a branch', async () => {
  const shop = await newShop({ verified: true });
  await assert.rejects(newBranch(shop), (e: { code?: string; message?: string }) => {
    assert.equal(e.code, '23514');
    assert.match(String(e.message), NO_NUMBER);
    return true;
  });
});

test('7b · a shop with a number opens branches; each carries the shop’s number (it has none of its own)', async () => {
  const shop = await newShop({ reg: 'DTI-8000-0010', verified: true });
  const branch = await newBranch(shop);
  const cols = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_branches' AND column_name ILIKE '%registration%'`,
  );
  assert.equal(cols.rows[0]!.n, 0, 'a branch grew a registration number of its own');
  const r = await db.query<{ reg: string | null }>(
    `SELECT vp.registration_number_raw AS reg FROM public.vendor_branches b
       JOIN public.vendor_profiles vp ON vp.vendor_profile_id = b.parent_vendor_profile_id
      WHERE b.branch_id = $1`,
    [branch],
  );
  assert.equal(r.rows[0]!.reg, 'DTI-8000-0010');
});

test('7c · a cancelled branch cannot come back, nor a branch move, under a shop with no number', async () => {
  const withNumber = await newShop({ reg: 'DTI-9000-0011', verified: true });
  const without = await newShop({ verified: true });
  const cancelled = await newBranch(withNumber, true);
  await db.query(`UPDATE public.vendor_profiles SET registration_number_raw = NULL WHERE vendor_profile_id = $1`, [withNumber]);
  await assert.rejects(
    db.query(`UPDATE public.vendor_branches SET cancelled_at = NULL WHERE branch_id = $1`, [cancelled]),
    NO_NUMBER,
  );
  await db.query(`UPDATE public.vendor_profiles SET registration_number_raw = 'DTI-9000-0011' WHERE vendor_profile_id = $1`, [withNumber]);
  const open = await newBranch(withNumber);
  await assert.rejects(
    db.query(`UPDATE public.vendor_branches SET parent_vendor_profile_id = $2 WHERE branch_id = $1`, [open, without]),
    NO_NUMBER,
  );
});

test('7d · a branch already open is untouched: it can be renamed and cancelled', async () => {
  const shop = await newShop({ reg: 'DTI-9100-0012', verified: true });
  const branch = await newBranch(shop);
  await db.query(`UPDATE public.vendor_profiles SET registration_number_raw = NULL WHERE vendor_profile_id = $1`, [shop]);
  await db.query(`UPDATE public.vendor_branches SET branch_label = 'Renamed' WHERE branch_id = $1`, [branch]);
  await db.query(`UPDATE public.vendor_branches SET cancelled_at = NOW() WHERE branch_id = $1`, [branch]);
  // …and once cancelled, it does not come back without a number.
  await assert.rejects(
    db.query(`UPDATE public.vendor_branches SET cancelled_at = NULL WHERE branch_id = $1`, [branch]),
    NO_NUMBER,
  );
});

test('8 · one shop per person — an account cannot own a second shop', async () => {
  const userId = await newUser();
  await newShop({ userId });
  await assert.rejects(newShop({ userId }), (e: { code?: string }) => {
    assert.equal(e.code, '23505', 'a second shop for one account was not refused by the unique owner');
    return true;
  });
});
