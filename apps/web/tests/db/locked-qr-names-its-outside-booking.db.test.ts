/**
 * A ONE-TIME CODE NAMES THE OUTSIDE BOOKING IT WAS MADE FOR — and only this shop's own.
 *
 * Owner 2026-10-28 (DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE", CUSTOMERS): a
 * booked-outside customer's row holds THEIR one-time code — Linked / Code sent / Not linked. The code is the shipped
 * Locked QR (`vendor_locked_qr_tokens`); migration `locked_qr_names_its_outside_booking` adds the one fact the row
 * needs: `block_id`, the outside booking the code was made for.
 *
 * Pinned here:
 *   1 · a code made for the shop's own outside booking keeps its `block_id`;
 *   2 · a code may not name ANOTHER shop's outside booking, nor this shop's day off — the trigger refuses;
 *   3 · removing the outside booking leaves the code (money may have moved) and only clears its `block_id`;
 *   4 · the vendor-org RLS still hides another shop's codes — the new column rides the existing policy;
 *   5 · NEUTRALISATION: drop the trigger and case 2 goes through — so case 2 measures the trigger, not a fixture.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let vendorUid = '';
let otherUid = '';
let shop = '';
let otherShop = '';
let shopPool = '';
let otherPool = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  vendorUid = await createUser('qr-block-vendor@audit.test');
  otherUid = await createUser('qr-block-other@audit.test');
  shop = await createVendor(vendorUid, 'Outside Booking Studio');
  otherShop = await createVendor(otherUid, 'Another Studio');
  shopPool = await createPool(shop);
  otherPool = await createPool(otherShop);
});

after(async () => {
  await db.close();
});

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createVendor(userId: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function createPool(vpid: string): Promise<string> {
  const r = await db.query<{ pool_id: string }>(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity, is_active)
     VALUES ($1, 'Main', 2, TRUE) RETURNING pool_id`,
    [vpid],
  );
  return r.rows[0]!.pool_id;
}

async function block(vpid: string, pool: string | null, source: 'external_client' | 'manual', day: string): Promise<string> {
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, client_name)
     VALUES ($1, $2::uuid, ($3 || ' 00:00+08')::timestamptz, ($3 || ' 23:30+08')::timestamptz, 'Held', $4,
             CASE WHEN $4 = 'external_client' THEN 'Reyes family' ELSE NULL END)
     RETURNING block_id`,
    [vpid, pool, day, source],
  );
  return r.rows[0]!.block_id;
}

async function token(vpid: string, uid: string, blockId: string | null): Promise<{ id: string; token: string }> {
  const r = await db.query<{ id: string; token: string }>(
    `INSERT INTO public.vendor_locked_qr_tokens (
       vendor_profile_id, created_by_user_id, category, service_description, event_date, total_php, initial_paid_php, block_id
     ) VALUES ($1, $2, 'photographer', 'Full-day coverage', '2027-04-10', 80000, 20000, $3::uuid)
     RETURNING id::text, token`,
    [vpid, uid, blockId],
  );
  return r.rows[0]!;
}

test('1 · a code made for the shop’s own outside booking keeps the booking it names', async () => {
  const b = await block(shop, shopPool, 'external_client', '2027-04-10');
  const t = await token(shop, vendorUid, b);
  const r = await db.query<{ block_id: string | null }>(`SELECT block_id::text FROM public.vendor_locked_qr_tokens WHERE id = $1`, [t.id]);
  assert.equal(r.rows[0]!.block_id, b, 'the code lost the outside booking it was made for');
  // And a code made without a customer is still a code.
  const none = await token(shop, vendorUid, null);
  assert.ok(none.token.length > 0);
});

test('2 · a code cannot name another shop’s outside booking, nor this shop’s day off', async () => {
  const theirs = await block(otherShop, otherPool, 'external_client', '2027-04-11');
  await assert.rejects(token(shop, vendorUid, theirs), /own outside booking/, 'a code was filed under another shop’s customer');
  const dayOff = await block(shop, null, 'manual', '2027-04-12');
  await assert.rejects(token(shop, vendorUid, dayOff), /own outside booking/, 'a code was filed under a day off');
  // Moving an existing code onto someone else's booking is refused the same way.
  const t = await token(shop, vendorUid, null);
  await assert.rejects(
    db.query(`UPDATE public.vendor_locked_qr_tokens SET block_id = $1::uuid WHERE id = $2`, [theirs, t.id]),
    /own outside booking/,
  );
});

test('3 · removing the outside booking keeps the code and only clears what it names', async () => {
  const b = await block(shop, shopPool, 'external_client', '2027-04-13');
  const t = await token(shop, vendorUid, b);
  await db.query(`DELETE FROM public.vendor_calendar_blocks WHERE block_id = $1`, [b]);
  const r = await db.query<{ block_id: string | null; status: string }>(
    `SELECT block_id::text, status FROM public.vendor_locked_qr_tokens WHERE id = $1`,
    [t.id],
  );
  assert.equal(r.rows.length, 1, 'removing the outside booking deleted its code');
  assert.equal(r.rows[0]!.block_id, null);
  assert.equal(r.rows[0]!.status, 'pending');
});

test('4 · the vendor-org RLS still hides another shop’s codes (the column rides the existing policy)', async () => {
  const theirBlock = await block(otherShop, otherPool, 'external_client', '2027-04-14');
  await token(otherShop, otherUid, theirBlock);
  await setAuthUid(db, vendorUid);
  // As the signed-in shop, not the replay's superuser (which bypasses RLS and would make this case vacuous).
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.vendor_locked_qr_tokens WHERE vendor_profile_id = $1`,
      [otherShop],
    );
    assert.equal(r.rows[0]!.n, 0, 'a shop can read another shop’s one-time codes');
    const mine = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.vendor_locked_qr_tokens WHERE block_id IS NOT NULL`,
    );
    assert.ok(mine.rows[0]!.n >= 1, 'the shop cannot read its own codes’ booking — the row would say nothing');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('5 · neutralised: without the trigger another shop’s booking goes through — case 2 measures the trigger', async () => {
  await db.query('BEGIN');
  try {
    await db.query(`DROP TRIGGER vendor_locked_qr_block_is_own_outside ON public.vendor_locked_qr_tokens`);
    const theirs = await block(otherShop, otherPool, 'external_client', '2027-04-15');
    const t = await token(shop, vendorUid, theirs);
    assert.ok(t.id, 'with the trigger gone the insert should have gone through');
  } finally {
    await db.query('ROLLBACK');
  }
});
