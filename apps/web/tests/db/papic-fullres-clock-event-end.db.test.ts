/**
 * THE THREE-MONTH FULL-RES FLOOR COUNTS FROM WHEN THE EVENT ENDS — executed.
 *
 * Owner correction, 2026-08-10: *"3 months after the event **ends**."*
 *
 * ── WHAT THIS PROVES, AND WHY IT IS AN EXECUTING TEST ─────────────────────
 * `papic_events_past_fullres_clock(p_retention_days, p_post_event_days)` decides
 * which events may have their full-resolution originals replaced by their
 * compressed copies. Its floor term used to read `events.event_date` — the
 * FIRST day — while `events.event_end_date` (NULL = single-day) sat unread.
 *
 * For a one-day wedding the two are the same, which is why nothing ever showed.
 * For a multi-day celebration the closing day's originals were compressed early
 * by exactly the length of the event, and the symptom is an ABSENCE: a
 * print-quality file that is no longer there. Same family as the phantom column,
 * the phantom enum value and the phantom RPC argument — nothing throws.
 *
 * The sibling `lib/papic-fullres-clock.test.ts` reads the migration as TEXT and
 * regex-matches it. That layer cannot tell you whether the SQL is even valid,
 * let alone what it returns. This one replays every migration into an in-process
 * PGlite (real Postgres, no docker, no network), inserts real events, and CALLS
 * THE FUNCTION.
 *
 * 🪤 Every assertion here is written to fail if the floor regresses to the start
 * date, and the "not yet" cases are what do that work — an over-permissive
 * function is caught by an event that must NOT be returned, never by one that
 * must.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DAY = 86_400_000;
/** Six months + a margin: the first-capture term (a) is satisfied for every row. */
const CAPTURED_LONG_AGO = new Date(Date.now() - 400 * DAY).toISOString();
/** The floor under test. Mirrors FULL_RES_POST_EVENT_GRACE_DAYS = 92. */
const GRACE = 92;
const RETENTION = 183;

/** YYYY-MM-DD, N days before today. DATE columns take no time part. */
function dateDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
}

/**
 * Insert an event, give it one capture 400 days old so term (a) has long since
 * elapsed, and return its id. Every case below then differs ONLY in its dates,
 * so any difference in the result is the floor and nothing else.
 */
async function seedEvent(
  name: string,
  startDate: string | null,
  endDate: string | null,
): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_end_date)
     VALUES ($1, 'travel', $2::date, $3::date) RETURNING event_id`,
    [name, startDate, endDate],
  );
  const eventId = ev.rows[0]!.event_id;
  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Clock', 'Test', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, display_r2_key, media_type, captured_at)
     VALUES ($1, $2, $3, $3, 'photo', $4)`,
    [eventId, guest.rows[0]!.guest_id, `r2://setnayan-media/papic/${eventId}.jpg`, CAPTURED_LONG_AGO],
  );
  return eventId;
}

