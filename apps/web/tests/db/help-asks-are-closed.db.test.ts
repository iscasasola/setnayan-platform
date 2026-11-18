/**
 * HELP — WHAT WE COULD NOT ANSWER IS KEPT (migration 20271350667658_help_questions_nobody_answered_yet.sql).
 * Opus review 2026-11-18: the PR shipped the table with no DB test. What the database itself must hold:
 *   1. RLS is on and neither browser role holds a grant — service role only (no name, no email in it, but the
 *      words people type are still theirs).
 *   2. The CHECKs refuse an unknown coverage / outcome and an empty or over-long question.
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

test('help_asks: RLS on, no browser grant', async () => {
  const r = await db.query<{ rls: boolean; a_sel: boolean; a_ins: boolean; u_sel: boolean; u_ins: boolean }>(
    `SELECT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.help_asks'::regclass) AS rls,
            has_table_privilege('anon', 'public.help_asks', 'SELECT') AS a_sel,
            has_table_privilege('anon', 'public.help_asks', 'INSERT') AS a_ins,
            has_table_privilege('authenticated', 'public.help_asks', 'SELECT') AS u_sel,
            has_table_privilege('authenticated', 'public.help_asks', 'INSERT') AS u_ins`,
  );
  assert.deepEqual(r.rows[0], { rls: true, a_sel: false, a_ins: false, u_sel: false, u_ins: false });
});

test('help_asks: a good row lands; bad ones are refused', async () => {
  await db.query(`INSERT INTO public.help_asks (words, coverage, outcome) VALUES ('how do I pay', 'user', 'none')`);
  for (const [words, coverage, outcome] of [
    ['   ', 'user', 'none'],
    ['x'.repeat(121), 'user', 'none'],
    ['ok', 'vendor', 'none'],
    ['ok', 'user', 'maybe'],
  ]) {
    await assert.rejects(
      () => db.query(`INSERT INTO public.help_asks (words, coverage, outcome) VALUES ($1, $2, $3)`, [words, coverage, outcome]),
      /check/i,
      `${JSON.stringify([words.slice(0, 10), coverage, outcome])} must be refused`,
    );
  }
});
