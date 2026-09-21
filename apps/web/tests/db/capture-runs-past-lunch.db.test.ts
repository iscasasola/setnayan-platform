/**
 * CAPTURE RUNS TWELVE HOURS PAST THE EVENT DAY — the SQL half, against real
 * Postgres (owner 2026-09-22 · migration 20271238778987).
 *
 * The TypeScript half is proved in lib/capture-runs-past-lunch.test.ts, under
 * Asia/Manila with a fixed clock. Two things it cannot reach live here:
 *
 *   1 · THE COLUMN ACTUALLY WIDENED. `paparazzi_seats.valid_until` was a DATE,
 *       and a DATE takes `2026-12-21T11:59:59+08:00` WITHOUT COMPLAINING and
 *       throws the time away. Every writer in the app already stamps a full ISO
 *       into it, so if the ALTER did not take, the gate closes at midnight the
 *       morning after instead of lunch and NOTHING anywhere errors. A type
 *       assertion alone would not catch a column that is timestamptz on paper
 *       and truncating in practice, so the round trip is asserted too.
 *
 *   2 · THE CHALLENGE CLOCK'S FALLBACK MOVED WITH IT. `papic_challenge_ends_at`
 *       takes `events.papic_window_end` as its third term — so a celebration
 *       WITH a window follows the ruling for free — but falls back to "the end
 *       of the event day" in SQL when that column is NULL, while the TypeScript
 *       fallback now says "the end of the event day plus twelve hours". Two
 *       fallbacks for one fact, disagreeing, is the drift the whole clock was
 *       built to prevent.
 *
 * 🔴 AND THE CLOCK STILL CLOSES THE PROMPT, NEVER THE SHUTTER. Nothing here is
 * on a capture path; a guest is never refused a photograph for lateness.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE SEAT'S CLOSING BOUND IS AN INSTANT
// ═══════════════════════════════════════════════════════════════════════════

test('paparazzi_seats.valid_until is a timestamptz, not a DATE', async () => {
  const r = await db.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='paparazzi_seats'
        AND column_name='valid_until'`,
  );
  assert.equal(
    r.rows[0]?.data_type,
    'timestamp with time zone',
    'a DATE cannot express 11:59am — the twelve-hour tail cannot reach the gate',
  );
});

test('valid_from is still a DATE — this ruling was about the END', async () => {
  const r = await db.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='paparazzi_seats'
        AND column_name='valid_from'`,
  );
  assert.equal(
    r.rows[0]?.data_type,
    'date',
    'widening valid_from would suddenly honour a start TIME that has always been ' +
      'truncated to midnight, and REFUSE shots that work today',
  );
});

test('🔑 the closing instant survives the round trip — no silent truncation', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Lunch The Next Day', 'birthday', DATE '2026-12-20') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  // Exactly what manilaCaptureCloseIso('2026-12-20') writes.
  const close = '2026-12-21T11:59:59+08:00';
  await db.query(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, valid_from, valid_until)
     VALUES ($1, 700, 'PAPIC_CAMERA_FREE', 'tok-lunch-next-day', DATE '2026-12-20', $2::timestamptz)`,
    [eventId, close],
  );

  const r = await db.query<{ same: boolean; wall: string }>(
    `SELECT valid_until = $2::timestamptz AS same,
            to_char(valid_until AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') AS wall
       FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 700`,
    [eventId, close],
  );
  assert.equal(
    r.rows[0]?.wall,
    '2026-12-21 11:59:59',
    'the stamped instant was truncated — the column is still behaving like a DATE, ' +
      'so the cameras close at midnight instead of lunch and nothing errors',
  );
  assert.equal(r.rows[0]?.same, true);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE LAST CHALLENGE CLOSES WHEN THE CAMERAS DO
// ═══════════════════════════════════════════════════════════════════════════

test('🔑 the challenge clock’s NULL fallback carries the twelve hours too', async () => {
  const ev = await db.query<{ event_id: string }>(
    // papic_window_end deliberately NULL: this is the fallback under test, and
    // it is what every celebration that never opened the picker gets.
    `INSERT INTO public.events (display_name, event_type, event_date, timezone, papic_window_end)
     VALUES ('Fallback Clock', 'birthday', DATE '2026-12-20', 'Asia/Manila', NULL)
     RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  const m = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, armed_at, armed_duration_minutes)
     VALUES ($1,'prompt','couple','Find the lolo',
             TIMESTAMPTZ '2026-12-25 10:00:00+08', 120)
     RETURNING mission_id`,
    [eventId],
  );
  // Its own timer lands on 2026-12-25 — days after the window — so the window
  // term is the only one that can win the LEAST(). If the fallback were the
  // term that was dropped, this would return the 25th and say so.
  const r = await db.query<{ ends: string; legacy: string; gap_hours: number }>(
    `SELECT public.papic_challenge_ends_at($1::uuid) AS ends,
            (((DATE '2026-12-20' + 1)::timestamp AT TIME ZONE 'Asia/Manila')
              - INTERVAL '1 second') AS legacy,
            EXTRACT(EPOCH FROM (
              public.papic_challenge_ends_at($1::uuid)
              - (((DATE '2026-12-20' + 1)::timestamp AT TIME ZONE 'Asia/Manila')
                  - INTERVAL '1 second')
            )) / 3600 AS gap_hours`,
    [m.rows[0]!.mission_id],
  );

  assert.equal(
    Number(r.rows[0]!.gap_hours),
    12,
    'the SQL fallback still closes the last challenge at the end of the event day, ' +
      'twelve hours before the cameras it is supposed to close with',
  );
  assert.equal(
    new Date(r.rows[0]!.ends).toISOString(),
    // 2026-12-21 11:59:59 Manila — the same instant manilaCaptureCloseIso writes.
    new Date('2026-12-21T11:59:59+08:00').toISOString(),
  );
});

test('a celebration WITH a window still closes on its stored instant', async () => {
  const close = '2026-12-21T11:59:59+08:00';
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, timezone, papic_window_end)
     VALUES ('Stored Clock', 'birthday', DATE '2026-12-20', 'Asia/Manila', $1::timestamptz)
     RETURNING event_id`,
    [close],
  );
  const m = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, armed_at, armed_duration_minutes)
     VALUES ($1,'prompt','couple','Find the lola',
             TIMESTAMPTZ '2026-12-25 10:00:00+08', 120)
     RETURNING mission_id`,
    [ev.rows[0]!.event_id],
  );
  const r = await db.query<{ ends: string }>(
    `SELECT public.papic_challenge_ends_at($1::uuid) AS ends`,
    [m.rows[0]!.mission_id],
  );
  assert.equal(
    new Date(r.rows[0]!.ends).toISOString(),
    new Date(close).toISOString(),
    'the stored window end must win — it is already the closing instant',
  );
});
