/**
 * SIGNING IN MUST NOT COST YOU YOUR SEAT.
 *
 * Owner, 2026-08-21, after walking it: a guest who signs in and joins should
 * "just confirm if they are coming or not, and get their QR code". They did not
 * — they were sent to a success page whose only way on was "Go to your
 * dashboard", while the guest with NO account was redirected onto the
 * celebration itself and greeted by name. **The one who signed in got the worse
 * ending.**
 *
 * ── WHY THESE ARE DB TESTS AND NOT SOURCE GREPS ─────────────────────────────
 * The fix mints a guest session from the membership row the join just wrote, so
 * `/{slug}` recognises them. Everything that decides whether that is possible is
 * a SCHEMA FACT a grep cannot see:
 *   · does `guests.qr_token` exist for a row the optimistic-admit path inserts,
 *     or is the mint handed a null? (it carries a NOT NULL DEFAULT — proven here,
 *     not assumed);
 *   · does the seat lookup's join actually return the event's `slug`, which is
 *     the redirect target? A grep sees the `.select()` string, never the row;
 *   · do its five closing gates actually CLOSE? Each is a WHERE clause whose
 *     presence a grep can see and whose EFFECT it cannot — and one of them,
 *     `member_type='couple'`, is the guard that keeps an organiser out of the
 *     guest path entirely.
 *
 * ⚠ WHAT THIS CANNOT PROVE. There is no React render harness and no way to run
 * a Server Action here, so "the guest sees their name and their QR" is NOT
 * provable in CI — and prod holds ZERO guest memberships, so it cannot be
 * observed live either until a person walks it. Do not upgrade these to
 * "verified on the live site".
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

async function seedUser(): Promise<string> {
  const email = `seat${seq++}@t.invalid`;
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
    id,
    email,
  ]);
  return id;
}

async function seedEvent(slug: string | null): Promise<string> {
  const { rows } = await db.query<{ event_id: string }>(
    // 🪤 NOT 'wedding' — `events_wedding_fields_consistency` requires a wedding
    // row to carry wedding-only fields this test has no business inventing.
    // The seat lookup is event-type-blind, so a birthday proves the same thing.
    `INSERT INTO public.events (display_name, event_type, event_date, slug)
     VALUES ('Test Celebration', 'birthday', '2027-06-06', $1) RETURNING event_id`,
    [slug],
  );
  return rows[0]!.event_id;
}

/** The exact column set `admitAsUnlisted` inserts — no qr_token among them. */
async function admitUnlisted(eventId: string, name: string): Promise<string> {
  const { rows } = await db.query<{ guest_id: string }>(
    // Copied column-for-column from admitAsUnlisted's own insert — the point of
    // this file is that the row THAT path writes is readable by the seat lookup,
    // so inventing a shorter row would prove something else.
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, rsvp_status,
        meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1, $2, '', 'both', 'other', 'guest', 'pending',
             'no_preference', ARRAY['ceremony','reception'], 'self_added_unlisted', true)
     RETURNING guest_id`,
    [eventId, name],
  );
  return rows[0]!.guest_id;
}

async function bind(eventId: string, userId: string, guestId: string | null, memberType = 'guest') {
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id, role)
     VALUES ($1,$2,$3,$4,'guest')`,
    [eventId, userId, memberType, guestId],
  );
}

/** The exact query pair `findGuestSeatForUser` issues. */
async function lookupSeat(eventId: string, userId: string) {
  const m = await db.query<{ guest_id: string | null }>(
    `SELECT guest_id FROM public.event_members
      WHERE event_id = $1 AND user_id = $2 AND member_type = 'guest'
        AND guest_id IS NOT NULL AND hidden_at IS NULL`,
    [eventId, userId],
  );
  const guestId = m.rows[0]?.guest_id;
  if (!guestId) return null;
  const g = await db.query<{ guest_id: string; qr_token: string | null; slug: string | null }>(
    `SELECT g.guest_id, g.qr_token, e.slug
       FROM public.guests g JOIN public.events e ON e.event_id = g.event_id
      WHERE g.guest_id = $1 AND g.event_id = $2 AND g.deleted_at IS NULL`,
    [guestId, eventId],
  );
  const row = g.rows[0];
  if (!row?.qr_token) return null;
  const slug = row.slug?.trim();
  if (!slug) return null;
  return { guestId: row.guest_id, qrToken: row.qr_token, slug };
}

