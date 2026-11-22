/**
 * 💸 "REMIND THE HOSTS" (migrations 20271356585725 + 20271357113669), asserted against the REPLAYED schema, every call
 * through a real `authenticated` session — the same door the coordinator's button calls (`budget/_components/
 * payments-due.tsx`).
 *
 * Owner 2026-11-21 (DECISION_LOG "COORDINATOR: DUE PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT LOGGABLE"): *"the
 * coordinator has the right to remind the hosts that they need to settle something … viewable … but not loggable"*.
 *
 *   1 · the booked coordinator (a seat whose grant gives Payments at View) reminds EVERY host — one in-app
 *       `coordinator_reminded_payment` notice each, opening Budget — and nobody else; no email; and NOTHING about money
 *       moves (no payment, no order, the supplier row unchanged);
 *   2 · once per seat per supplier a day — a second press is refused and writes nothing; a day later it may go again;
 *   3 · refused, writing nothing: a host (they pay), a helper whose seat does not open Payments, a stranger, a guest,
 *       a supplier row of ANOTHER event, a signed-out caller.
 *
 * 🛡 Sabotage (each turns this file red): drop the `moderator_area_level(…'payments') IS NULL` refusal → test 3 (the
 *    helper is let in) · drop the once-a-day check → test 2 · drop the `is_host` refusal → test 3.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const W = {
  eventId: '',
  otherEventId: '',
  creator: '',
  cohost: '',
  coordinator: '',
  coordinatorSeat: '',
  helper: '',
  guest: '',
  stranger: '',
  florist: '',
  otherVendor: '',
};

const NARROW = { edit_all: true, checkout: false, invite_hosts: true, remove_hosts: false };
/** The ruled grant (`COORDINATOR_AREAS`, lib/delegate-areas.ts). */
const RULED = {
  guest_list: 'edit', seat_plan: 'edit', schedule: 'edit', vendors: 'edit', invitations: 'edit',
  mood_board: 'edit', budget: 'view', payments: 'view', photos: null,
};

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
type Answer = { status: string; reminded_at?: string; hosts?: number };
async function remind(uid: string | null, vendorId = W.florist, eventId = W.eventId): Promise<{ r: Answer | null; error: string | null }> {
  if (uid) await asUser(uid);
  else await db.exec(`SET ROLE anon`);
  try {
    const res = await db.query<{ r: Answer }>(`SELECT public.remind_the_hosts_of_a_payment($1, $2) AS r`, [eventId, vendorId]);
    return { r: res.rows[0]!.r, error: null };
  } catch (e) {
    return { r: null, error: (e as Error).message };
  } finally {
    await reset();
  }
}
async function newUser(email: string, name: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, name]);
  return id;
}
async function seat(eventId: string, uid: string, role: string, perms: unknown): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, now()) RETURNING moderator_id`,
    [eventId, role, JSON.stringify(perms), W.creator, uid],
  );
  return r.rows[0]!.moderator_id;
}
async function reminders(): Promise<Array<{ user_id: string; title: string; related_url: string }>> {
  const r = await db.query<{ user_id: string; title: string; related_url: string }>(
    `SELECT user_id, title, related_url FROM public.notifications WHERE type = 'coordinator_reminded_payment' ORDER BY created_at, user_id`,
  );
  return r.rows;
}
async function count(sql: string): Promise<number> {
  return (await db.query<{ n: number }>(sql)).rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  W.creator = await newUser('rth-creator@remind.test', 'Claire');
  W.cohost = await newUser('rth-cohost@remind.test', 'Indalecio');
  W.coordinator = await newUser('rth-coordinator@remind.test', 'Ana');
  W.helper = await newUser('rth-helper@remind.test', 'Tita Lorna');
  W.guest = await newUser('rth-guest@remind.test', 'Gina');
  W.stranger = await newUser('rth-stranger@remind.test', 'Sam');

  W.eventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Claire & Indalecio', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;
  W.otherEventId = (await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Another Event', 'birthday') RETURNING event_id`,
  )).rows[0]!.event_id;

  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [W.eventId, W.creator]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.eventId, W.cohost]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [W.eventId, W.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [W.otherEventId, W.stranger]);

  W.coordinatorSeat = await seat(W.eventId, W.coordinator, 'wedding_planner_external', { ...NARROW, areas: { ...RULED } });
  // A helper whose seat does not open Payments (Budget at View, Payments off).
  await seat(W.eventId, W.helper, 'viewer', { ...NARROW, edit_all: false, areas: { ...RULED, guest_list: 'view', payments: null } });

  W.florist = (await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status) VALUES ($1, 'florist', 'Bloom & Vine', 'deposit_paid') RETURNING vendor_id`,
    [W.eventId],
  )).rows[0]!.vendor_id;
  W.otherVendor = (await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status) VALUES ($1, 'florist', 'Elsewhere Blooms', 'deposit_paid') RETURNING vendor_id`,
    [W.otherEventId],
  )).rows[0]!.vendor_id;
});

