/**
 * `papic_photos.captured_by_person_id` HAS A WRITER NOW.
 *
 * 🚨 MEASURED IN PRODUCTION 2026-08-26: 14 photos · 14 carry a seat · 14 have a
 * claimer whose person row resolves right now · and **0 carry the value**. The
 * column, its partial index, and the reader in lib/life-story-moment-graph.ts
 * that groups a person's own-event frames by capturer had all shipped in May;
 * the one-time backfill matched nothing because every photo postdates it, and
 * nothing has written it since. The sixth gate with no handle.
 *
 * ⚠ WHAT THIS DOES NOT ASSERT. NULL is a legitimate value — a photo with no
 * seat, an unclaimed seat, or a claimer with no `people` row. The column's own
 * comment says "nullable for unclaimed/ephemeral seats". Rule 3 exists so a
 * future reader does not "fix" those NULLs.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATION = join(
  import.meta.dirname,
  '../../../../supabase/migrations/20271170468759_who_took_this_photo.sql',
);

let replay: ReplayResult;
let db: PGlite;

/** Seeds an event, an account, its person row, and a seat. Returns the ids. */
async function seed(suffix: string, claim: boolean) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
       VALUES ($1, 'birthday') RETURNING event_id`,
    [`Capturer credit ${suffix}`],
  );
  const eventId = ev.rows[0]!.event_id;

  const usr = await db.query<{ id: string }>(
    `INSERT INTO auth.users (id) VALUES (gen_random_uuid()) RETURNING id`,
  );
  const userId = usr.rows[0]!.id;

  // ⚠ DO NOT INSERT THE PERSON. Creating an account already mints its own
  // claimed person node (the person-spine self-claim trigger, 20270513691781),
  // and `people.claimed_by_user_id` is UNIQUE — a second insert here fails with
  // a duplicate-key error that reads like a broken fixture rather than like the
  // product working. Read what the account already has; only mint one if the
  // spine did not (which is what the ON CONFLICT there is for).
  const per = await db.query<{ person_id: string }>(
    `INSERT INTO public.people (claimed_by_user_id, display_name)
       VALUES ($1, $2)
     ON CONFLICT (claimed_by_user_id) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING person_id`,
    [userId, `Capturer ${suffix}`],
  );
  const personId = per.rows[0]!.person_id;

  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, claimer_user_id)
       VALUES ($1, 1, 'paparazzi_5_seats', $2, $3) RETURNING seat_id`,
    [eventId, `tok-${suffix}`, claim ? userId : null],
  );

  return { ev: eventId, usr: userId, per: personId, seat: seat.rows[0]!.seat_id };
}

