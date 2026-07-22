/**
 * Papic storage PR-4 — guest-capture delivery release (DB schema contract).
 *
 * lib/photo-delivery-release.ts `enqueueRelease` now lists papic_guest_captures
 * alongside papic_photos and writes photo_delivery_artifacts rows with
 * source_table='papic_guest_captures'. That was impossible before this PR: the
 * join table's source_table CHECK admitted 'papic_photos' ONLY. This test proves
 * the two SQL contracts that path depends on, against the FULL replayed prod
 * schema (all migrations, in order, in an in-memory PGlite):
 *
 *   1. The widened CHECK ACCEPTS a 'papic_guest_captures' artifact row and still
 *      REJECTS an unknown source_table.
 *   2. The (event_id, source_table, source_photo_id) dedupe unique index does NOT
 *      collide a seat row and a guest row that share an event + id — so a manual
 *      release enqueues both without one clobbering the other.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let eventId: string;
let userId: string;
let jobId: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user

  const user = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('release@example.com', jsonb_build_object('account_type', 'customer'::text))
     RETURNING id`,
  );
  userId = user.rows[0]!.id;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Guest Capture Release Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  const job = await db.query<{ job_id: string }>(
    `INSERT INTO public.photo_delivery_jobs
       (event_id, triggered_by_user_id, status, total_files, total_bytes)
     VALUES ($1, $2, 'queued', 0, 0) RETURNING job_id`,
    [eventId, userId],
  );
  jobId = job.rows[0]!.job_id;
});

after(async () => {
  await db?.close();
});

test('replay applied every migration (schema is the real prod shape)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('the widened CHECK accepts a papic_guest_captures artifact row', async () => {
  const captureId = '11111111-1111-1111-1111-111111111111';
  const res = await db.query<{ artifact_id: string; source_table: string }>(
    `INSERT INTO public.photo_delivery_artifacts
       (job_id, event_id, source_table, source_photo_id, r2_object_key, size_bytes)
     VALUES ($1, $2, 'papic_guest_captures', $3, $4, 8000000)
     RETURNING artifact_id, source_table`,
    [jobId, eventId, captureId, 'r2://setnayan-media/papic/guest/g1/cap.mp4'],
  );
  assert.equal(res.rows[0]!.source_table, 'papic_guest_captures');
});

test('the CHECK still REJECTS an unknown source_table (constraint stays bounded)', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.photo_delivery_artifacts
         (job_id, event_id, source_table, source_photo_id, r2_object_key)
       VALUES ($1, $2, 'some_other_table', $3, $4)`,
      [jobId, eventId, '22222222-2222-2222-2222-222222222222', 'r2://setnayan-media/x.jpg'],
    ),
    /source_table/i,
    'a source_table outside the allowed set must violate the CHECK',
  );
});

test('a seat row and a guest row sharing event + id do NOT collide (dedupe keyed on source_table)', async () => {
  // Same event_id + same source_photo_id UUID, different source_table. The unique
  // index is (event_id, source_table, source_photo_id) — so both must persist.
  const sharedId = '33333333-3333-3333-3333-333333333333';

  await db.query(
    `INSERT INTO public.photo_delivery_artifacts
       (job_id, event_id, source_table, source_photo_id, r2_object_key)
     VALUES ($1, $2, 'papic_photos', $3, $4)`,
    [jobId, eventId, sharedId, 'r2://setnayan-media/papic/seat/p.jpg'],
  );
  await db.query(
    `INSERT INTO public.photo_delivery_artifacts
       (job_id, event_id, source_table, source_photo_id, r2_object_key)
     VALUES ($1, $2, 'papic_guest_captures', $3, $4)`,
    [jobId, eventId, sharedId, 'r2://setnayan-media/papic/guest/p.mp4'],
  );

  const both = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.photo_delivery_artifacts
      WHERE event_id = $1 AND source_photo_id = $2`,
    [eventId, sharedId],
  );
  assert.equal(both.rows[0]!.n, '2', 'seat + guest rows coexist under the source_table-keyed dedupe');
});

test('re-enqueuing the SAME (event, source_table, id) is a dedupe conflict (one canonical row)', async () => {
  const dupId = '44444444-4444-4444-4444-444444444444';
  await db.query(
    `INSERT INTO public.photo_delivery_artifacts
       (job_id, event_id, source_table, source_photo_id, r2_object_key)
     VALUES ($1, $2, 'papic_guest_captures', $3, $4)`,
    [jobId, eventId, dupId, 'r2://setnayan-media/papic/guest/dup.mp4'],
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.photo_delivery_artifacts
         (job_id, event_id, source_table, source_photo_id, r2_object_key)
       VALUES ($1, $2, 'papic_guest_captures', $3, $4)`,
      [jobId, eventId, dupId, 'r2://setnayan-media/papic/guest/dup2.mp4'],
    ),
    /duplicate key|unique/i,
    'the dedupe index enforces one canonical row per (event, source_table, id)',
  );
});
