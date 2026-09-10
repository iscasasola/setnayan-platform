/**
 * TAKEN BACK IS A REAL STATE, AND THE NUMBER SURVIVES THE ROUND TRIP.
 *
 * `04` §3 · `07` Q6 (owner-ruled 2026-09-09) · 08 step 4.1.
 *
 * Two claims the TypeScript cannot make on its own, because both live in the
 * database:
 *
 *   1. **`status` accepts 'taken_back'.** The CHECK constraint read out of
 *      production on 2026-09-09 permitted exactly `draft · event · published`.
 *      A phantom enum value is REJECTED, NEVER THROWN, in this product's usual
 *      shape — the write lands in `error`, the action returns "Could not save",
 *      and the only symptom is a rung that does nothing. So the constraint is
 *      asked directly, both ways: it must take the new word and must still
 *      refuse an invented one.
 *
 *   2. **Published → taken back → published keeps the same edition number.**
 *      "No. 4, theirs forever" is the promise, and the round trip is only
 *      reachable now that there is a rung to take it back with. The action's own
 *      guard (`edition_no == null`) is one fence; `event_editorial_edition_stamped_once`
 *      is the one that holds when somebody PATCHes the row directly, which they
 *      can: `authenticated` holds table-level UPDATE on this table.
 *
 * ⚠ AND THE STAMP COLUMN HAS TO EXIST WITH A DEFAULT. A phantom COLUMN fails the
 * same silent way — the print sheet would simply never carry a date and nobody
 * would see an error.
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

let n = 0;

/** An event, and the story row its creation trigger already made. */
async function seedEvent(): Promise<string> {
  n += 1;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Taken back test ${n}', 'birthday', DATE '2027-06-01') RETURNING event_id`,
  );
  return ev.rows[0]!.event_id;
}

test('the ladder’s fourth rung is a status the database accepts', async () => {
  const eventId = await seedEvent();
  await db.query(`UPDATE public.event_editorial SET status = 'taken_back' WHERE event_id = $1`, [
    eventId,
  ]);
  const read = await db.query<{ status: string }>(
    `SELECT status FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(read.rows[0]!.status, 'taken_back');
});

test('the three rungs that already shipped still work', async () => {
  const eventId = await seedEvent();
  for (const status of ['draft', 'event', 'published']) {
    await db.query(`UPDATE public.event_editorial SET status = $2 WHERE event_id = $1`, [
      eventId,
      status,
    ]);
    const read = await db.query<{ status: string }>(
      `SELECT status FROM public.event_editorial WHERE event_id = $1`,
      [eventId],
    );
    assert.equal(read.rows[0]!.status, status);
  }
});

test('a word nobody chose is still refused', async () => {
  const eventId = await seedEvent();
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_editorial SET status = 'unpublished' WHERE event_id = $1`, [
        eventId,
      ]),
    /event_editorial_status_check|violates check constraint/i,
    'the CHECK was widened past the fourth rung — any string would now be a status.',
  );
});

test('taking a story back and publishing it again keeps the same number', async () => {
  const eventId = await seedEvent();
  await db.query(
    `UPDATE public.event_editorial
        SET status = 'published', edition_volume = 1, edition_no = 4
      WHERE event_id = $1`,
    [eventId],
  );
  await db.query(`UPDATE public.event_editorial SET status = 'taken_back' WHERE event_id = $1`, [
    eventId,
  ]);
  await db.query(`UPDATE public.event_editorial SET status = 'published' WHERE event_id = $1`, [
    eventId,
  ]);
  const read = await db.query<{ edition_no: number; edition_volume: number }>(
    `SELECT edition_no, edition_volume FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(read.rows[0]!.edition_no, 4, 'the edition number moved across the round trip.');
  assert.equal(read.rows[0]!.edition_volume, 1);
});

test('the database still refuses to move a stamped number, from any state', async () => {
  const eventId = await seedEvent();
  await db.query(
    `UPDATE public.event_editorial
        SET status = 'published', edition_volume = 1, edition_no = 4
      WHERE event_id = $1`,
    [eventId],
  );
  await db.query(`UPDATE public.event_editorial SET status = 'taken_back' WHERE event_id = $1`, [
    eventId,
  ]);
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_editorial SET edition_no = 5 WHERE event_id = $1`, [eventId]),
    /stamped once and never moves/i,
  );
  const read = await db.query<{ edition_no: number }>(
    `SELECT edition_no FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(read.rows[0]!.edition_no, 4, 'the refused write changed the row anyway.');
});

test('every story carries a version a printed copy can name', async () => {
  const eventId = await seedEvent();
  const read = await db.query<{ story_version_at: Date | null }>(
    `SELECT story_version_at FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(
    read.rows[0]!.story_version_at,
    'a newly created story has no version, so its first print could not say when it was true.',
  );

  // And it moves — a blind `now()` write, never a read-modify-write counter.
  const before = read.rows[0]!.story_version_at;
  await db.query(
    `UPDATE public.event_editorial SET story_version_at = now() + interval '1 second' WHERE event_id = $1`,
    [eventId],
  );
  const after = await db.query<{ story_version_at: Date | null }>(
    `SELECT story_version_at FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.notEqual(String(after.rows[0]!.story_version_at), String(before));
});
