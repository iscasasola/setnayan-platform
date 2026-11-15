/**
 * A SUPPLIER RECORDS A REFUND THEY GAVE A CLIENT (Supplier Build 2 lane E, migration 20271328327292,
 * `event_vendor_refunds` + `vendor_record_client_refund` + `vendor_remove_client_refund`). No money moves — a record.
 *
 * WHAT IS ASSERTED (RLS on: every call runs as the signed-in role, never the replay's superuser)
 *   1. The shop records a refund for ITS OWN client: amount · date · reason · proof, stamped with the booking's event
 *      and the shop.
 *   2. Another shop cannot: `not_your_client`, and nothing is written.
 *   3. The money rules: never above confirmed payments less earlier refunds; a blank reason, a zero amount and a
 *      future date are refused; a double tap (same request id) is one row.
 *   4. Reads: the shop reads it; the couple reads it; another shop does not; anon cannot read the table at all.
 *   5. Nobody writes the table directly — not the shop, not the couple (writes are the two functions only).
 *   6. Remove (the swipe): stamped `removed_at`, kept; a second remove says `already_removed`; another shop's says
 *      `not_found` and leaves it.
 *   7. NEUTRALISED: drop the ownership filter from the record function and case 2 lets another shop write — case 2
 *      measures the function, not a fixture.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let coupleUid = '';
let vendorUid = '';
let otherUid = '';
let shop = '';
let otherShop = '';
let eventId = '';
let booking = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  coupleUid = await createUser('refund-couple@audit.test');
  vendorUid = await createUser('refund-vendor@audit.test');
  otherUid = await createUser('refund-other@audit.test');
  shop = await createVendor(vendorUid, 'Refund Studio');
  otherShop = await createVendor(otherUid, 'Not Their Studio');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Refund Wedding', 'wedding', 'catholic', 'garden') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, coupleUid]);
  const b = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, $2, $2, 'photographer'::public.vendor_category, 'Refund Studio', 'deposit_paid', 80000) RETURNING vendor_id`,
    [eventId, shop],
  );
  booking = b.rows[0]!.vendor_id;
  // ₱20,000 confirmed received, and ₱5,000 logged but never confirmed (it does not count).
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, vendor_confirmed_at, vendor_confirmed_by)
     VALUES ($1, $2, 20000, 'gcash', NOW(), $3), ($1, $2, 5000, 'gcash', NULL, NULL)`,
    [eventId, booking, vendorUid],
  );
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
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified'::public.vendor_verification_state, NOW(), 'verified')
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function as<T>(role: 'authenticated' | 'anon', uid: string | null, run: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await run();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
}

type Out = { status: string; refund_id?: string; repeat?: boolean };
const record = (uid: string, amount: number, opts: { reason?: string; on?: string; request?: string | null; proof?: string | null } = {}) =>
  as('authenticated', uid, async () =>
    (
      await db.query<{ out: Out }>(`SELECT public.vendor_record_client_refund($1, $2, $3::date, $4, $5, $6) AS out`, [
        booking,
        amount,
        opts.on ?? '2026-11-01',
        opts.reason ?? 'Drone dropped from the package',
        opts.proof ?? null,
        opts.request ?? null,
      ])
    ).rows[0]!.out,
  );

const live = async () =>
  (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendor_refunds WHERE event_vendor_id = $1 AND removed_at IS NULL`, [booking])).rows[0]!.n;

const countAs = (uid: string) =>
  as('authenticated', uid, async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendor_refunds`)).rows[0]!.n);

let first = '';

test('1 · the shop records a refund for its own client — stamped with the booking’s event and the shop', async () => {
  const out = await record(vendorUid, 3000, { proof: 'r2://setnayan-media/locked-qr-proof/refund.jpg' });
  assert.equal(out.status, 'ok');
  first = out.refund_id!;
  const r = await db.query<{ event_id: string; vendor_profile_id: string; amount_php: string; reason: string; proof_r2_key: string; recorded_by_user_id: string }>(
    `SELECT event_id, vendor_profile_id, amount_php::text, reason, proof_r2_key, recorded_by_user_id FROM public.event_vendor_refunds WHERE refund_id = $1`,
    [first],
  );
  const row = r.rows[0]!;
  assert.equal(row.event_id, eventId);
  assert.equal(row.vendor_profile_id, shop);
  assert.equal(row.amount_php, '3000.00');
  assert.equal(row.recorded_by_user_id, vendorUid);
  assert.ok(row.proof_r2_key.endsWith('refund.jpg'));
});

test('2 · another shop cannot record a refund on this client', async () => {
  const before = await live();
  const out = await record(otherUid, 1000);
  assert.equal(out.status, 'not_your_client');
  assert.equal(await live(), before, 'another shop wrote a refund onto a client that is not theirs');
  // Nor the couple, through the function.
  assert.equal((await record(coupleUid, 1000)).status, 'not_your_client');
});

test('3 · the money rules: within what was confirmed received; a reason, an amount, a past date; a double tap is one row', async () => {
  // Confirmed ₱20,000 − ₱3,000 already refunded = ₱17,000 left (the unconfirmed ₱5,000 does not count).
  assert.equal((await record(vendorUid, 17000.01)).status, 'more_than_received');
  assert.equal((await record(vendorUid, 0)).status, 'amount');
  assert.equal((await record(vendorUid, 100, { reason: '   ' })).status, 'reason');
  assert.equal((await record(vendorUid, 100, { on: '2099-01-01' })).status, 'date');
  const req = 'b6a5bd36-6f2d-4d43-9f0a-0b9f8f0a1c11';
  const before = await live();
  const a = await record(vendorUid, 500, { request: req });
  const b = await record(vendorUid, 500, { request: req });
  assert.equal(a.status, 'ok');
  assert.equal(b.status, 'ok');
  assert.equal(b.refund_id, a.refund_id);
  assert.equal(await live(), before + 1, 'a double tap wrote two refunds');
});

test('4 · reads: the shop and the couple read it; another shop does not; anon cannot read the table', async () => {
  assert.ok((await countAs(vendorUid)) >= 2, 'the shop cannot read its own refunds');
  assert.ok((await countAs(coupleUid)) >= 2, 'the couple cannot see the refund their supplier recorded');
  assert.equal(await countAs(otherUid), 0, 'another shop reads this shop’s refunds');
  await assert.rejects(
    as('anon', null, () => db.query(`SELECT count(*) FROM public.event_vendor_refunds`)),
    /permission denied/,
    'anon can read the refunds table',
  );
});

test('5 · nobody writes the table directly — every write is one of the two functions', async () => {
  for (const uid of [vendorUid, coupleUid]) {
    await assert.rejects(
      as('authenticated', uid, () =>
        db.query(
          `INSERT INTO public.event_vendor_refunds (event_id, event_vendor_id, vendor_profile_id, amount_php, refunded_on, reason, recorded_by_user_id)
           VALUES ($1, $2, $3, 1, '2026-11-01', 'direct', $4)`,
          [eventId, booking, shop, uid],
        ),
      ),
      /permission denied/,
    );
    await assert.rejects(
      as('authenticated', uid, () => db.query(`UPDATE public.event_vendor_refunds SET amount_php = 1 WHERE refund_id = $1`, [first])),
      /permission denied/,
    );
  }
});

test('6 · remove (the swipe): stamped and kept; twice says so; another shop’s remove leaves it', async () => {
  const remove = (uid: string) =>
    as('authenticated', uid, async () => (await db.query<{ r: string }>(`SELECT public.vendor_remove_client_refund($1) AS r`, [first])).rows[0]!.r);
  assert.equal(await remove(otherUid), 'not_found');
  assert.equal(await remove(vendorUid), 'removed');
  assert.equal(await remove(vendorUid), 'already_removed');
  const r = await db.query<{ removed_at: string | null }>(`SELECT removed_at::text FROM public.event_vendor_refunds WHERE refund_id = $1`, [first]);
  assert.ok(r.rows[0]!.removed_at, 'a removed refund was hard-deleted or not stamped');
  // Removed, its ₱3,000 is free again: ₱20,000 − ₱500 left to refund.
  assert.equal((await record(vendorUid, 19500)).status, 'ok');
});

test('7 · NEUTRALISED: without the ownership filter another shop could write — case 2 measures the function', async () => {
  const def = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_record_client_refund'`,
    )
  ).rows[0]!.def;
  const guard = 'AND ev.marketplace_vendor_id IN (SELECT public.current_vendor_profile_ids())';
  assert.ok(def.includes(guard), 'the ownership filter is not where this test expects it');
  await db.query('BEGIN');
  try {
    await db.exec(def.replace(guard, ''));
    // Make room under the cap so only ownership could refuse it.
    await db.query(`UPDATE public.event_vendor_refunds SET removed_at = NOW() WHERE event_vendor_id = $1`, [booking]);
    assert.equal((await record(otherUid, 100)).status, 'ok');
  } finally {
    await db.query('ROLLBACK');
  }
  assert.equal((await record(otherUid, 100)).status, 'not_your_client', 'the guard did not come back after the rollback');
});
