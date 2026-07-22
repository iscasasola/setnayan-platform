/**
 * Vendor Papic clip-duration CHECK — DB-level regression (executed, not prose).
 *
 * Guards migration 20270904061265_relax_vendor_papic_clip_duration_to_10s.sql,
 * the second half of the 10s/7pt clip-currency change (Papic_One_Pool_Model_Spec
 * §0, owner 2026-07-22). The vendor capture table
 * (public.vendor_papic_captures, created COUNSEL-GATED in 20270811377742) was
 * defined with an inline column CHECK clamping clip_duration_ms to <= 5000. The
 * guest lane moved to a 10-second cap but the vendor lane's DB CHECK stayed at
 * 5s, so a genuine 6–10s vendor clip that spends 7 points would violate the
 * constraint on INSERT. The new migration DROPs + re-ADDs
 * vendor_papic_captures_clip_duration_ms_check bounded at <= 10000.
 *
 * Verified against the FULL replayed prod schema (the replay applies the
 * counsel-gated table AND this relax migration in order). The PGlite session is
 * the table owner, so it bypasses RLS — only the CHECK gates the value here.
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

/** Insert one vendor capture; returns the query promise so callers can assert
 *  resolve/reject. vendor_profile_id has no FK, so a random uuid is fine. */
function insertCapture(mediaType: 'photo' | 'clip', clipDurationMs: number | null) {
  return db.query(
    `INSERT INTO public.vendor_papic_captures
       (vendor_profile_id, event_id, r2_object_key, media_type, clip_duration_ms)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
    [eventId, `r2://media/vendor-cap-${Date.now()}-${Math.random()}`, mediaType, clipDurationMs],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  await setAuthUid(db, null); // seed as the migration owner, not a user
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Vendor Papic Clip Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the clip-duration relax (no unapplied files)', () => {
  // If the new ALTER migration failed to replay (e.g. wrong constraint name,
  // syntax error), createReplayedDb() would have thrown before this point.
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('relaxed CHECK: a full 10s (10000ms) vendor clip now inserts — the blocker case', async () => {
  await assert.doesNotReject(() => insertCapture('clip', 10000), 'a 10000ms clip must pass');
});

test('relaxed CHECK: a 6s (6000ms) vendor clip — previously rejected at 5s — inserts', async () => {
  await assert.doesNotReject(() => insertCapture('clip', 6000), 'a 6000ms clip must pass');
});

test('CHECK still bites: an 11s (10001ms) vendor clip is rejected at the new ceiling', async () => {
  await assert.rejects(
    () => insertCapture('clip', 10001),
    /vendor_papic_captures_clip_duration_ms_check|check constraint/i,
    'a clip over 10000ms must still violate the CHECK',
  );
});

test('regression: still-valid values keep passing (5000ms boundary, NULL photo)', async () => {
  await assert.doesNotReject(() => insertCapture('clip', 5000), 'old 5000ms boundary still valid');
  await assert.doesNotReject(() => insertCapture('photo', null), 'a NULL-duration photo still valid');
});

test('CHECK still bites: a zero-length clip (0ms) is rejected (lower bound intact)', async () => {
  await assert.rejects(
    () => insertCapture('clip', 0),
    /vendor_papic_captures_clip_duration_ms_check|check constraint/i,
    '0ms must still violate the >0 lower bound',
  );
});

test('the constraint definition now bounds at 10000, not 5000', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.vendor_papic_captures'::regclass
        AND conname = 'vendor_papic_captures_clip_duration_ms_check'`,
  );
  assert.equal(r.rows.length, 1, 'the named constraint exists (single, not duplicated)');
  assert.match(r.rows[0]!.def, /<= 10000/, 'ceiling relaxed to 10000');
  assert.doesNotMatch(r.rows[0]!.def, /5000/, 'no stale 5000 ceiling remains');
});
