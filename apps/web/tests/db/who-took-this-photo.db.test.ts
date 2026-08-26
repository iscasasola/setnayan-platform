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
  // ⚠ `replay?.close?.()` — the shape I wrote first — TYPECHECKED AS AN ERROR and
  // ran as a no-op: ReplayResult has no `close`, and optional chaining swallowed
  // it, so the suite passed while never releasing the database. The rest of this
  // directory calls `db.close()`.
  await db?.close();
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

  /*
    ⚠ ASSERTED TEXTUALLY BECAUSE IT CANNOT BE OBSERVED. The trigger NULLs a
    superseded photo's credit whatever the statement does, so deleting this
    clause changes no outcome and every behavioural rule here stays green —
    measured: 1 → 0, still 8 pass.

    It is kept anyway, and this is why: the clause is what protects a bulk
    backfill run with the trigger DISABLED, which is exactly what rule 6 below
    does and exactly what anybody repairing this column at scale would do. An
    unobservable line is one somebody deletes as dead; this says it is not.
  */
  assert.match(
    sql,
    /AND ph\.superseded_at IS NULL/,
    'the re-backfill lost its superseded_at scope. With the trigger disabled — ' +
      'which is how anybody repairs this column in bulk — it would credit the ' +
      'new holder of a reissued camera with the previous friend’s photographs.',
  );
});

test('6 · …and that statement, EXTRACTED FROM THE MIGRATION, re-derives a stranded row', async () => {
  /*
    🪤 THIS RULE RAN A HAND-TYPED COPY OF THE BACKFILL, AND A SUBAGENT PROVED IT
    WORTHLESS BY NARROWING THE REAL ONE. With `AND ph.photo_type = 'clip'`
    silently appended to the shipped statement — which would have left every
    photograph in production uncredited forever — this file reported 6 pass,
    0 fail. Rule 5 matched two fragments that were still present; this rule ran
    its own SQL and never touched the migration at all.

    So the statement is now LIFTED OUT OF THE FILE and executed. A test that
    carries its own copy of the thing it checks is testing its own copy.
  */
  const sql = readFileSync(MIGRATION, 'utf8');
  const m = sql.match(/UPDATE public\.papic_photos AS ph[\s\S]*?;/);
  assert.ok(m, 'could not lift the backfill statement out of the migration');
  const backfill = m[0];

  // Anti-vacuity: an empty or truncated match would "run" and prove nothing.
  assert.ok(
    backfill.length > 120 && /captured_by_person_id/.test(backfill),
    `the extracted statement does not look like the backfill:\n${backfill}`,
  );

  const { ev, per, seat } = await seed('a5', true);
  await insertPhoto(ev, seat, 'k/a5');
  await db.query(`ALTER TABLE public.papic_photos DISABLE TRIGGER stamp_capturer_person`);
  await db.query(
    `UPDATE public.papic_photos SET captured_by_person_id = NULL WHERE r2_object_key = 'k/a5'`,
  );
  const { rows: before } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a5'`,
  );
  assert.equal(before[0]?.v, null, 'the setup did not actually strand the row — the rest is vacuous');

  await db.query(`ALTER TABLE public.papic_photos ENABLE TRIGGER stamp_capturer_person`);
  await db.query(backfill);

  const { rows: after } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a5'`,
  );
  assert.equal(
    after[0]?.v,
    per,
    'the migration’s OWN backfill left a stranded row stranded. That is exactly ' +
      'what the 2026-05-23 one did, and why all 14 production photos are NULL.',
  );
});

test('7 · a photo cannot be moved onto another camera to steal its credit', async () => {
  // 🚨 The credit is derived from the seat, so it is only as trustworthy as the
  // seat — and `authenticated` holds UPDATE on paparazzi_seat_id.
  const mine = await seed('a7', true);
  const theirs = await seed('a7-other', true);
  await insertPhoto(theirs.ev, theirs.seat, 'k/a7');

  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [mine.usr]);
  await db.query(`SET LOCAL ROLE authenticated`);
  let moved = false;
  try {
    await db.query(
      `UPDATE public.papic_photos SET paparazzi_seat_id = $1 WHERE r2_object_key = 'k/a7'`,
      [mine.seat],
    );
    moved = true;
  } catch {
    moved = false;
  }
  await db.query(`RESET ROLE`);

  const { rows } = await db.query<{ seat: string; person: string | null }>(
    `SELECT paparazzi_seat_id AS seat, captured_by_person_id AS person
       FROM public.papic_photos WHERE r2_object_key = 'k/a7'`,
  );
  assert.equal(
    rows[0]?.seat,
    theirs.seat,
    `a browser role moved a photo between cameras (update ${moved ? 'succeeded' : 'was refused'}) — ` +
      'the credit follows the seat, so this is the credit being forgeable one column over',
  );
  assert.equal(
    rows[0]?.person,
    theirs.per,
    'the capturer credit moved with the attempted seat change',
  );
});

test('8 · a superseded photo is never re-credited to the camera’s new holder', async () => {
  // reissueSeat hands a camera to a NEW friend and stamps superseded_at on the
  // previous claimer's photos, keeping them. The seat's claimer is then B, and a
  // plain derivation would credit B with A's photographs.
  const { ev, per, seat, usr } = await seed('a8', true);
  await insertPhoto(ev, seat, 'k/a8');

  const { rows: pre } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a8'`,
  );
  assert.equal(pre[0]?.v, per, 'the photo was not credited to its own claimer to begin with');
  void usr;

  // The reissue: stamp the old claimer's photos, then hand the seat on.
  await db.query(
    `UPDATE public.papic_photos SET superseded_at = now() WHERE r2_object_key = 'k/a8'`,
  );
  const other = await seed('a8-new', true);
  await db.query(`UPDATE public.paparazzi_seats SET claimer_user_id = $1 WHERE seat_id = $2`, [
    other.usr,
    seat,
  ]);

  // Any later filler — the backfill, a future one, a stray PATCH.
  await db.query(
    `UPDATE public.papic_photos SET captured_by_person_id = $1 WHERE r2_object_key = 'k/a8'`,
    [other.per],
  );

  const { rows } = await db.query<{ v: string | null }>(
    `SELECT captured_by_person_id AS v FROM public.papic_photos WHERE r2_object_key = 'k/a8'`,
  );
  assert.equal(
    rows[0]?.v,
    null,
    'a superseded photo was credited to whoever holds that camera now — the ' +
      'previous claimer took it, and their identity is not recoverable from the ' +
      'seat, so NULL is the only honest answer',
  );
});