// ── The mint has the three values it needs ──────────────────────────────────

test('a seat the optimistic-admit path just created yields guest, QR and slug', async () => {
  const eventId = await seedEvent('test-celebration');
  const userId = await seedUser();
  const guestId = await admitUnlisted(eventId, 'Ana');
  await bind(eventId, userId, guestId);

  const seat = await lookupSeat(eventId, userId);
  assert.ok(seat, 'the seat the join just wrote is not readable — the mint would fall back');
  assert.equal(seat!.guestId, guestId);
  assert.equal(seat!.slug, 'test-celebration', 'the redirect target is not what the database holds');
  // 🔑 admitAsUnlisted NEVER inserts a qr_token — the column's DEFAULT is what
  // makes a guest session possible at all for a self-added joiner.
  assert.ok(seat!.qrToken && seat!.qrToken.length >= 16, 'no QR token — the session cannot be signed');
});

// ── Every closing gate must actually close ──────────────────────────────────

test('a guest who left (hidden) is not handed a session', async () => {
  const eventId = await seedEvent('left-event');
  const userId = await seedUser();
  const guestId = await admitUnlisted(eventId, 'Ben');
  await bind(eventId, userId, guestId);
  await db.query(`UPDATE public.event_members SET hidden_at = now() WHERE user_id = $1`, [userId]);
  assert.equal(await lookupSeat(eventId, userId), null, 'leaving the event still yields a seat');
});

test('a guest the host removed is not handed a session', async () => {
  const eventId = await seedEvent('removed-event');
  const userId = await seedUser();
  const guestId = await admitUnlisted(eventId, 'Cara');
  await bind(eventId, userId, guestId);
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [guestId]);
  assert.equal(await lookupSeat(eventId, userId), null, 'an evicted guest still yields a seat');
});

test('🔒 an ORGANISER is never routed through the guest path', async () => {
  // The couple's own ending redirects to their dashboard and must never be
  // rerouted onto their event page, where they get a read-only ribbon whose
  // only way out is the website editor. This filter is the backstop.
  const eventId = await seedEvent('organiser-event');
  const userId = await seedUser();
  const guestId = await admitUnlisted(eventId, 'Host');
  await bind(eventId, userId, guestId, 'couple');
  assert.equal(await lookupSeat(eventId, userId), null, 'an organiser was handed a guest seat');
});

test('a membership with no seat behind it yields nothing', async () => {
  const eventId = await seedEvent('no-seat-event');
  const userId = await seedUser();
  await bind(eventId, userId, null);
  assert.equal(await lookupSeat(eventId, userId), null);
});

test('🔴 an event with no public address yields NOTHING, never "/"', async () => {
  // This is the gate that decides whether the redirect can produce `/null`.
  const eventId = await seedEvent(null);
  const userId = await seedUser();
  const guestId = await admitUnlisted(eventId, 'Dee');
  await bind(eventId, userId, guestId);
  assert.equal(
    await lookupSeat(eventId, userId),
    null,
    'a slug-less event produced a destination — the redirect would be broken',
  );
});

test('…and a blank-ish slug cannot even be stored, so it never reaches the lookup', async () => {
  // 🔑 MEASURED, NOT ASSUMED. The lookup `.trim()`s the slug, which reads like a
  // defence against a whitespace value — but `events_slug_format` REFUSES one at
  // the database, so that branch guards a state the schema makes impossible.
  // Worth pinning: if the constraint is ever loosened, the trim becomes the only
  // thing standing between a guest and a redirect to "/ ".
  await assert.rejects(
    db.query(
      `INSERT INTO public.events (display_name, event_type, event_date, slug)
       VALUES ('Blank', 'birthday', '2027-06-06', '   ')`,
    ),
    'a whitespace slug was accepted — the trim in the lookup is now load-bearing',
  );
});

test('another event’s membership never yields this event’s seat', async () => {
  const a = await seedEvent('event-a');
  const b = await seedEvent('event-b');
  const userId = await seedUser();
  const guestId = await admitUnlisted(a, 'Eve');
  await bind(a, userId, guestId);
  assert.equal(await lookupSeat(b, userId), null, 'a seat at one event unlocked another');
});
