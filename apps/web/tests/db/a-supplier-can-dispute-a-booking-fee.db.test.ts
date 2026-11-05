/**
 * 🕵️ A SUPPLIER CAN DISPUTE A BOOKING FEE — the grace-first ladder, walked in SQL. Migration 20271310612526.
 *
 * Owner, 2026-07-27 (DECISION_LOG "FOUND-YOU DISPUTES — grace-first ladder"): *"for their first dispute, we will
 * accept but remind them that this is the power and reach of setnayan's service… second dispute will be upon review
 * of our admin"*. Owner, 2026-11-05: *"switch on booking fee. and build dispute"*.
 *
 *   1 · the FIRST dispute ever is accepted on the spot: the charge becomes waived_import, its open bill is cancelled,
 *       and the answer carries the found-record's count for the reminder;
 *   2 · the SECOND waits: the charge and its bill are untouched;
 *   3 · an admin's accept waives it and cancels the bill; a reject leaves both standing; a decision is made once;
 *   4 · only the shop's own account can dispute; a paid fee cannot be disputed; asking twice reports the first;
 *       a non-admin cannot decide;
 *   5 · the shop reads its own disputes; another shop, a couple and anon read none; no session writes one or calls
 *       the two steps.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}
async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await asOwner();
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}

async function newUser(tag: string): Promise<string> {
  await asOwner();
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${tag}-${++n}@fee-dispute.test`],
  );
}

async function newShop(): Promise<{ uid: string; shop: string }> {
  const uid = await newUser('shop');
  await asOwner();
  const shop = await one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [uid, `Disputing Shop ${n}`],
  );
  return { uid, shop };
}

/** One sourced booking of `shop` with an OPEN fee bill: event, booking row, ledger, a pending charge, its order. */
async function billedBooking(shop: string): Promise<{ eventId: string; chargeId: string }> {
  await asOwner();
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`Fee dispute ${++n}`],
  );
  const bookingId = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, source)
     VALUES ($1, 'catering', 'Disputing Shop', 'considering', $2, 'host_marketplace_search') RETURNING vendor_id`,
    [eventId, shop],
  );
  const ledgerId = await one<string>(
    `INSERT INTO public.booking_fee_ledger (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING ledger_id`,
    [eventId, shop],
  );
  const chargeId = await one<string>(
    `INSERT INTO public.booking_fee_charges
       (ledger_id, event_id, vendor_profile_id, event_vendor_id, kind, source, status,
        proposal_amount_centavos, computed_fee_centavos, amount_charged_centavos, schedule_version)
     VALUES ($1, $2, $3, $4, 'primary', 'lock', 'pending', 10000000, 500000, 500000, 'test') RETURNING charge_id`,
    [ledgerId, eventId, shop, bookingId],
  );
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [chargeId]);
  return { eventId, chargeId };
}

async function state(chargeId: string): Promise<{ charge: string; order: string | null }> {
  await asOwner();
  const charge = await one<string>(`SELECT status FROM public.booking_fee_charges WHERE charge_id = $1`, [chargeId]);
  const order = await one<string | null>(
    `SELECT status::text FROM public.orders WHERE service_key = 'vendor_booking_fee__' || $1::text`,
    [chargeId],
  );
  return { charge, order: order ?? null };
}

async function openDispute(chargeId: string, uid: string, reason: string | null = 'They were my cousin’s friends'): Promise<Record<string, unknown>> {
  await asOwner();
  return one<Record<string, unknown>>(`SELECT public.booking_fee_open_dispute($1, $2, $3)`, [chargeId, uid, reason]);
}

async function decide(disputeId: string, adminId: string, accept: boolean): Promise<Record<string, unknown>> {
  await asOwner();
  return one<Record<string, unknown>>(`SELECT public.booking_fee_decide_dispute($1, $2, $3, 'checked the chats')`, [
    disputeId,
    adminId,
    accept,
  ]);
}

const F = { uid: '', shop: '', admin: '', b1: '', b2: '', b3: '', d2: '', d3: '', e1: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const s = await newShop();
  F.uid = s.uid;
  F.shop = s.shop;
  F.admin = await newUser('admin');
  await asOwner();
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [F.admin]);
});
after(async () => {
  await db?.close();
});

test('1 · the FIRST dispute is accepted on the spot: waived_import, bill cancelled, the reminder\'s count', async () => {
  const b = await billedBooking(F.shop);
  F.b1 = b.chargeId;
  F.e1 = b.eventId;
  // The couple opened the shop from Explore twice before the booking (the found-record, 20271308941622).
  await db.query(
    `INSERT INTO public.event_vendor_found (event_id, vendor_profile_id, first_found_at, first_source, last_viewed_at, view_count)
     VALUES ($1, $2, now() - interval '20 days', 'explore', now() - interval '19 days', 2)`,
    [b.eventId, F.shop],
  );
  assert.deepEqual(await state(b.chargeId), { charge: 'pending', order: 'submitted' }, 'an open bill to begin with');

  const r = await openDispute(b.chargeId, F.uid);
  assert.equal(r.result, 'auto_accepted');
  assert.equal(r.view_count, 2);
  assert.deepEqual(await state(b.chargeId), { charge: 'waived_import', order: 'cancelled' });
});

test('2 · the SECOND waits for an admin — the charge and its bill are untouched', async () => {
  const b = await billedBooking(F.shop);
  F.b2 = b.chargeId;
  const r = await openDispute(b.chargeId, F.uid, null);
  assert.equal(r.result, 'under_review');
  F.d2 = String(r.dispute_id);
  assert.deepEqual(await state(b.chargeId), { charge: 'pending', order: 'submitted' });
  const reason = await one<string | null>(`SELECT reason FROM public.booking_fee_disputes WHERE dispute_id = $1`, [F.d2]);
  assert.equal(reason, null, 'a blank reason is stored as none, never refused');
});

test('3 · an admin accept waives the fee and cancels the bill; a reject leaves both; a decision is made once', async () => {
  const notAdmin = await decide(F.d2, F.uid, true);
  assert.equal(notAdmin.result, 'not_admin', 'the shop cannot decide its own dispute');
  assert.deepEqual(await state(F.b2), { charge: 'pending', order: 'submitted' });

  const ok = await decide(F.d2, F.admin, true);
  assert.equal(ok.result, 'accepted');
  assert.equal(ok.fee_waived, true);
  assert.deepEqual(await state(F.b2), { charge: 'waived_import', order: 'cancelled' });
  assert.equal((await decide(F.d2, F.admin, false)).result, 'already', 'decided once');

  const b = await billedBooking(F.shop);
  F.b3 = b.chargeId;
  F.d3 = String((await openDispute(b.chargeId, F.uid)).dispute_id);
  assert.equal((await decide(F.d3, F.admin, false)).result, 'rejected');
  assert.deepEqual(await state(b.chargeId), { charge: 'pending', order: 'submitted' }, 'rejected: the bill stands');
});

test('4 · only the shop\'s own account disputes; a paid fee cannot be; asking twice reports the first', async () => {
  const stranger = await newUser('stranger');
  const b = await billedBooking(F.shop);
  assert.equal((await openDispute(b.chargeId, stranger)).result, 'not_yours');
  assert.deepEqual(await state(b.chargeId), { charge: 'pending', order: 'submitted' });

  await asOwner();
  await db.query(`UPDATE public.booking_fee_charges SET status = 'paid', paid_at = now() WHERE charge_id = $1`, [b.chargeId]);
  const paid = await openDispute(b.chargeId, F.uid);
  assert.equal(paid.result, 'not_disputable');

  const again = await openDispute(F.b1, F.uid);
  assert.deepEqual([again.result, again.status], ['already', 'auto_accepted']);
});

test('5 · the shop reads its own disputes; another shop, a couple and anon read none; no session writes or calls', async () => {
  const other = await newShop();
  const count = async () =>
    (await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.booking_fee_disputes WHERE vendor_profile_id = $1`, [F.shop])).rows[0]!.c;

  await asUser(F.uid);
  assert.equal(await count(), 3);
  await asUser(other.uid);
  assert.equal(await count(), 0);
  await asAnon();
  await assert.rejects(count(), /permission denied/);

  await asUser(F.uid);
  await assert.rejects(
    db.query(
      `INSERT INTO public.booking_fee_disputes (charge_id, vendor_profile_id, status, decided_at) VALUES ($1, $2, 'accepted', now())`,
      [F.b3, F.shop],
    ),
    /permission denied/,
  );
  await assert.rejects(db.query(`UPDATE public.booking_fee_disputes SET status = 'accepted' WHERE dispute_id = $1`, [F.d3]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.booking_fee_open_dispute($1, $2, NULL)`, [F.b3, F.uid]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.booking_fee_decide_dispute($1, $2, TRUE, NULL)`, [F.d3, F.uid]), /permission denied/);
  await asOwner();
  assert.deepEqual(await state(F.b3), { charge: 'pending', order: 'submitted' }, 'nothing a session tried moved the bill');

  const t = await one<boolean>(
    `SELECT 'fee_dispute_opened' = ANY (enum_range(NULL::public.notification_type)::text[])
        AND 'fee_dispute_answered' = ANY (enum_range(NULL::public.notification_type)::text[])`,
  );
  assert.equal(t, true);
});

test('6 · a first dispute with no found-record on file is still accepted — the reminder is said without a count', async () => {
  const s = await newShop();
  const b = await billedBooking(s.shop);
  const r = await openDispute(b.chargeId, s.uid);
  assert.equal(r.result, 'auto_accepted');
  assert.equal(r.view_count ?? null, null);
  assert.deepEqual(await state(b.chargeId), { charge: 'waived_import', order: 'cancelled' });
});
