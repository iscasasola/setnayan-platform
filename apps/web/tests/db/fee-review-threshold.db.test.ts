/**
 * The review count is the owner's (2026-10-12 #12: admin-set, default 2) and has
 * a home on platform_settings — migration 20271267295101.
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

test('seeded at the owner’s default of 2', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT fee_review_unsettled_events_min AS n FROM public.platform_settings WHERE id = 1`,
  );
  assert.equal(r.rows[0]!.n, 2);
});

test('a count below 1 is refused', async () => {
  await assert.rejects(
    db.query(`UPDATE public.platform_settings SET fee_review_unsettled_events_min = 0 WHERE id = 1`),
    /platform_settings_fee_review_unsettled_events_min_positive/,
  );
});
