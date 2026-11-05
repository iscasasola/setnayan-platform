/**
 * A MEETING ROOM IS CREATED ONCE, BY SOMEBODY ON THE MEETING — migration 20271311895322, proven as REAL
 * `authenticated` sessions (SET ROLE + JWT claims), never as the superuser the replay otherwise runs as.
 *
 * Owner 2026-11-04 (DECISION_LOG "ONE BUTTON THAT SAYS WHAT THE ROOM NEEDS"), verbatim: "if a link shows. we can
 * have a button conference room created. you can enter. no conference room created, create one". Pressing "Create
 * the room" records `room_created_at` / `room_created_by` on `event_appointments`; after that everyone sees
 * "Enter the room".
 *
 * What is measured — each refusal beside its positive control, each read back OUTSIDE the session:
 *   · the couple (a side of the meeting) creates the room → recorded as THEM and NOW, whatever the client sent;
 *   · an OUTSIDER's identical update touches nothing (the existing UPDATE policies scope the row);
 *   · a SECOND press — by the other side, with forged values — changes nothing (set once);
 *   · a meeting is never born with a room;
 *   · NEUTRALISATION: with the trigger off, the same second press DOES overwrite — so "set once" is this trigger,
 *     not an accident of something else.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TRIGGER = 'event_appointments_room_set_once';
const F = { couple: '', vendorUser: '', outsider: '', vendorId: '', eventId: '', appt: '' };

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}

/** The room columns as the database holds them — read as the superuser, outside any session. */
async function room(id = F.appt): Promise<{ at: string | null; by: string | null }> {
  await reset();
  const r = await db.query<{ at: string | null; by: string | null }>(
    `SELECT room_created_at::text AS at, room_created_by::text AS by FROM public.event_appointments WHERE appointment_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

/** "Create the room" as `uid`, sending the values a client would (or a forger would). Returns rows touched. */
async function press(uid: string, claimedBy: string, claimedAt = '2001-01-01T00:00:00Z', id = F.appt): Promise<number> {
  await asUser(uid);
  try {
    const r = await db.query<{ appointment_id: string }>(
      `UPDATE public.event_appointments SET room_created_at = $2::timestamptz, room_created_by = $3::uuid
        WHERE appointment_id = $1 RETURNING appointment_id`,
      [id, claimedAt, claimedBy],
    );
    return r.rows.length;
  } finally {
    await reset();
  }
}

async function newMeeting(): Promise<string> {
  await reset();
  return (
    await db.query<{ appointment_id: string }>(
      `INSERT INTO public.event_appointments (event_id, vendor_profile_id, kind, type, status, initiated_by, location)
       VALUES ($1, $2, 'video', 'consultation', 'confirmed', 'couple', 'jitsi|https://meet.jit.si/Setnayan-ABCDEFGHJK')
       RETURNING appointment_id`,
      [F.eventId, F.vendorId],
    )
  ).rows[0]!.appointment_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('room-couple@meet.test', 'customer');
  F.vendorUser = await mkUser('room-vendor@meet.test', 'vendor');
  F.outsider = await mkUser('room-outsider@meet.test', 'customer');
  F.vendorId = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Our Photographer')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
      [F.vendorUser],
    )
  ).rows[0]!.vendor_profile_id;
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('The Wedding', 'birthday') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    F.eventId,
    F.couple,
  ]);
  F.appt = await newMeeting();
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('a meeting is born with no room, even when the insert says otherwise', async () => {
  await reset();
  const id = (
    await db.query<{ appointment_id: string }>(
      `INSERT INTO public.event_appointments (event_id, vendor_profile_id, kind, type, status, room_created_at, room_created_by)
       VALUES ($1, $2, 'video', 'consultation', 'confirmed', now(), $3) RETURNING appointment_id`,
      [F.eventId, F.vendorId, F.outsider],
    )
  ).rows[0]!.appointment_id;
  assert.deepEqual(await room(id), { at: null, by: null });
});

test('an OUTSIDER cannot create the room — their update touches nothing', async () => {
  assert.equal(await press(F.outsider, F.outsider), 0, 'an outsider’s update matched the meeting');
  assert.deepEqual(await room(), { at: null, by: null }, 'an outsider set the room');
});

test('a side of the meeting creates it — recorded as THEM and NOW, not what the client sent', async () => {
  const before = Date.now();
  assert.equal(await press(F.couple, F.outsider), 1, 'the couple could not create the room');
  const r = await room();
  assert.equal(r.by, F.couple, 'the room was recorded under the id the client claimed');
  assert.ok(r.at && Date.parse(r.at) >= before - 60_000, `the room kept the client's clock: ${r.at}`);
});

test('a SECOND press changes nothing — set once', async () => {
  const first = await room();
  assert.ok(first.at, 'precondition: the room exists');
  // The couple again, forging the other side and another time.
  await press(F.couple, F.vendorUser, '2030-01-01T00:00:00Z');
  assert.deepEqual(await room(), first, 'a second press rewrote who/when');
});

test('NEUTRALISED: with the trigger off, the same second press DOES overwrite — so the trigger is the rule', async () => {
  const first = await room();
  await reset();
  await db.exec(`ALTER TABLE public.event_appointments DISABLE TRIGGER ${TRIGGER}`);
  try {
    await press(F.couple, F.vendorUser, '2030-01-01T00:00:00Z');
    const r = await room();
    assert.notDeepEqual(r, first, 'even without the trigger the values held — this test proves nothing');
    assert.equal(r.by, F.vendorUser);
  } finally {
    await reset();
    await db.exec(`ALTER TABLE public.event_appointments ENABLE TRIGGER ${TRIGGER}`);
  }
});
