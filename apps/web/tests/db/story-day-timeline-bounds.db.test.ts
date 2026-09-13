/**
 * The day's clock shows the day — DB-level regression (executed, not prose).
 *
 * Guards migration 20271214524793_story_dial_bucket_counts_rpc.sql and the
 * bounded timeline read in apps/web/app/[slug]/_components/editorial/data.ts
 * (03 §3 · 08 steps 0.2 + 0.4 · Design_Editorial_By_The_Minute_2026-09-07).
 *
 * MEASURED BUG: the editorial's "As the Day Unfolded" timeline read had no
 * lower bound on `captured_at`, so ~100 pre-day (prenup/despedida) captures —
 * which Papic cameras may record up to 6 months before the event — filled the
 * entire ≤48-row cap and the wedding day itself rendered no photograph.
 *
 * This seeds exactly that shape (100 pre-day captures + a handful of day-of
 * and day-2 captures on a 2-day event) against the FULL replayed prod schema,
 * then asserts:
 *   1. `story_dial_bucket_counts` — bar heights come from a COUNT aggregate,
 *      not from the capped row read, and the count for the event's own day(s)
 *      reflects every day-of capture even when far more than 48 exist.
 *   2. A day-2 capture is never counted inside a day-1 window.
 *   3. `storyDayWindow` (the pure TS bound used by data.ts's query) excludes
 *      every pre-day capture from its [startIso, endIso) range.
 *
 * Run under BOTH Asia/Manila and a west-of-Greenwich zone (CI's UTC clock
 * hides the wall-clock-vs-instant class of bug this build explicitly warns
 * about) — see the two `TZ=` invocations in the PR body / CI job.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { storyDayWindow, manilaDayOf } from '../../lib/story-day-window';

let replay: ReplayResult;
let db: PGlite;
let eventId: string;
let seatId: string;

// Day 1 = the wedding ceremony day; day 2 = the reception's second calendar
// day (multi-day event, events.event_end_date = day 2). Both are Manila
// calendar dates — the fixed +08:00 PH offset (papic-window.ts).
const DAY1 = '2027-02-13';
const DAY2 = '2027-02-14';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user

  // event_type='birthday' — 'wedding' carries a biconditional CHECK requiring
  // ceremony_type + venue_setting too; this test is about the day bound, not
  // wedding-specific fields, so the simpler type avoids an unrelated failure
  // mode (same pattern as tests/db/papic-clip-web-copy.db.test.ts).
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_end_date)
     VALUES ('Day Bounds Test Event', 'birthday', $1, $2) RETURNING event_id`,
    [DAY1, DAY2],
  );
  eventId = ev.rows[0]!.event_id;

  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_5_seats', 'tok-day-bounds-test') RETURNING seat_id`,
    [eventId],
  );
  seatId = seat.rows[0]!.seat_id;

  const insertCapture = async (capturedAtIso: string, moderationState = 'clean') => {
    await db.query(
      `INSERT INTO public.papic_photos
         (event_id, paparazzi_seat_id, r2_object_key, photo_type, captured_at,
          moderation_state, hidden_at)
       VALUES ($1, $2, $3, 'photo', $4, $5, NULL)`,
      [eventId, seatId, `event-${eventId}/papic/seat-1/${Math.random().toString(36).slice(2)}.jpg`, capturedAtIso, moderationState],
    );
  };

  // 100 pre-day captures — a prenup/despedida shoot roughly a month out,
  // spread over several days so they don't collapse into one bucket.
  for (let i = 0; i < 100; i += 1) {
    const dayOffset = Math.floor(i / 10); // 10 captures per pre-day
    const hour = 8 + (i % 10);
    await insertCapture(`2027-01-${String(10 + dayOffset).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00+08:00`);
  }

  // 6 day-1 (ceremony day) captures, spread through the Manila afternoon.
  for (let h = 14; h < 20; h += 1) {
    await insertCapture(`${DAY1}T${String(h).padStart(2, '0')}:00:00+08:00`);
  }

  // 3 day-2 (reception's second day) captures, morning.
  for (let h = 9; h < 12; h += 1) {
    await insertCapture(`${DAY2}T${String(h).padStart(2, '0')}:00:00+08:00`);
  }
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the new bucket-count RPC (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('storyDayWindow bounds the event to its own Manila days, excluding every pre-day capture', () => {
  const win = storyDayWindow(DAY1, DAY2);
  assert.ok(win, 'window resolves for a dated event');
  assert.equal(win!.startDate, DAY1);
  assert.equal(win!.endDate, DAY2);
  assert.equal(win!.days, 2);

  // Every pre-day capture (Jan) falls outside [startIso, endIso).
  const preDayIso = '2027-01-15T08:00:00+08:00';
  assert.ok(new Date(preDayIso).getTime() < new Date(win!.startIso).getTime(), 'pre-day capture precedes the window');

  // Day-1 and day-2 captures fall inside it.
  assert.ok(new Date(`${DAY1}T14:00:00+08:00`).getTime() >= new Date(win!.startIso).getTime());
  assert.ok(new Date(`${DAY2}T11:00:00+08:00`).getTime() <= new Date(win!.endIso).getTime());

  // A day-3 capture (past event_end_date) falls outside it.
  assert.ok(new Date('2027-02-15T00:30:00+08:00').getTime() > new Date(win!.endIso).getTime());
});

test('manilaDayOf never draws a day-2 capture onto day 1 (and vice versa)', () => {
  // 1am Manila on day 2 is 5pm UTC on day 1 — the exact class of bug the
  // build's own TRAP warning names ("a wall clock is not an instant").
  assert.equal(manilaDayOf(`${DAY2}T01:00:00+08:00`), DAY2);
  assert.notEqual(manilaDayOf(`${DAY2}T01:00:00+08:00`), DAY1);
  assert.equal(manilaDayOf(`${DAY1}T23:30:00+08:00`), DAY1);
});

test('story_dial_bucket_counts: the day-of buckets hold every day-of capture, not just the first 48 rows', async () => {
  const win = storyDayWindow(DAY1, DAY2)!;
  const { rows } = await db.query<{ bucket_start: string; capture_count: number }>(
    `SELECT bucket_start, capture_count
       FROM public.story_dial_bucket_counts($1, $2, $3, 60)
      ORDER BY bucket_start`,
    [eventId, win.startIso, win.endIso],
  );

  const totalInWindow = rows.reduce((sum, r) => sum + Number(r.capture_count), 0);
  // 6 day-1 + 3 day-2 = 9 captures land inside the bounded window; none of the
  // 100 pre-day captures do, even though 100 > EDITORIAL_TIMELINE_PHOTO_CAP (48)
  // — this is the count aggregate, unrelated to the row-read cap.
  assert.equal(totalInWindow, 9, 'only the 9 in-window captures are counted');

  // Zero-filled: bars exist even for hours with no captures (e.g. midnight on
  // day 1), proving the RPC is a real bucket spine and not just a GROUP BY that
  // skips silent gaps.
  assert.ok(rows.length > 9, 'more buckets than captures — the spine is zero-filled');
  assert.ok(rows.every((r) => Number.isInteger(Number(r.capture_count))), 'every count is an integer');
});

test('story_dial_bucket_counts: a day-1-only window never counts a day-2 capture', async () => {
  const day1Only = storyDayWindow(DAY1, DAY1)!;
  const { rows } = await db.query<{ capture_count: number }>(
    `SELECT capture_count FROM public.story_dial_bucket_counts($1, $2, $3, 60)`,
    [eventId, day1Only.startIso, day1Only.endIso],
  );
  const total = rows.reduce((sum, r) => sum + Number(r.capture_count), 0);
  assert.equal(total, 6, 'exactly the 6 day-1 captures — none of the 3 day-2 ones leak in');
});

test('story_dial_bucket_counts: a hidden or unscreened capture is never counted (fail-closed)', async () => {
  await db.query(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, photo_type, captured_at,
        moderation_state, hidden_at)
     VALUES ($1, $2, 'event-x/hidden.jpg', 'photo', $3, 'clean', NOW())`,
    [eventId, seatId, `${DAY1}T15:00:00+08:00`],
  );
  await db.query(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, photo_type, captured_at,
        moderation_state, hidden_at)
     VALUES ($1, $2, 'event-x/unscreened.jpg', 'photo', $3, 'unscreened', NULL)`,
    [eventId, seatId, `${DAY1}T15:30:00+08:00`],
  );
  const win = storyDayWindow(DAY1, DAY1)!;
  const { rows } = await db.query<{ capture_count: number }>(
    `SELECT capture_count FROM public.story_dial_bucket_counts($1, $2, $3, 60)`,
    [eventId, win.startIso, win.endIso],
  );
  const total = rows.reduce((sum, r) => sum + Number(r.capture_count), 0);
  assert.equal(total, 6, 'still exactly 6 — the hidden and unscreened rows are excluded');
});
