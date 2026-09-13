/**
 * "NO. 1, THEIRS FOREVER" — enforced by the database, not by the action.
 *
 * `03` §2.4 · 08 step 1.6. The edition number used to be recomputed on every
 * render, so it moved. It is now stamped once at publish — and the app being
 * right is not the same as the number being safe:
 *
 *   • `authenticated` holds TABLE-LEVEL UPDATE on `event_editorial` (read out of
 *     production, all three roles table-level), and `event_editorial_couple_rw`
 *     admits the host. So a host can PATCH `/rest/v1/event_editorial` with the
 *     public anon key and their own session and never run the server action.
 *
 * These tests therefore attack it the way a hand-made request would: a plain
 * `UPDATE`, no application code anywhere.
 *
 * ⚠ THIS ONE GENUINELY RAISES, so `assert.rejects` is the right shape — unlike
 * an RLS policy (which returns zero rows) or a PIN trigger (which overwrites).
 * Both mistakes are recorded in this repo, so the last test proves the refused
 * write left the row exactly as it was rather than silently succeeding.
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

/** One event and its story row, stamped or not. */
async function seed(stamp: { volume: number; no: number } | null): Promise<string> {
  n += 1;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Edition test ${n}', 'birthday', DATE '2027-06-01') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  /*
    ⚠ THE STORY ROW ALREADY EXISTS. `provision_event_editorial_on_create`
    (migration 20270316888459) writes one for every event the moment it is
    created — which is also why "only me" had to become a real audience rather
    than an absent row. Inserting here duplicates the UNIQUE key; the seed
    UPDATES the row the trigger already made.
  */
  await db.query(
    `UPDATE public.event_editorial
        SET status = 'published', edition_volume = $2, edition_no = $3
      WHERE event_id = $1`,
    [eventId, stamp?.volume ?? null, stamp?.no ?? null],
  );
  return eventId;
}

test('the columns exist and start empty', async () => {
  const eventId = await seed(null);
  const r = await db.query<{ edition_no: number | null; edition_volume: number | null; room_snapshot: unknown; publish_consent_at: string | null }>(
    `SELECT edition_no, edition_volume, room_snapshot, publish_consent_at
       FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.edition_no, null);
  assert.equal(r.rows[0]!.edition_volume, null);
  assert.equal(r.rows[0]!.room_snapshot, null);
  assert.equal(r.rows[0]!.publish_consent_at, null);
});

test('an UNSTAMPED row can be stamped — the write the action makes', async () => {
  const eventId = await seed(null);
  await db.query(
    `UPDATE public.event_editorial
        SET edition_volume = 1, edition_no = 4
      WHERE event_id = $1`,
    [eventId],
  );
  const r = await db.query<{ edition_no: number }>(
    `SELECT edition_no FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.edition_no, 4);
});

test('A STAMPED NUMBER CANNOT BE MOVED — by anybody', async () => {
  const eventId = await seed({ volume: 1, no: 4 });
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_editorial SET edition_no = 5 WHERE event_id = $1`, [
        eventId,
      ]),
    /stamped once and never moves/,
    'a stamped edition number was moved',
  );
});

test('a stamped number cannot be ERASED either', async () => {
  // Clearing it is how a caller would "make room" to re-stamp. `IS DISTINCT
  // FROM` catches NULL, which a plain `<>` would let through.
  const eventId = await seed({ volume: 1, no: 4 });
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_editorial SET edition_no = NULL WHERE event_id = $1`, [
        eventId,
      ]),
    /stamped once and never moves/,
    'a stamped edition number was cleared',
  );
});

test('the VOLUME is protected the same way', async () => {
  const eventId = await seed({ volume: 1, no: 4 });
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_editorial SET edition_volume = 2 WHERE event_id = $1`, [
        eventId,
      ]),
    /stamped once and never moves/,
    'a stamped volume was moved',
  );
});

test('re-writing the SAME number is not a change, so it passes', async () => {
  // The action upserts the whole row; sending back what is already there must
  // not raise, or every later save of a published story would fail.
  const eventId = await seed({ volume: 1, no: 4 });
  await db.query(
    `UPDATE public.event_editorial
        SET edition_volume = 1, edition_no = 4, updated_at = now()
      WHERE event_id = $1`,
    [eventId],
  );
  const r = await db.query<{ edition_no: number }>(
    `SELECT edition_no FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.edition_no, 4);
});

test('everything ELSE on a stamped row still updates', async () => {
  // A trigger that refused the whole row would take the story down with the
  // number — the host could never edit a published story again.
  const eventId = await seed({ volume: 1, no: 4 });
  await db.query(
    `UPDATE public.event_editorial SET status = 'event' WHERE event_id = $1`,
    [eventId],
  );
  const r = await db.query<{ status: string; edition_no: number }>(
    `SELECT status, edition_no FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.status, 'event', 'taking a story back was refused');
  assert.equal(r.rows[0]!.edition_no, 4, 'the number did not survive the move');
});

test('A REFUSED WRITE LEFT THE ROW UNTOUCHED — it did not quietly succeed', async () => {
  /*
    The distinction this repo has got wrong before: an RLS refusal returns zero
    rows and looks like a pass, and a PIN trigger overwrites and also looks like
    a pass. This one RAISES, so the row must be byte-identical afterwards.
  */
  const eventId = await seed({ volume: 1, no: 4 });
  await assert.rejects(() =>
    db.query(
      `UPDATE public.event_editorial SET edition_no = 99, status = 'draft' WHERE event_id = $1`,
      [eventId],
    ),
  );
  const r = await db.query<{ status: string; edition_no: number }>(
    `SELECT status, edition_no FROM public.event_editorial WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(r.rows[0]!.edition_no, 4);
  assert.equal(r.rows[0]!.status, 'published', 'the refused statement half-applied');
});
