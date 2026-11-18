/**
 * WHO RUNS THE CHECK-IN DESK — events.checkin_desk_access (migration 20271350882870_checkin_desk_access.sql).
 * Opus review 2026-11-18: the PR shipped the column with no DB test. What the database itself must hold:
 *   1. Neither browser role can read or write it (service role only, read after the door-crew check and written
 *      after the host check — a grant would let any member past that check).
 *   2. It holds an object or nothing.
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
  await replay?.db?.close?.();
});

test('checkin_desk_access: no browser role reads or writes it', async () => {
  const r = await db.query<Record<string, boolean>>(
    `SELECT has_column_privilege('anon', 'public.events', 'checkin_desk_access', 'SELECT') AS anon_sel,
            has_column_privilege('anon', 'public.events', 'checkin_desk_access', 'UPDATE') AS anon_upd,
            has_column_privilege('authenticated', 'public.events', 'checkin_desk_access', 'UPDATE') AS auth_upd`,
  );
  assert.deepEqual(r.rows[0], { anon_sel: false, anon_upd: false, auth_upd: false });
});

test('checkin_desk_access: an object or nothing', async () => {
  const c = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'events_checkin_desk_access_is_object'`,
  );
  assert.equal(c.rows.length, 1, 'the CHECK must exist');
  assert.match(c.rows[0]!.def, /jsonb_typeof\(checkin_desk_access\) = 'object'/);
});
