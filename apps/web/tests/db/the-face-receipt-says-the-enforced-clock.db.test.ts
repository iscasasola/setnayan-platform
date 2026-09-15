/**
 * THE DAY THE RECEIPT PRINTS IS THE DAY THE DATABASE'S OWN CLOCK REACHES.
 *
 * ⚠⚠ WHAT A GREEN HERE MEANS — READ THIS BEFORE TRUSTING IT.
 * A pass means: FOR AN ENROLMENT THIS FILE SEEDS, the date the guest's receipt
 * states is the same date the retention clock reaches, computed by Postgres from
 * the seeded event's own columns using the SAME expression the full-resolution
 * floor uses — `GREATEST(COALESCE(event_end_date, event_date), event_date)` plus
 * the grace period the sweep's predicate compares against.
 *
 * A pass does NOT mean a guest has seen a receipt. Measured against production
 * 2026-09-16: `guest_face_enrollments` = 0, `user_face_profiles` = 0, `guests`
 * with `photo_source='selfie'` = 0. NOBODY HAS ENROLLED A FACE — so an assertion
 * of the form "no receipt is wrong" would pass on the empty table it is really
 * describing. Every case below therefore SEEDS its subject and asserts a
 * NON-ZERO positive control first: if the row is not there, the test fails as a
 * broken detector rather than passing as a clean world.
 *
 * A pass also does NOT mean the deletion happens. `face-data-retention` is next
 * due 2026-09-20 and has never recorded an outcome. This file compares two
 * clocks; whether the sweep runs is answered by the job ledger, not here.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { FACE_RECEIPT_GRACE_DAYS, faceDataDeletionDay, faceReceiptLines } from '../../lib/face-receipt';
import { faceDataDeletableFromMs, faceDataIsPastRetention } from '../../lib/face-data-retention-core';

let replay: ReplayResult;
let db: PGlite;

/** A celebration that SPANS DAYS on purpose — a one-day event cannot tell the
 *  difference between reading the start date and reading the last one, which is
 *  exactly why reading only the start date never showed. */
const EVENT_START = '2026-01-01';
const EVENT_END = '2026-01-03';

