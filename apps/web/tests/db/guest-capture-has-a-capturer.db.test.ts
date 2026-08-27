/**
 * A GUEST'S CAPTURE RECORDS WHICH PERSON TOOK IT — AND THE VALUE IS DERIVED.
 *
 * `papic_photos.captured_by_person_id` got a writer on 2026-08-26, so "each
 * person's own folder" worked for the cameras. `papic_guest_captures` — the
 * separate table a guest phone's captures live in, which nothing copies between
 * — had no capturer column at all. Migration 20271171474426 is the other half.
 *
 * ── THE FAILURE THIS FILE EXISTS FOR ───────────────────────────────────────
 * 🔑 A COLUMN WITH NO WRITER IS THE SHAPE THIS PROJECT KEEPS PAYING FOR. Five
 * gates with no handle; one column that sat unread for seven weeks while the
 * feature it controlled was believed to be running; and this column's own twin,
 * which had a partial index and a reader that grouped by it and **never held a
 * value in production, not one row, ever**. So rule 2 does not check that the
 * trigger EXISTS — it inserts a capture and reads the column back.
 *
 * ── AND THE VALUE MUST NOT BE ACCEPTED FROM A CALLER ───────────────────────
 * 🚨 `anon` AND `authenticated` HOLD UPDATE ON THIS TABLE AT TABLE LEVEL, so the
 * new column arrives writable by a browser. The trigger is the only thing
 * standing between that and somebody's name on a photograph they did not take.
 * Rules 3 and 4 are that: a named value is replaced, and a capture cannot be
 * moved onto another guest to be re-credited.
 *
 * ⚠ WHAT THIS DOES *NOT* PROVE. The replay runs as superuser, so nothing here
 * shows a browser being refused at runtime — it shows the trigger overwriting
 * whatever it is handed, which is the control that actually holds either way
 * (unlike an RLS predicate, a BEFORE trigger applies to every writer including
 * the service role).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let n = 0;

/**
 * One event, one person, one guest linked to that person, one guest with no
 * person at all.
 *
 * ⚠ THE LINK IS MADE BY EMAIL, NOT BY WRITING `person_id`. `set_guest_person`
 * — shipped 20270514555975 — resolves it on insert. Setting the column by hand
 * would test my fixture instead of the mechanism the product actually uses, and
 * would hide the day that resolver stops running.
 */
async function seed(): Promise<{
  eventId: string;
  personId: string;
  linkedGuestId: string;
  strangerGuestId: string;
}> {
  n += 1;
  const email = `capturer-${n}@example.test`;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Capturer test', 'birthday', CURRENT_DATE + 30) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  const p = await db.query<{ person_id: string }>(
    `INSERT INTO public.people (display_name, email) VALUES ($1, $2) RETURNING person_id`,
    [`Capturer ${n}`, email],
  );
  const personId = p.rows[0]!.person_id;

  const linked = await db.query<{ guest_id: string; person_id: string | null }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, email, side, group_category, role,
        rsvp_status, meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1, $2, 'Tester', $3, 'both', 'other', 'guest', 'pending',
             'no_preference', ARRAY['ceremony'], 'host_seeded', true)
     RETURNING guest_id, person_id`,
    [eventId, `Capturer${n}`, email],
  );
  const stranger = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role,
        rsvp_status, meal_preference, invited_to_blocks, entry_source, photo_consent)
     VALUES ($1, $2, 'Stranger', 'both', 'other', 'guest', 'pending',
             'no_preference', ARRAY['ceremony'], 'host_seeded', true)
     RETURNING guest_id`,
    [eventId, `Nobody${n}`],
  );

  // Anti-vacuity: if the shipped email resolver ever stops linking, every rule
  // below would pass by reading NULL out of a column that is working correctly.
  assert.equal(
    linked.rows[0]!.person_id,
    personId,
    'set_guest_person did not link the guest to the person by email — the ' +
      'resolution this column depends on is not running, so the rules below ' +
      'would be asserting NULL against NULL',
  );

  return {
    eventId,
    personId,
    linkedGuestId: linked.rows[0]!.guest_id,
    strangerGuestId: stranger.rows[0]!.guest_id,
  };
}

const capturerOf = async (captureId: string): Promise<string | null> => {
  const { rows } = await db.query<{ captured_by_person_id: string | null }>(
    `SELECT captured_by_person_id FROM public.papic_guest_captures WHERE capture_id = $1`,
    [captureId],
  );
  return rows[0]?.captured_by_person_id ?? null;
};

async function capture(eventId: string, guestId: string, key: string): Promise<string> {
  const { rows } = await db.query<{ capture_id: string }>(
    `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key)
     VALUES ($1, $2, $3) RETURNING capture_id`,
    [eventId, guestId, key],
  );
  return rows[0]!.capture_id;
}