after(async () => {
  await replay?.db.close();
});

test('1 · the coordinator reminds EVERY host, in the app — and no money moves', async () => {
  const emails = await count(`SELECT count(*)::int AS n FROM public.email_deliveries`);
  const vendorBefore = (await db.query(`SELECT status, updated_at FROM public.event_vendors WHERE vendor_id = $1`, [W.florist])).rows[0];
  const ordersBefore = await count(`SELECT count(*)::int AS n FROM public.orders`);

  const { r, error } = await remind(W.coordinator);
  assert.equal(error, null, `the coordinator could not remind: ${error}`);
  assert.equal(r?.status, 'ok', `the coordinator was refused: ${JSON.stringify(r)}`);
  assert.equal(r?.hosts, 2, 'not every host was told');

  const rows = await reminders();
  assert.deepEqual(rows.map((n) => n.user_id).sort(), [W.creator, W.cohost].sort(), 'the reminder reached someone who is not a host');
  for (const n of rows) {
    assert.equal(n.title, 'Ana reminds you · Bloom & Vine has a payment due');
    assert.equal(n.related_url, `/dashboard/${W.eventId}/budget?remind=${W.florist}&from=${W.coordinatorSeat}`);
  }
  assert.equal(await count(`SELECT count(*)::int AS n FROM public.email_deliveries`), emails, 'a reminder queued an email');
  assert.equal(await count(`SELECT count(*)::int AS n FROM public.orders`), ordersBefore, 'a reminder wrote an order');
  assert.deepEqual(
    (await db.query(`SELECT status, updated_at FROM public.event_vendors WHERE vendor_id = $1`, [W.florist])).rows[0],
    vendorBefore,
    'a reminder changed the supplier’s booking',
  );
});

test('2 · once per seat per supplier a day — a second press writes nothing; a day later it may go again', async () => {
  const before = (await reminders()).length;
  const again = await remind(W.coordinator);
  assert.equal(again.r?.status, 'already_reminded', `a second reminder the same day went through: ${JSON.stringify(again.r)}`);
  assert.ok(again.r?.reminded_at, 'the refusal does not say when');
  assert.equal((await reminders()).length, before, 'a refused reminder still wrote a notice');

  await db.query(`UPDATE public.notifications SET created_at = created_at - interval '25 hours' WHERE type = 'coordinator_reminded_payment'`);
  assert.equal((await remind(W.coordinator)).r?.status, 'ok', 'the once-a-day rule never lets them remind again');
});

test('3 · refused, writing nothing: a host, a helper without Payments, a stranger, a guest, another event’s supplier, signed out', async () => {
  const before = (await reminders()).length;
  for (const [who, uid, want] of [
    ['a host (they pay)', W.creator, 'is_host'],
    ['a helper whose seat does not open Payments', W.helper, 'no_payments_access'],
    ['a stranger (a host of another event)', W.stranger, 'not_a_helper'],
    ['a guest of this event', W.guest, 'not_a_helper'],
  ] as const) {
    const res = await remind(uid);
    assert.equal(res.error, null, `${who}: ${res.error}`);
    assert.equal(res.r?.status, want, `${who} got ${JSON.stringify(res.r)}`);
  }
  assert.equal((await remind(W.coordinator, W.otherVendor)).r?.status, 'not_this_event', 'another event’s supplier was reminded about');
  const anon = await remind(null);
  assert.ok(anon.error || anon.r?.status === 'not_signed_in', 'a signed-out caller reached the door');
  assert.equal((await reminders()).length, before, 'a refused reminder wrote a notice');
});
