/**
 * Papic clip full-res drop — DB-level destructive-safety regression (executed).
 *
 * Guards the clip branch of lib/papic-fullres-drop.ts (storage PR-2 · "the cost
 * win"): a clip's RAW video r2_object_key becomes droppable once a durable web
 * copy exists, and the drop deletes ONLY the raw — the poster still + web copy
 * survive forever. This test proves the two SQL contracts that path depends on,
 * against the FULL replayed prod schema (all migrations, in order, in an
 * in-memory PGlite — no docker, no network):
 *
 *   1. CANDIDATE QUERY: the sweep only selects clips with a NON-NULL
 *      clip_web_r2_key (`.not('clip_web_r2_key','is',null)`). A clip whose web
 *      copy hasn't landed yet (NULL key) is NEVER a candidate — this is what
 *      keeps every existing / un-backfilled clip safe before the drop can fire.
 *
 *   2. DROP STAMP: the drop's UPDATE sets ONLY full_res_dropped_at. The survivors
 *      — clip_web_r2_key (playable forever-copy), poster_r2_key + display_r2_key
 *      (the still), and r2_object_key itself (kept as the Drive-match / history
 *      key; only its R2 BYTES are deleted) — are left byte-for-byte intact.
 *
 * The PGlite session owns the tables so it bypasses RLS; this exercises the
 * schema + the exact filters/writes the sweep issues, not policy.
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
let guestId: string;

// 120 days ago — past the 90-day retention fuse.
const OLD_CAPTURED = new Date(Date.now() - 120 * 86_400_000).toISOString();
// The sweep's cutoff is `now - retentionDays`; anything captured before it is
// age-eligible. Use a fixed 90-day cutoff for the candidate-query assertion.
const CUTOFF = new Date(Date.now() - 90 * 86_400_000).toISOString();

const RAW = 'r2://setnayan-media/papic/guest/g1/papic-100.mp4';
const POSTER = 'r2://setnayan-media/papic/guest/g1/papic-100-poster.jpg';
const WEB = 'r2://setnayan-media/papic/guest/g1/papic-200-web.mp4';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Papic Clip Drop Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Clip', 'Drop', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  guestId = guest.rows[0]!.guest_id;
});

after(async () => {
  await db?.close();
});

test('replay applied every migration (schema is the real prod shape)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('candidate query: a clip with a web copy is selected; a NULL-web-copy clip is NOT', async () => {
  // Eligible: old clip WITH a distinct web copy + real bytes.
  const withWeb = await db.query<{ capture_id: string }>(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, poster_r2_key, display_r2_key,
        clip_web_r2_key, clip_web_bytes, media_type, captured_at)
     VALUES ($1, $2, $3, $4, $4, $5, 512000, 'clip', $6)
     RETURNING capture_id`,
    [eventId, guestId, RAW, POSTER, WEB, OLD_CAPTURED],
  );
  const eligibleId = withWeb.rows[0]!.capture_id;

  // NOT a candidate: old clip whose web copy hasn't landed (NULL key). Must never
  // be swept — dropping its raw would lose the only playable copy.
  const noWeb = await db.query<{ capture_id: string }>(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, poster_r2_key, display_r2_key,
        clip_web_r2_key, media_type, captured_at)
     VALUES ($1, $2, $3, $4, $4, NULL, 'clip', $5)
     RETURNING capture_id`,
    [eventId, guestId, 'r2://setnayan-media/papic/guest/g1/no-web.mp4', POSTER, OLD_CAPTURED],
  );
  const ineligibleId = noWeb.rows[0]!.capture_id;

  // The exact filter the sweep issues for guest clips.
  const candidates = await db.query<{ capture_id: string }>(
    `SELECT capture_id FROM public.papic_guest_captures
      WHERE media_type = 'clip'
        AND full_res_dropped_at IS NULL
        AND clip_web_r2_key IS NOT NULL
        AND captured_at < $1`,
    [CUTOFF],
  );
  const ids = candidates.rows.map((r) => r.capture_id);
  assert.ok(ids.includes(eligibleId), 'clip with a web copy IS a candidate');
  assert.ok(!ids.includes(ineligibleId), 'clip with NULL web copy is NEVER a candidate');
});

test('drop stamp: sets ONLY full_res_dropped_at — poster, display, web copy + raw key survive', async () => {
  const ins = await db.query<{ capture_id: string }>(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, poster_r2_key, display_r2_key,
        clip_web_r2_key, clip_web_bytes, media_type, captured_at)
     VALUES ($1, $2, $3, $4, $4, $5, 512000, 'clip', $6)
     RETURNING capture_id`,
    [eventId, guestId, RAW, POSTER, WEB, OLD_CAPTURED],
  );
  const id = ins.rows[0]!.capture_id;

  // The drop's write: stamp the timestamp, touch nothing else.
  await db.query(
    `UPDATE public.papic_guest_captures
        SET full_res_dropped_at = NOW()
      WHERE capture_id = $1`,
    [id],
  );

  const after = await db.query<{
    r2_object_key: string | null;
    poster_r2_key: string | null;
    display_r2_key: string | null;
    clip_web_r2_key: string | null;
    clip_web_bytes: string | null;
    full_res_dropped_at: string | null;
  }>(
    `SELECT r2_object_key, poster_r2_key, display_r2_key, clip_web_r2_key,
            clip_web_bytes, full_res_dropped_at
       FROM public.papic_guest_captures WHERE capture_id = $1`,
    [id],
  );
  const row = after.rows[0]!;
  // The survivors are byte-for-byte intact.
  assert.equal(row.clip_web_r2_key, WEB, 'web copy key preserved (still served by resolvePlayRef)');
  assert.equal(row.poster_r2_key, POSTER, 'poster still preserved');
  assert.equal(row.display_r2_key, POSTER, 'display still preserved');
  assert.equal(Number(row.clip_web_bytes), 512_000, 'web-copy bytes preserved');
  // The raw KEY stays populated (Drive-match / history); only its R2 bytes get
  // deleted, and the stamp is what marks the key dead for the resolvers.
  assert.equal(row.r2_object_key, RAW, 'raw key row stays populated post-drop');
  assert.ok(row.full_res_dropped_at, 'full_res_dropped_at stamped');
});

test('papic_photos (seat) clip: same drop-stamp invariant holds', async () => {
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_5_seats', 'tok-clip-drop') RETURNING seat_id`,
    [eventId],
  );
  const seatId = seat.rows[0]!.seat_id;

  const ins = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, poster_r2_key, display_r2_key,
        clip_web_r2_key, clip_web_bytes, photo_type, captured_at)
     VALUES ($1, $2, $3, $4, $4, $5, 480000, 'clip', $6)
     RETURNING photo_id`,
    [eventId, seatId, RAW, POSTER, WEB, OLD_CAPTURED],
  );
  const id = ins.rows[0]!.photo_id;

  await db.query(
    `UPDATE public.papic_photos SET full_res_dropped_at = NOW() WHERE photo_id = $1`,
    [id],
  );

  const after = await db.query<{
    clip_web_r2_key: string | null;
    poster_r2_key: string | null;
    full_res_dropped_at: string | null;
  }>(
    `SELECT clip_web_r2_key, poster_r2_key, full_res_dropped_at
       FROM public.papic_photos WHERE photo_id = $1`,
    [id],
  );
  const row = after.rows[0]!;
  assert.equal(row.clip_web_r2_key, WEB);
  assert.equal(row.poster_r2_key, POSTER);
  assert.ok(row.full_res_dropped_at);
});