test('1 · the column and its trigger both exist', async () => {
  const { rows: cols } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'papic_guest_captures'
        AND column_name = 'captured_by_person_id'`,
  );
  assert.equal(cols[0]?.n, 1, 'papic_guest_captures.captured_by_person_id is gone');

  const { rows: trg } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = 'papic_guest_captures'
        AND t.tgname = 'stamp_guest_capturer_person' AND NOT t.tgisinternal`,
  );
  assert.equal(
    trg[0]?.n,
    1,
    'the stamp_guest_capturer_person trigger is gone — the column then has no ' +
      'writer, and a column with no writer looks exactly like a feature nobody uses',
  );
});

test('2 · 🚨 a real capture comes back CREDITED — not merely triggered', async () => {
  const { eventId, personId, linkedGuestId } = await seed();
  const id = await capture(eventId, linkedGuestId, 'r2://guest-1.jpg');
  assert.equal(
    await capturerOf(id),
    personId,
    'the capture was not credited. Its twin shipped a column, a partial index ' +
      'and a reader, and held a value on ZERO rows in production for three ' +
      'months while looking like a feature nobody used.',
  );
});

test('3 · a guest with no person in the spine credits NOBODY, not a guess', async () => {
  const { eventId, strangerGuestId } = await seed();
  const id = await capture(eventId, strangerGuestId, 'r2://guest-2.jpg');
  assert.equal(
    await capturerOf(id),
    null,
    'an unresolvable guest was credited to somebody. NULL is the honest answer ' +
      'for a guest whose email has never matched a person — which is every ' +
      'guest in production today.',
  );
});

test('4 · 🚨 a value the caller NAMES is replaced, on insert and on update', async () => {
  const { eventId, personId, linkedGuestId, strangerGuestId } = await seed();

  // Somebody else's person id, posted straight onto the insert.
  const other = await db.query<{ person_id: string }>(
    `INSERT INTO public.people (display_name) VALUES ('Not the capturer') RETURNING person_id`,
  );
  const { rows } = await db.query<{ capture_id: string }>(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, captured_by_person_id)
     VALUES ($1, $2, 'r2://forged.jpg', $3) RETURNING capture_id`,
    [eventId, linkedGuestId, other.rows[0]!.person_id],
  );
  const id = rows[0]!.capture_id;
  assert.equal(
    await capturerOf(id),
    personId,
    "a caller's own value survived the insert — anybody holding UPDATE on this " +
      'table could then put their name on a photograph they did not take',
  );

  // …and PATCHed afterwards.
  await db.query(
    `UPDATE public.papic_guest_captures SET captured_by_person_id = $1 WHERE capture_id = $2`,
    [other.rows[0]!.person_id, id],
  );
  assert.equal(await capturerOf(id), personId, 'a PATCH of the column was honoured');

  // …and the derivation's INPUT is pinned too, which is the subtler one: an
  // honest derivation from a forged input is still a lie. Moving the capture
  // onto a different guest would otherwise re-credit it to that guest.
  await db.query(
    `UPDATE public.papic_guest_captures SET guest_id = $1 WHERE capture_id = $2`,
    [strangerGuestId, id],
  );
  const { rows: after } = await db.query<{ guest_id: string }>(
    `SELECT guest_id FROM public.papic_guest_captures WHERE capture_id = $1`,
    [id],
  );
  assert.equal(
    after[0]?.guest_id,
    linkedGuestId,
    'a capture was moved onto another guest. Nothing in the product does that, ' +
      'and allowing it makes the credit forgeable one column over — exactly the ' +
      'hole an adversarial pass found in the seat version of this trigger.',
  );
  assert.equal(await capturerOf(id), personId, 'the credit followed a move that should not have happened');
});

test('5 · 🪤 the trigger never asks `current_user` who the caller is', () => {
  /*
    Inside a SECURITY DEFINER function `current_user` is the function's OWNER,
    never the caller — so a gate written with it can never be true and the pin
    silently never fires. The seat version shipped exactly that in its first cut:
    the forgery test moved the photo and the trigger watched. Second time.

    ⚠ SCOPED TO THE DOLLAR-QUOTED BODY, and that is not fussiness. The twin of
    this rule matched the whole tail of its migration and went red on the
    `COMMENT ON FUNCTION` beside it — a SQL string literal explaining the very
    trap. Prose describing a rule is not a violation of it.
  */
  const src = readFileSync(
    new URL(
      '../../../../supabase/migrations/20271171474426_guest_capture_has_a_capturer.sql',
      import.meta.url,
    ),
    'utf8',
  );
  const body = /\$function\$([\s\S]*?)\$function\$/.exec(src)?.[1] ?? '';
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');

  assert.ok(
    stripped.includes('captured_by_person_id'),
    'the trigger function body could not be located in the migration — this rule is vacuous',
  );
  assert.equal(
    /\bcurrent_user\b/.test(stripped),
    false,
    'tg_stamp_guest_capturer_person uses current_user. Inside a SECURITY ' +
      "DEFINER function that is the function's OWNER, never the caller — the " +
      'pin would silently never fire.',
  );
});