const F = { eventId: '', guestId: '', selfieRef: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_end_date)
     VALUES ('Face Receipt Clock Test', 'birthday', DATE $1, DATE $2) RETURNING event_id`
      .replace('$1', `'${EVENT_START}'`)
      .replace('$2', `'${EVENT_END}'`),
  );
  F.eventId = e.rows[0]!.event_id;
  F.selfieRef = `r2://setnayan-media/events/${F.eventId}/guest-selfies/x/selfie.jpg`;

  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests
       (event_id, first_name, last_name, side, group_category, role, rsvp_status,
        meal_preference, invited_to_blocks, entry_source, photo_consent,
        photo_url, photo_source)
     VALUES ($1,'Face','Receipt','both','other','guest','attending','no_preference',
             ARRAY['ceremony','reception'],'host_seeded',true,$2,'selfie')
     RETURNING guest_id`,
    [F.eventId, F.selfieRef],
  );
  F.guestId = g.rows[0]!.guest_id;

  await db.query(
    `INSERT INTO public.guest_face_enrollments
       (event_id, guest_id, asset_url, source, consent_at, face_vector, vector_model)
     VALUES ($1,$2,$3,'rsvp_selfie',NOW(),'[0.1,0.2,0.3]'::jsonb,'faceapi-dlib@1')`,
    [F.eventId, F.guestId, F.selfieRef],
  );
});

after(async () => {
  await db?.close();
});

async function one<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  assert.ok(r.rows[0], `query returned no row: ${sql}`);
  return r.rows[0]!;
}

test('ANCHOR — the replay really built the schema', () => {
  assert.ok(replay.applied > 700, `only ${replay.applied} of ${replay.total} migrations applied`);
});

test('POSITIVE CONTROL — there is an enrolment here to be right or wrong about', async () => {
  const row = await one<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.guest_face_enrollments WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(
    row.n,
    1,
    'the seeded enrolment is not in the table, so every assertion below would be ' +
      'describing an empty database — which is what production actually holds. ' +
      'Fix the fixture; do not read the greens under it.',
  );
});

test('the receipt’s date equals the DATABASE’s own retention clock', async () => {
  // Postgres computes it, from the event's real columns, with the expression the
  // full-resolution floor already runs. If the TypeScript in face-receipt.ts ever
  // stops agreeing with the SQL, this is where it shows.
  const expected = await one<{ day: string; last_day: string }>(
    `SELECT to_char(
              GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date)
                + ($2::int),
              'FMDD FMMonth YYYY') AS day,
            GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date)::text AS last_day
       FROM public.events e WHERE e.event_id = $1`,
    [F.eventId, FACE_RECEIPT_GRACE_DAYS],
  );
  assert.equal(
    expected.last_day,
    EVENT_END,
    'the database does not treat the end date as the last day — the premise is wrong',
  );

  const dates = await one<{ event_date: string | null; event_end_date: string | null }>(
    `SELECT event_date::text AS event_date, event_end_date::text AS event_end_date
       FROM public.events WHERE event_id = $1`,
    [F.eventId],
  );
  const printed = faceDataDeletionDay(dates.event_date, dates.event_end_date);
  assert.equal(
    printed,
    expected.day,
    `the receipt tells the guest ${printed}; the clock in the database reaches ` +
      `${expected.day}. A receipt is a written commitment — this is the gap that turns ` +
      'a missing promise into a broken one.',
  );

  // And the sentence she actually reads carries that date, not just the helper.
  const howLong = faceReceiptLines({
    faceMode: 'mode_a',
    eventWord: 'celebration',
    theOrganizer: 'the celebrant',
    eventDate: dates.event_date,
    eventEndDate: dates.event_end_date,
  }).find((l) => l.key === 'how_long')!.body;
  assert.ok(
    howLong.includes(expected.day),
    `the rendered line does not contain ${expected.day}: "${howLong}"`,
  );
  // POSITIVE CONTROL for that inclusion check — it must be able to miss.
  assert.ok(!howLong.includes('1 January 1970'), 'the inclusion check accepts anything');
});

test('the printed day is the first day the sweep’s predicate turns true', async () => {
  const dates = await one<{ event_date: string | null; event_end_date: string | null }>(
    `SELECT event_date::text AS event_date, event_end_date::text AS event_end_date
       FROM public.events WHERE event_id = $1`,
    [F.eventId],
  );
  const boundary = faceDataDeletableFromMs(dates.event_date, dates.event_end_date);
  assert.ok(boundary !== null, 'the seeded event has no readable clock');

  // NOT past, one millisecond before. Past, at it. The receipt's date is the
  // UTC day of that boundary, so the guest's date and the sweep's date are one.
  assert.equal(
    faceDataIsPastRetention(dates.event_date, dates.event_end_date, boundary! - 1),
    false,
    'the sweep would delete a day early — the receipt promises longer than the code keeps',
  );
  assert.equal(
    faceDataIsPastRetention(dates.event_date, dates.event_end_date, boundary!),
    true,
    'the clock the receipt states never runs out — a promise nothing keeps',
  );
  assert.equal(
    new Date(boundary!).toISOString().slice(0, 10),
    await one<{ d: string }>(
      `SELECT (GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date) + ($2::int))::text AS d
         FROM public.events e WHERE e.event_id = $1`,
      [F.eventId, FACE_RECEIPT_GRACE_DAYS],
    ).then((r) => r.d),
    'the boundary instant and the printed day are different days',
  );
});

test('the seeded row is exactly what the receipt says we hold', async () => {
  // "the selfie, a face vector, and a note of the moment you agreed" — checked
  // against the columns the enrolment write actually fills, not against a doc.
  const row = await one<{
    asset_url: string | null;
    face_vector: unknown;
    consent_at: string | null;
  }>(
    `SELECT asset_url, face_vector, consent_at::text AS consent_at
       FROM public.guest_face_enrollments WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(row.asset_url, F.selfieRef, 'no selfie ref — the receipt names one');
  assert.ok(row.face_vector !== null, 'no vector on a mode_a-shaped row — the receipt names one');
  assert.ok(row.consent_at, 'no consent timestamp — the receipt says we note when she agreed');
});
