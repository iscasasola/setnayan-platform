/**
 * 🔒 ONLY A HOST BOOKS — AT THE DATABASE · AN UNBOOKED COORDINATOR LEAVES
 * (ship review of #8094, 21 Nov 2026, FIX-FIRST 1 and 2; owner 2026-11-21 "no booking, no paying").
 * Migration `only_a_host_books_and_an_unbooked_coordinator_leaves`, driven on the TABLE the way PostgREST would.
 *   1 · a coordinator whose seat gives `vendors = edit` cannot move a supplier INTO booked, by UPDATE or by INSERT —
 *       the action's check was the only one; a host still books; a booked row still moves along (delivered);
 *   2 · the seat a booking opened closes when that booking leaves booked — and ONLY that seat: one a host added by
 *       hand stays, and another booking's seat stays;
 *   3 · deleting the booking closes its seat too.
 * Every case asserts a VALUE (a status, a removed_at, an error name), never only a row count.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    await setAuthUid(db, uid);
    await db.exec('SET ROLE authenticated');
    return await fn();
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null);
  }
}
async function refusal(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return '';
  } catch (e) {
    return (e as Error).message;
  }
}
async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [`${tag}-${++n}@only-a-host.test`],
  );
  return r.rows[0]!.id;
}
async function world() {
  const host = await newUser('host');
  const planner = await newUser('planner');
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Reyes celebration', 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host]);
  return { eventId, host, planner };
}
async function supplierRow(eventId: string, status: string, name = 'Blooms & Co.'): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status) VALUES ($1, 'misc', $2, $3) RETURNING vendor_id`,
    [eventId, name, status],
  );
  return r.rows[0]!.vendor_id;
}
async function seat(eventId: string, uid: string, openedBy: string | null): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at, opened_by_event_vendor_id)
     VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, NOW(), $4) RETURNING moderator_id`,
    [eventId, uid, JSON.stringify({ areas: { vendors: 'edit', guest_list: 'edit' } }), openedBy],
  );
  return r.rows[0]!.moderator_id;
}
const statusOf = async (id: string) =>
  (await db.query<{ s: string }>(`SELECT status::text AS s FROM public.event_vendors WHERE vendor_id = $1`, [id])).rows[0]?.s ?? null;
const seatOf = async (id: string) =>
  (await db.query<{ removed: boolean; reason: string | null }>(
    `SELECT removed_at IS NOT NULL AS removed, removal_reason AS reason FROM public.event_moderators WHERE moderator_id = $1`,
    [id],
  )).rows[0]!;

test('1 · a coordinator with Suppliers at Edit cannot book — the hosts can; a booked row still moves along', async () => {
  const { eventId, host, planner } = await world();
  const row = await supplierRow(eventId, 'considering');
  await seat(eventId, planner, null);

  // Their seat really does let them write the row (so the refusal below is the trigger's, not RLS's).
  await as(planner, () => db.query(`UPDATE public.event_vendors SET vendor_name = 'Blooms and Co.' WHERE vendor_id = $1`, [row]));
  assert.equal(
    (await db.query<{ v: string }>(`SELECT vendor_name AS v FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.v,
    'Blooms and Co.',
    'the coordinator can edit a supplier row — the fixture gives vendors = edit',
  );

  for (const to of ['contracted', 'deposit_paid', 'delivered', 'complete']) {
    const err = await refusal(() => as(planner, () => db.query(`UPDATE public.event_vendors SET status = $2 WHERE vendor_id = $1`, [row, to])));
    assert.match(err, /ONLY_A_HOST_BOOKS/, `a coordinator must not move a supplier to ${to}`);
  }
  assert.equal(await statusOf(row), 'considering', 'nothing moved');

  const born = await refusal(() =>
    as(planner, () =>
      db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, status) VALUES ($1, 'misc', 'Born booked', 'contracted')`, [eventId]),
    ),
  );
  assert.match(born, /ONLY_A_HOST_BOOKS/, 'nor add a supplier already booked');

  await as(host, () => db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [row]));
  assert.equal(await statusOf(row), 'contracted', 'a host books');

  // Moving a BOOKED row along is not booking.
  await as(planner, () => db.query(`UPDATE public.event_vendors SET status = 'delivered' WHERE vendor_id = $1`, [row]));
  assert.equal(await statusOf(row), 'delivered');
});

test('2 · a cancelled booking closes the seat it opened — and only that one', async () => {
  const { eventId, planner } = await world();
  const friend = await newUser('friend');
  const other = await newUser('other-planner');
  const booking = await supplierRow(eventId, 'deposit_paid', 'Coordination by Ana');
  const otherBooking = await supplierRow(eventId, 'deposit_paid', 'Second planner');
  const opened = await seat(eventId, planner, booking);
  const byHand = await seat(eventId, friend, null);
  const othersSeat = await seat(eventId, other, otherBooking);

  // Booked → still booked: nothing closes.
  await db.query(`UPDATE public.event_vendors SET status = 'delivered' WHERE vendor_id = $1`, [booking]);
  assert.equal((await seatOf(opened)).removed, false, 'a booking that moves along keeps its seat');

  await db.query(`UPDATE public.event_vendors SET status = 'considering' WHERE vendor_id = $1`, [booking]);
  assert.deepEqual(await seatOf(opened), { removed: true, reason: 'booking_cancelled' });
  assert.equal((await seatOf(byHand)).removed, false, 'a seat a host added by hand stays');
  assert.equal((await seatOf(othersSeat)).removed, false, 'another booking’s seat stays');
  const member = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, planner],
  );
  assert.equal(member.rows[0]!.n, 0, 'and they are no longer a member of the event');
});

test('3 · deleting the booking closes its seat', async () => {
  const { eventId, planner } = await world();
  const booking = await supplierRow(eventId, 'contracted', 'Coordination by Ana');
  const opened = await seat(eventId, planner, booking);
  await db.query(`DELETE FROM public.event_vendors WHERE vendor_id = $1`, [booking]);
  assert.deepEqual(await seatOf(opened), { removed: true, reason: 'booking_cancelled' });
});