/** The set of event ids the sweep would consider expired right now. */
async function expiredNow(): Promise<Set<string>> {
  const res = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.papic_events_past_fullres_clock($1::int, $2::int)`,
    [RETENTION, GRACE],
  );
  return new Set(res.rows.map((r) => r.event_id));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user
});

after(async () => {
  await db?.close();
});

test('replay applied every migration (schema is the real prod shape)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('🚨 a multi-day event is NOT expired while its LAST day is inside the floor', async () => {
  // A ten-day trip that STARTED 95 days ago and ENDED 85 days ago. Under the old
  // rule the start date alone cleared the 92-day floor and the closing night's
  // originals were compressed seven days early. Under the corrected rule the
  // event's last day is what counts, and it has not cleared the floor yet.
  const id = await seedEvent('Ten-day trip, still inside the floor', dateDaysAgo(95), dateDaysAgo(85));
  const expired = await expiredNow();
  assert.ok(
    !expired.has(id),
    'a celebration that ENDED 85 days ago is inside the 92-day floor. If this ' +
      'event is expired, the floor is counting from the day the trip STARTED ' +
      'and the last day gets less than the promised three months.',
  );
});

test('…and IS expired once the last day itself clears the floor', async () => {
  // Same ten-day shape, moved back: ended 100 days ago, past 92. Without this
  // case the test above would also pass on a function that never expires
  // anything — the floor must still let go.
  const id = await seedEvent('Ten-day trip, floor cleared', dateDaysAgo(110), dateDaysAgo(100));
  const expired = await expiredNow();
  assert.ok(
    expired.has(id),
    'once the LAST day is more than 92 days back the originals are droppable — ' +
      'if this fails the floor never releases and the sweep is inert',
  );
});

test('a single-day event is unchanged: NULL end date falls back to the start date', async () => {
  // The COALESCE half. Every production event today has a NULL end date, so a
  // regression here breaks the live behaviour rather than the latent one.
  const inside = await seedEvent('One-day, inside the floor', dateDaysAgo(85), null);
  const outside = await seedEvent('One-day, floor cleared', dateDaysAgo(100), null);
  const expired = await expiredNow();
  assert.ok(!expired.has(inside), 'a one-day event 85 days ago is still inside its floor');
  assert.ok(expired.has(outside), 'a one-day event 100 days ago has cleared its floor');
});

test('🛡 a malformed end date EARLIER than the start can only be ignored, never shorten the promise', async () => {
  // The GREATEST half — the one-way valve. `events_end_date_after_start` is a
  // CHECK, and a CHECK can be dropped, added NOT VALID, or sidestepped by a
  // backfill; a bare COALESCE would then hand the floor an end date BEFORE the
  // start and expire the originals early. Bypass the constraint the same way a
  // bad backfill would — write the column directly — and assert the floor holds.
  const id = await seedEvent('Backwards end date', dateDaysAgo(85), null);
  await db.query(
    `ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_end_date_after_start`,
  );
  await db.query(`UPDATE public.events SET event_end_date = $2::date WHERE event_id = $1`, [
    id,
    dateDaysAgo(200),
  ]);
  // Self-check: the bad value really landed, or this test proves nothing.
  const check = await db.query<{ event_end_date: string | null }>(
    `SELECT event_end_date FROM public.events WHERE event_id = $1`,
    [id],
  );
  assert.ok(check.rows[0]!.event_end_date, 'self-check: the backwards end date did not persist');

  const expired = await expiredNow();
  assert.ok(
    !expired.has(id),
    'an end date 200 days ago on an event that started 85 days ago must be ' +
      'IGNORED — GREATEST falls back to the later start date. A bare COALESCE ' +
      'would expire these originals a hundred days early.',
  );
});

test('an event with NO dates at all still falls back to the first-capture clock', async () => {
  // Unchanged behaviour, pinned because the NULL branch moved from event_date to
  // the derived last day. An undated event must NOT become undroppable forever.
  const id = await seedEvent('No dates at all', null, null);
  const expired = await expiredNow();
  assert.ok(
    expired.has(id),
    'with no dates the floor cannot apply, so the 6-month first-capture clock ' +
      'decides alone — 400 days ago, so it has run out',
  );
});

test('an event with an end date but NO start date floors on the end date', async () => {
  // GREATEST ignores NULLs (it returns NULL only when every argument is NULL),
  // so `GREATEST(COALESCE(NULL, NULL), NULL)` is NULL but
  // `GREATEST(COALESCE(end, NULL), NULL)` is `end`. Without that, an event
  // carrying only an end date would collapse to "no floor at all" and lose its
  // three months.
  const id = await seedEvent('End date only', null, dateDaysAgo(30));
  const expired = await expiredNow();
  assert.ok(
    !expired.has(id),
    'an event whose only date is an end date 30 days ago is inside the floor',
  );
});

test('an event that never used Papic is never selected', async () => {
  // The 'infinity' sentinel. Regression pin carried over from the original
  // clock: an event with no captures must not compare as expired.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Never used Papic', 'travel', $1::date) RETURNING event_id`,
    [dateDaysAgo(400)],
  );
  const expired = await expiredNow();
  assert.ok(!expired.has(ev.rows[0]!.event_id), 'no captures ⇒ never expired');
});

test('the warning email cannot fire LATER than the sweep it warns about', async () => {
  // daily-email-jobs.ts calls this SAME function with both offsets pulled back
  // by the lead time. That only produces a real warning window if the pulled-back
  // call is a SUPERSET of the sweep's — which is a property of the function, and
  // it has to survive the floor moving to the end date.
  const LEAD = 14;
  await seedEvent('Warn window, multi-day', dateDaysAgo(105), dateDaysAgo(95));
  await seedEvent('Warn window, one-day', dateDaysAgo(95), null);

  const warned = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.papic_events_past_fullres_clock($1::int, $2::int)`,
    [Math.max(0, RETENTION - LEAD), Math.max(0, GRACE - LEAD)],
  );
  const warnSet = new Set(warned.rows.map((r) => r.event_id));
  const sweptSet = await expiredNow();

  assert.ok(warnSet.size > 0, 'self-check: the pulled-back call returned nothing to compare');
  for (const id of sweptSet) {
    assert.ok(
      warnSet.has(id),
      `event ${id} is being swept but would never have been warned — the warning ` +
        `email must fire EARLIER than the sweep, never later`,
    );
  }
});
