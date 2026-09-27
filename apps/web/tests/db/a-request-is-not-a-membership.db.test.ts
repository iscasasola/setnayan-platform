/**
 * 🛂 A REQUEST IS NOT A MEMBERSHIP (guest pathway, owner DECISION_LOG
 * 2026-09-26: "NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE LINKS OR
 * ACCEPTS THEM" · "AN UNLISTED PERSON'S ACCOUNT DOES NOT SHOW THE EVENT").
 *
 * The schema half of `app/join/[eventId]/actions.ts` → `createJoinRequest` and
 * `lib/guest-request-key.ts` → `issueRequestKey`, against the replayed
 * migrations — the facts a source grep cannot see:
 *
 *   · the request row, with the exact columns the join door writes, is legal;
 *   · a signed-in asker is remembered in `guest_claims` (upsert on
 *     `(event_id, claimer_user_id)`), and asking again re-opens ONE claim;
 *   · until Keep/Link the asker holds NO `event_members` row — the event
 *     picker, the RLS helpers and every "your events" read start there;
 *   · the email fast path (`host_seeded` only) cannot reach a request row even
 *     when it carries the asker's own address;
 *   · Keep's bind (`joined_via = 'invite_claim'`) is a value the enum accepts —
 *     a rejected insert here would be a key that silently never arrives.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

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

async function seedUser(): Promise<{ id: string; email: string }> {
  const email = `asker${seq++}@t.invalid`;
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  return { id, email };
}

async function seedEvent(slug: string): Promise<string> {
  const { rows } = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, slug)
     VALUES ('Test Celebration', 'birthday', '2027-06-06', $1) RETURNING event_id`,
    [slug],
  );
  return rows[0]!.event_id;
}

/** The exact column set `createJoinRequest` inserts. */
async function request(eventId: string, name: string, email: string | null): Promise<string> {
  const { rows } = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, invited_to_blocks,
        entry_source, email, rsvp_status, rsvp_responded_at, meal_preference,
        dietary_restrictions, guest_note, mobile, notes, updated_at)
     VALUES ($1, $2, '—', 'both', 'other', 'guest', ARRAY['ceremony','reception'],
             'self_added_unlisted', $3, 'attending', now(), 'fish',
             'nuts', 'see you', '+639171234421', 'Asked for 2 seats.', now())
     RETURNING guest_id`,
    [eventId, name, email],
  );
  return rows[0]!.guest_id;
}

/** The exact upsert `createJoinRequest` makes for a signed-in asker. */
async function remember(eventId: string, userId: string, name: string, email: string, target: string) {
  await db.query(
    `INSERT INTO public.guest_claims
       (event_id, claimer_user_id, claimer_name, claimer_email,
        target_guest_id, status, resolved_guest_id, reviewed_at, reviewed_by_user_id,
        last_claim_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,'pending_review',NULL,NULL,NULL,now(),now())
     ON CONFLICT (event_id, claimer_user_id) DO UPDATE SET
       claimer_name = EXCLUDED.claimer_name, claimer_email = EXCLUDED.claimer_email,
       target_guest_id = EXCLUDED.target_guest_id, status = EXCLUDED.status,
       resolved_guest_id = NULL, reviewed_at = NULL, reviewed_by_user_id = NULL,
       last_claim_at = EXCLUDED.last_claim_at, updated_at = EXCLUDED.updated_at`,
    [eventId, userId, name, email, target],
  );
}

const memberships = async (eventId: string, userId: string) =>
  (await db.query(`SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [eventId, userId])).rows
    .length;

test('a signed-in request is a guest row + a remembered claim — and NO membership', async () => {
  const eventId = await seedEvent('ask-one');
  const u = await seedUser();
  const reqId = await request(eventId, 'Carla', u.email);
  await remember(eventId, u.id, 'Carla', u.email, reqId);

  const claim = await db.query<{ status: string; target_guest_id: string }>(
    `SELECT status::text, target_guest_id FROM public.guest_claims WHERE event_id = $1 AND claimer_user_id = $2`,
    [eventId, u.id],
  );
  assert.equal(claim.rows[0]?.status, 'pending_review');
  assert.equal(claim.rows[0]?.target_guest_id, reqId);
  assert.equal(await memberships(eventId, u.id), 0, 'asking made a membership — the event would show in their account');
});

test('asking again re-opens the ONE claim (a Removed asker can ask once more), never a second', async () => {
  const eventId = await seedEvent('ask-two');
  const u = await seedUser();
  const first = await request(eventId, 'Ben', u.email);
  await remember(eventId, u.id, 'Ben', u.email, first);
  await db.query(`UPDATE public.guest_claims SET status = 'rejected' WHERE claimer_user_id = $1`, [u.id]);
  const second = await request(eventId, 'Ben', u.email);
  await remember(eventId, u.id, 'Ben', u.email, second);
  const rows = await db.query<{ status: string; target_guest_id: string }>(
    `SELECT status::text, target_guest_id FROM public.guest_claims WHERE event_id = $1 AND claimer_user_id = $2`,
    [eventId, u.id],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]!.status, 'pending_review');
  assert.equal(rows.rows[0]!.target_guest_id, second);
});

test('🛂 the email fast path cannot reach a request carrying the asker’s own address', async () => {
  const eventId = await seedEvent('ask-three');
  const u = await seedUser();
  await request(eventId, 'Jomar', u.email);
  // The exact read `joinEventAction` and `join-flow.tsx` make.
  const seeded = await db.query(
    `SELECT guest_id FROM public.guests
      WHERE event_id = $1 AND entry_source = 'host_seeded' AND email ILIKE $2 AND deleted_at IS NULL`,
    [eventId, u.email],
  );
  assert.equal(seeded.rows.length, 0, 'a request row can be bound by the email its asker typed');
});

test('Keep issues the key: the bind Keep writes is legal, and the claim closes', async () => {
  const eventId = await seedEvent('ask-four');
  const u = await seedUser();
  const reqId = await request(eventId, 'Ana', u.email);
  await remember(eventId, u.id, 'Ana', u.email, reqId);
  // keepGuestAction promotes the row …
  await db.query(`UPDATE public.guests SET entry_source = 'host_seeded' WHERE guest_id = $1`, [reqId]);
  // … and issueRequestKey binds the remembered account (its exact insert).
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, role, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest', 'invite_claim', $3)`,
    [eventId, u.id, reqId],
  );
  await db.query(
    `UPDATE public.guest_claims SET status = 'confirmed', resolved_guest_id = $2, reviewed_at = now()
      WHERE event_id = $1 AND target_guest_id = $2 AND status = 'pending_review'`,
    [eventId, reqId],
  );
  assert.equal(await memberships(eventId, u.id), 1, 'Keep did not put the event in their account');
  const qr = await db.query<{ qr_token: string | null }>(`SELECT qr_token FROM public.guests WHERE guest_id = $1`, [reqId]);
  assert.ok((qr.rows[0]?.qr_token ?? '').length >= 16, 'the kept row has no key to send');
  const claim = await db.query<{ status: string }>(`SELECT status::text FROM public.guest_claims WHERE claimer_user_id = $1`, [u.id]);
  assert.equal(claim.rows[0]?.status, 'confirmed');
});

test('an accountless request (no claim) is legal with only a mobile, and binds nobody', async () => {
  const eventId = await seedEvent('ask-five');
  const reqId = await request(eventId, 'Lola', null);
  const m = await db.query(`SELECT 1 FROM public.event_members WHERE guest_id = $1`, [reqId]);
  assert.equal(m.rows.length, 0);
});