async function insertPhoto(ev: string, seat: string, key: string, supplied?: string) {
  const { rows } = await db.query<{ captured_by_person_id: string | null }>(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, photo_type, captured_by_person_id)
       VALUES ($1, $2, $3, 'photo', $4)
     RETURNING captured_by_person_id`,
    [ev, seat, key, supplied ?? null],
  );
  return rows[0]?.captured_by_person_id ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.close?.();
});

test('1 · a capture on a claimed seat is credited to that person, with nothing supplied', async () => {
  const { ev, per, seat } = await seed('a1', true);
  const got = await insertPhoto(ev, seat, 'k/a1');
  assert.equal(
    got,
    per,
    'captured_by_person_id was not derived on insert — the column goes back to ' +
      'having no writer, and the perspective-shift read groups an empty set',
  );
});

test('2 · a supplied value is OVERWRITTEN, not honoured', async () => {
  const { ev, per, seat } = await seed('a2', true);
  const other = await seed('a2-other', true);
  const impostor = other.per;

  // Anti-vacuity: the impostor must be a real, DIFFERENT person, or "it came
  // back as the right person" proves nothing about the overwrite — and a
  // non-existent id would have been refused by the FK, not by the trigger.
  assert.notEqual(impostor, per, 'the impostor id equals the true person id');

  const got = await insertPhoto(ev, seat, 'k/a2', impostor);
  assert.equal(
    got,
    per,
    'a caller named the capturer and was believed. The value is DERIVED — ' +
      '`authenticated` holds UPDATE on this column, so "fill only if null" ' +
      'leaves it forgeable.',
  );
});

test('3 · an UNCLAIMED seat leaves it NULL — that is an absence, not a fault', async () => {
  const { ev, seat } = await seed('a3', false);
  const got = await insertPhoto(ev, seat, 'k/a3');
  assert.equal(
    got,
    null,
    'an unclaimed seat produced a capturer. Nobody has claimed it, so there is ' +
      'no person to credit — do not "fix" this NULL.',
  );
});

test('4 · an UPDATE cannot move the credit either', async () => {
  const { ev, per, seat } = await seed('a4', true);
  await insertPhoto(ev, seat, 'k/a4');
  const impostor = (await seed('a4-other', true)).per;
  const { rows } = await db.query<{ captured_by_person_id: string | null }>(
    `UPDATE public.papic_photos SET captured_by_person_id = $1
      WHERE r2_object_key = 'k/a4'
     RETURNING captured_by_person_id`,
    [impostor],
  );
  assert.equal(
    rows[0]?.captured_by_person_id,
    per,
    'a PATCH re-credited somebody else’s photograph. The trigger must fire on ' +
      'UPDATE as well as INSERT — the browser role holds UPDATE on this column.',
  );
});

test('5 · the migration CONTAINS a re-backfill — the 2026-05-23 one is spent', async () => {
  // 🪤 THIS RULE WAS DECORATION ON ITS FIRST RUN. Rule 6 below proves the
  // backfill STATEMENT works — by running the statement itself, inline — so
  // deleting it from the migration left rule 6 green. A test that carries its
  // own copy of the thing it is checking cannot notice the thing going missing.
  // Deleting the UPDATE from the migration measured 1 → 0 and passed.
  const sql = readFileSync(MIGRATION, 'utf8');
  assert.match(
    sql,
    /UPDATE public\.papic_photos AS ph\s+SET captured_by_person_id/,
    'the re-backfill is gone from the migration. The trigger only fills rows ' +
      'written from now on; production’s 14 photos are all derivable and all ' +
      'NULL, and a backfill is a point-in-time act — the 2026-05-23 one matched ' +
      'nothing because every photo postdates it.',
  );
  assert.match(
    sql,
    /AND ph\.captured_by_person_id IS NULL/,
    'the re-backfill lost its IS NULL scope — it is no longer idempotent, and ' +
      'a re-run would clobber values the trigger has since derived',
  );
});

test('6 · …and that statement really does re-derive a stranded row', async () => {
  // Prove the STATEMENT works by reproducing the situation it exists for: a row
  // whose value is NULL while its seat is claimed. The trigger fires on the
  // backfill UPDATE too, so this asserts the pair, which is what production runs.
  const { ev, per, seat } = await seed('a5', true);
  await insertPhoto(ev, seat, 'k/a5');
  await db.query(
    `ALTER TABLE public.papic_photos DISABLE TRIGGER stamp_capturer_person`,
  );
  await db.query(
    `UPDATE public.papic_photos SET captured_by_person_id = NULL WHERE r2_object_key = 'k/a5'`,
  );
  const { rows: before } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a5'`,
  );
  assert.equal(before[0]?.v, null, 'the setup did not actually strand the row — the rest is vacuous');

  await db.query(`ALTER TABLE public.papic_photos ENABLE TRIGGER stamp_capturer_person`);
  await db.query(
    `UPDATE public.papic_photos AS ph
        SET captured_by_person_id = pe.person_id
       FROM public.paparazzi_seats AS s
       JOIN public.people AS pe ON pe.claimed_by_user_id = s.claimer_user_id
      WHERE ph.paparazzi_seat_id = s.seat_id
        AND s.claimer_user_id IS NOT NULL
        AND ph.captured_by_person_id IS NULL`,
  );
  const { rows: after } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a5'`,
  );
  assert.equal(
    after[0]?.v,
    per,
    'the backfill left a stranded row stranded — which is exactly what the ' +
      '2026-05-23 one did, and why all 14 production photos are NULL',
  );
});
