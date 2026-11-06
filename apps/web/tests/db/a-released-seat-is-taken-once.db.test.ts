/**
 * 🪑 RELEASE SEAT TAKES ONE SEAT — the one the host chose — under #6728's "a guest's +N IS their +1 rows" trigger
 * (migration 20271281805227), run against the REPLAYED schema.
 *
 * Owner, verbatim, 2026-10-21: *"…so we can alot the seat to another person in case they said no or they will not add
 * a +1 anymore"* → *"Release seat with Undo and bulk Select"*.
 *
 * Release seat (`bulkSoftDeleteGuestsForUndo(…, { release: true })`) writes in THIS order: the chosen seat is
 * soft-deleted, THEN its guest's number is lowered (`seatNumbersFollowTheRows`). The trigger then finds the live rows
 * already equal to the number and removes NOTHING — so the release never takes a second seat. The Undo is the same in
 * reverse (`restoreDeletedGuests`: the row back, THEN the number raised) — the trigger then mints NOTHING, so the seat
 * that comes back is the same row, never a fresh "TBA" beside it.
 *
 * 🛡 The reverse order is shown here too (number first): the trigger removes a placeholder of ITS choosing, before the
 * host's — so a release done that way takes two seats, or the wrong one. The action's order is held by the unit guard
 * (`a-seat-with-no-name-can-be-released.test.ts`, whose in-memory database models this trigger).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';

async function bringer(first: string, count: number): Promise<string> {
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_count) VALUES ($1, $2, 'Cruz', 'bride', 'family', $3) RETURNING guest_id`,
    [EVENT, first, count],
  );
  return r.rows[0]!.guest_id;
}
/** Their seats, oldest first — the trigger mints them with a strictly increasing seat label. */
async function seats(id: string, live = true): Promise<string[]> {
  return (
    await db.query<{ guest_id: string }>(
      `SELECT guest_id FROM public.guests WHERE plus_one_of_guest_id = $1 ${live ? 'AND deleted_at IS NULL' : ''} ORDER BY display_name`,
      [id],
    )
  ).rows.map((r) => r.guest_id);
}
const softDelete = (id: string) => db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [id]);
const undelete = (id: string) => db.query(`UPDATE public.guests SET deleted_at = NULL WHERE guest_id = $1`, [id]);
const setCount = (id: string, n: number) => db.query(`UPDATE public.guests SET plus_one_count = $1 WHERE guest_id = $2`, [n, id]);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Ana and Ben', 'birthday', 'ana-and-ben') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

test('release, in the action’s order: the chosen seat goes, the number drops, and the trigger takes nothing more', async () => {
  const ana = await bringer('Ana', 2);
  const [older, newer] = await seats(ana);
  assert.ok(older && newer, 'the trigger did not mint Ana’s two seats (the test would pass vacuously)');
  // Release the OLDER seat — the trigger, left to itself, would pick the newest.
  await softDelete(older!);
  await setCount(ana, 1);
  assert.deepEqual(await seats(ana), [newer], 'releasing one seat took another (or left the chosen one)');
  // Undo: the row back, THEN the number — the same row, and no fresh "TBA" minted beside it.
  await undelete(older!);
  await setCount(ana, 2);
  assert.deepEqual(await seats(ana), [older, newer], 'the Undo did not bring back the same seat');
  assert.equal((await seats(ana, false)).length, 2, 'the Undo minted an extra seat');
});

test('the reverse order (the number first) lets the TRIGGER pick the seat — why the action deletes the chosen one first', async () => {
  const bea = await bringer('Bea', 2);
  const before = await seats(bea);
  assert.equal(before.length, 2);
  await setCount(bea, 1); // the trigger removes a placeholder of ITS choosing (newest first) — before any host's choice
  assert.equal((await seats(bea)).length, 1, 'lowering the number no longer removes a seat — re-read this test’s premise');
  // A release that came after would take the host's seat as well: one release, two seats (or the wrong one) gone.
});
