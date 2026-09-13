/**
 * ONE DOOR, ONE ANSWER — the entrance backfill, proved against a real schema.
 *
 * There were two independent answers to "where is the door", each with its own
 * editor and neither writing the other:
 *
 *   · events.venue_entrance_x/y     — Indoor Blueprint studio → read ONLY by
 *                                     /[slug]/find-my-table and the tour.
 *   · event_floor_plan.entrance_x/y — the seating lab's floor markers → read by
 *                                     the lab, the PUBLIC venue walk,
 *                                     plan3d-scene and venue-decor.
 *
 * Both guest-facing. Move the door in one editor and the other still pointed at
 * the old one; they agreed only because both defaulted to bottom-centre.
 *
 * ⚠ THE PROMISE THIS FILE EXISTS TO PIN: the backfill must NEVER MOVE A DOOR
 * SOMEBODY CAN ALREADY SEE. An event whose lab doorway is ENABLED keeps it —
 * that is the door currently drawn in the 3D room and walked through on the
 * public page. Only events with no enabled doorway inherit the blueprint
 * position. A backfill that "unified" by overwriting would silently relocate
 * the entrance of every event that had used both editors.
 *
 * ⚠ IT RUNS THE SHIPPED SQL, NOT A COPY. The migration file is read off disk
 * and executed, so this cannot drift from what actually deploys — a hand-typed
 * restatement of the backfill would pass while the real one did something else.
 * Re-executing it is also the idempotency proof.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20271199899381_one_door_one_answer_backfill_entrance.sql',
);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function newEvent(name: string, x: number | null, y: number | null): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, venue_entrance_x, venue_entrance_y)
     VALUES ($1, 'celebration', $2, $3) RETURNING event_id`,
    [name, x, y],
  );
  return r.rows[0]!.event_id;
}

async function plan(eventId: string) {
  const r = await db.query<{ entrance_x: string; entrance_y: string; entrance_enabled: boolean }>(
    `SELECT entrance_x, entrance_y, entrance_enabled FROM public.event_floor_plan WHERE event_id = $1`,
    [eventId],
  );
  const row = r.rows[0];
  return row ? { x: Number(row.entrance_x), y: Number(row.entrance_y), on: row.entrance_enabled } : null;
}

/** Executes the migration exactly as it ships. */
async function runBackfill() {
  await db.exec(readFileSync(MIGRATION, 'utf8'));
}

test('a blueprint door with no floor plan is carried across and switched ON', async () => {
  const id = await newEvent('Inherits', 20, 80);
  assert.equal(await plan(id), null, 'precondition: no floor-plan row yet');

  await runBackfill();

  assert.deepEqual(await plan(id), { x: 20, y: 80, on: true });
});

test('a door the couple can already SEE is never moved', async () => {
  // Both editors used. The lab door is what the 3D room draws today.
  const id = await newEvent('Both', 20, 80);
  await db.query(
    `INSERT INTO public.event_floor_plan (event_id, entrance_x, entrance_y, entrance_enabled)
     VALUES ($1, 70, 30, TRUE)`,
    [id],
  );

  await runBackfill();

  assert.deepEqual(
    await plan(id),
    { x: 70, y: 30, on: true },
    'the ENABLED lab door must survive — overwriting it would relocate the ' +
      'entrance of every event that had used both editors.',
  );
});

test('a DISABLED floor-plan doorway does inherit the blueprint position', async () => {
  // Nothing is drawn today, so nothing visible moves.
  const id = await newEvent('Disabled', 15, 85);
  await db.query(
    `INSERT INTO public.event_floor_plan (event_id, entrance_x, entrance_y, entrance_enabled)
     VALUES ($1, 50, 94, FALSE)`,
    [id],
  );

  await runBackfill();

  assert.deepEqual(await plan(id), { x: 15, y: 85, on: true });
});

test('an event that never used the blueprint gains no doorway', async () => {
  const id = await newEvent('Never', null, null);
  await runBackfill();
  assert.equal(await plan(id), null, 'a NULL blueprint must not mint a door');
});

test('re-running the backfill changes nothing', async () => {
  const id = await newEvent('Idempotent', 33, 66);
  await runBackfill();
  const first = await plan(id);
  await runBackfill();
  assert.deepEqual(await plan(id), first);
});

test('the deprecated columns are labelled, so the next reader is told', async () => {
  await runBackfill();
  const r = await db.query<{ d: string | null }>(
    `SELECT col_description('public.events'::regclass,
       (SELECT attnum FROM pg_attribute
         WHERE attrelid = 'public.events'::regclass AND attname = 'venue_entrance_x')) AS d`,
  );
  assert.match(r.rows[0]?.d ?? '', /DEPRECATED/, 'the retired column must say so in the schema');
});
