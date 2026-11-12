/**
 * A SUPPLIER SETS A MEETING ON AN OPEN CHAT — migration 20271340846228, proven as REAL `authenticated` sessions
 * (SET ROLE + JWT claims), never as the superuser the replay otherwise runs as.
 *
 * Owner, 12 Nov 2026: *"other (+) tools cannot add schedule"* · *"It is not synching properly with schedules"* — and,
 * asked whether a supplier may set a meeting before the couple books: *"Yes, before booking"*. The supplier's (+)
 * offered Meeting on every open chat while `event_appointments_vendor_insert` admitted booked events only, so the
 * insert was refused and the card vanished.
 *
 * What is measured — each refusal beside its positive control, each write read back OUTSIDE the session:
 *   · the supplier proposes a meeting tied to their OPEN chat, unbooked → it is written;
 *   · the same meeting with NO chat on it → refused (the open chat is the only new door);
 *   · tied to a chat that is still PENDING → refused;
 *   · tied to ANOTHER supplier's open chat on the same event → refused;
 *   · the supplier answers (confirms) the couple's meeting on the open chat → one row; the same on a row with no chat → none;
 *   · NEUTRALISED: the booked door is unchanged — once booked, a meeting with no chat is written.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  couple: '',
  vendorUser: '',
  rivalUser: '',
  vendorId: '',
  rivalId: '',
  eventId: '',
  pendingEventId: '',
  openThread: '',
  pendingThread: '',
  rivalThread: '',
};

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

/** The supplier proposes a meeting as THEIR session — returns the new id, or throws the database's refusal. */
async function supplierProposes(eventId: string, threadId: string | null): Promise<string> {
  await asUser(F.vendorUser);
  try {
    const r = await db.query<{ appointment_id: string }>(
      `INSERT INTO public.event_appointments
         (event_id, vendor_profile_id, thread_id, kind, type, custom_label, scheduled_at, status, initiated_by, proposed_by_user_id)
       VALUES ($1, $2, $3, 'in_person', 'custom', 'Tasting', now() + interval '3 days', 'proposed', 'vendor', $4)
       RETURNING appointment_id`,
      [eventId, F.vendorId, threadId, F.vendorUser],
    );
    return r.rows[0]!.appointment_id;
  } finally {
    await reset();
  }
}

/** Does the row exist — read as the superuser, outside any session. */
async function exists(id: string): Promise<boolean> {
  await reset();
  const r = await db.query(`SELECT 1 FROM public.event_appointments WHERE appointment_id = $1`, [id]);
  return r.rows.length === 1;
}

/** A meeting the COUPLE proposed (written as the superuser — the couple's own door is not under test here). */
async function coupleMeeting(threadId: string | null): Promise<string> {
  await reset();
  return (
    await db.query<{ appointment_id: string }>(
      `INSERT INTO public.event_appointments (event_id, vendor_profile_id, thread_id, kind, type, scheduled_at, status, initiated_by)
       VALUES ($1, $2, $3, 'in_person', 'consultation', now() + interval '4 days', 'proposed', 'couple') RETURNING appointment_id`,
      [F.eventId, F.vendorId, threadId],
    )
  ).rows[0]!.appointment_id;
}

/** The supplier confirms a meeting as THEIR session — returns rows touched. */
async function supplierConfirms(id: string): Promise<number> {
  await asUser(F.vendorUser);
  try {
    const r = await db.query(
      `UPDATE public.event_appointments SET status = 'confirmed' WHERE appointment_id = $1 AND status = 'proposed' RETURNING appointment_id`,
      [id],
    );
    return r.rows.length;
  } finally {
    await reset();
  }
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
  F.couple = await mkUser('open-chat-couple@meet.test', 'customer');
  F.vendorUser = await mkUser('open-chat-vendor@meet.test', 'vendor');
  F.rivalUser = await mkUser('open-chat-rival@meet.test', 'vendor');
  const mkProfile = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  F.vendorId = await mkProfile(F.vendorUser, 'Our Caterer');
  F.rivalId = await mkProfile(F.rivalUser, 'Another Caterer');
  const mkEvent = async (name: string) => {
    const id = (
      await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`, [name])
    ).rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, F.couple]);
    return id;
  };
  F.eventId = await mkEvent('The Wedding');
  F.pendingEventId = await mkEvent('The Other Party');
  const mkThread = async (eventId: string, vendorId: string, status: 'accepted' | 'pending') =>
    (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1, $2, $3, $4) RETURNING thread_id`,
        [eventId, vendorId, F.couple, status],
      )
    ).rows[0]!.thread_id;
  F.openThread = await mkThread(F.eventId, F.vendorId, 'accepted');
  F.pendingThread = await mkThread(F.pendingEventId, F.vendorId, 'pending');
  F.rivalThread = await mkThread(F.eventId, F.rivalId, 'accepted');
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the supplier proposes a meeting on their OPEN chat before any booking — it is written', async () => {
  const id = await supplierProposes(F.eventId, F.openThread);
  assert.ok(await exists(id), 'the meeting on the open chat was not written');
});

test('the same meeting with NO chat on it is refused — the open chat is the only new door', async () => {
  await assert.rejects(supplierProposes(F.eventId, null), /row-level security/);
});

test('a meeting tied to a chat still PENDING is refused', async () => {
  await assert.rejects(supplierProposes(F.pendingEventId, F.pendingThread), /row-level security/);
});

test('a meeting tied to ANOTHER supplier’s open chat on the same event is refused', async () => {
  await assert.rejects(supplierProposes(F.eventId, F.rivalThread), /row-level security/);
});

test('the supplier answers the couple’s meeting on the open chat — and cannot on a row with no chat', async () => {
  const onChat = await coupleMeeting(F.openThread);
  assert.equal(await supplierConfirms(onChat), 1, 'the supplier could not confirm the couple’s meeting on the open chat');
  const noChat = await coupleMeeting(null);
  assert.equal(await supplierConfirms(noChat), 0, 'an unbooked supplier confirmed a meeting tied to no chat');
});

test('NEUTRALISED: the booked door is unchanged — once booked, a meeting with no chat is written', async () => {
  await reset();
  // Only a verified supplier can be booked (the booking guard) — verify ours first, as a booking would find it.
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = now() WHERE vendor_profile_id = $1`, [
    F.vendorId,
  ]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status)
     VALUES ($1, 'photographer', 'Our Caterer', $2, 'contracted')`,
    [F.eventId, F.vendorId],
  );
  const id = await supplierProposes(F.eventId, null);
  assert.ok(await exists(id), 'a booked supplier could not set a meeting without a chat');
});
