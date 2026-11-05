/**
 * A GUEST WHO KEEPS THEIR INVITATION ASKS THE HOSTS TO CONNECT — the database half (owner 2026-10-21, DECISION_LOG
 * "A GUEST WHO KEEPS THEIR INVITATION ASKS THE HOSTS TO CONNECT — ONE TICK, ON BY DEFAULT"; app half
 * `lib/guest-connects-hosts.server.ts`, guard `lib/a-guest-asks-the-hosts-to-connect.test.ts`).
 *
 * The tick writes nothing new: it hands the ONE writer (`lib/people-connection-request.server.ts`) the exact row the
 * event's Add already writes — pending, unlabelled, `declared_name` set, `created_by_event_id` stamped — under the
 * guest's own session, right after their seat is bound. These tests hold the database to the four things that send
 * relies on, with the guest exactly as the link step leaves them (a `guest` member holding their seat):
 *   · the row is accepted, and the host's Requests read names the event it came from;
 *   · a second ask for the same pair is refused by the database itself (no duplicate request, whatever the app does);
 *   · the order matters — before the seat is bound, the guest may not name the event, so the ask must come AFTER;
 *   · the host's Accept confirms it with NO label (owner 2026-08-21, "add first, label after").
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

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

async function newUser(email: string, name: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [email],
  );
  const id = u.rows[0]!.id;
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, name]);
  return id;
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

async function personOf(uid: string): Promise<string> {
  const r = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1 AND deleted_at IS NULL`,
    [uid],
  );
  assert.equal(r.rows.length, 1, 'every account has its own person row');
  return r.rows[0]!.person_id;
}

/** An event the host made: their `couple` membership, no guest link (the creator's own seat carries none). A
 *  birthday, because a wedding row needs its wedding fields — the ask does not depend on the kind. */
async function newWedding(label: string, host: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [label],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, host],
  );
  return eventId;
}

/** A guest-list row on the event, and — when `bind` — the guest membership the link step writes for it. */
async function seat(eventId: string, uid: string, first: string, bind: boolean): Promise<void> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role)
     VALUES ($1, $2, 'Bernaldo', 'both', 'friends', 'guest'::public.guest_role) RETURNING guest_id`,
    [eventId, first],
  );
  if (!bind) return;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, uid, g.rows[0]!.guest_id],
  );
}

/** The writer's row, exactly: pending, unlabelled, the host's name as the guest's list shows it, the event stamped. */
async function ask(guest: string, host: string, eventId: string, hostName: string) {
  const [from, to] = [await personOf(guest), await personOf(host)];
  return asUser(guest, async () =>
    (await db.query<{ connection_id: string }>(
      `INSERT INTO public.person_connections
         (from_person_id, to_person_id, relation, layer, declared_name, status, created_by_user_id, created_by_event_id)
       VALUES ($1, $2, NULL, NULL, $3, 'pending', $4, $5) RETURNING connection_id`,
      [from, to, hostName, guest, eventId],
    )).rows[0]!.connection_id,
  );
}

test('the ask lands as a pending, unlabelled request — and the host’s Requests read names the event', async () => {
  const host = await newUser('host-a@asks.test', 'Indalecio Casasola');
  const guest = await newUser('guest-a@asks.test', 'Sarah Bernaldo');
  const eventId = await newWedding('Indalecio & Claire', host);
  await seat(eventId, guest, 'Sarah', true);

  const conn = await ask(guest, host, eventId, 'Indalecio Casasola');
  const row = await db.query<{ status: string; relation: string | null; created_by_event_id: string }>(
    `SELECT status, relation, created_by_event_id FROM public.person_connections WHERE connection_id = $1`,
    [conn],
  );
  assert.equal(row.rows[0]!.status, 'pending');
  assert.equal(row.rows[0]!.relation, null, 'the ask carries no label');
  assert.equal(row.rows[0]!.created_by_event_id, eventId);

  const named = await asUser(host, async () =>
    (await db.query<{ connection_id: string; event_name: string; event_type: string }>(
      `SELECT connection_id, event_name, event_type FROM public.connection_request_events()`,
    )).rows,
  );
  assert.deepEqual(
    named.map((r) => [r.connection_id, r.event_name, r.event_type]),
    [[conn, 'Indalecio & Claire', 'birthday']],
    'the host’s row cannot say "from your Indalecio & Claire birthday event"',
  );
});

test('🔴 a second ask for the same pair is refused by the database — never two requests', async () => {
  const host = await newUser('host-d@asks.test', 'Claire');
  const guest = await newUser('guest-d@asks.test', 'Sarah');
  const eventId = await newWedding('Indalecio & Claire', host);
  await seat(eventId, guest, 'Sarah', true);
  await ask(guest, host, eventId, 'Claire');
  await assert.rejects(ask(guest, host, eventId, 'Claire'), /duplicate key|unique/i, 'a second pending ask was stored');
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2 AND deleted_at IS NULL`,
    [await personOf(guest), await personOf(host)],
  );
  assert.equal(n.rows[0]!.n, 1);
});

test('🔴 before the seat is bound the guest may not name the event — the ask must come after the link', async () => {
  const host = await newUser('host-o@asks.test', 'Claire');
  const guest = await newUser('guest-o@asks.test', 'Sarah');
  const eventId = await newWedding('Indalecio & Claire', host);
  await seat(eventId, guest, 'Sarah', false); // on the list, not yet kept in the account
  await assert.rejects(ask(guest, host, eventId, 'Claire'), /belongs to/, 'an unlinked guest stamped the event');
});

test('the host’s Accept connects them with NO label — accepting adds nothing', async () => {
  const host = await newUser('host-c@asks.test', 'Claire');
  const guest = await newUser('guest-c@asks.test', 'Sarah');
  const eventId = await newWedding('Indalecio & Claire', host);
  await seat(eventId, guest, 'Sarah', true);
  const conn = await ask(guest, host, eventId, 'Claire');
  const done = await asUser(host, async () =>
    (await db.query<{ status: string; relation: string | null }>(
      `UPDATE public.person_connections SET status = 'confirmed', confirmed_at = now()
        WHERE connection_id = $1 AND to_person_id = $2 AND status = 'pending'
        RETURNING status, relation`,
      [conn, await personOf(host)],
    )).rows,
  );
  assert.equal(done.length, 1, 'the host could not accept the guest’s ask');
  assert.equal(done[0]!.status, 'confirmed');
  assert.equal(done[0]!.relation, null, 'accepting the ask invented a label');
});
