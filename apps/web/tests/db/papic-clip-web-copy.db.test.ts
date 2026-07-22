/**
 * Papic clip web-copy columns — DB-level regression (executed, not prose).
 *
 * Guards migration 20270906703321_papic_clip_web_copy_at_capture.sql (storage
 * PR-1 · Papic_One_Pool_Model_Spec §0). It ADDs two nullable columns —
 * clip_web_r2_key TEXT + clip_web_bytes bigint — to BOTH capture tables so a
 * small ~0.5 MB H.264 web copy of every clip can be persisted at capture and
 * served by resolvePlayRef, leaving the heavy raw clip droppable in a later PR.
 *
 * Verified against the FULL replayed prod schema (all migrations, in order, in
 * an in-memory PGlite — no docker, no network). The PGlite session owns the
 * tables, so it bypasses RLS; this test only exercises the schema shape + that a
 * clip row round-trips the two new columns.
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
let seatId: string;
let guestId: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // seed as the migration owner, not a user
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Papic Clip Web-Copy Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  // Minimal FK parents so a real clip row can be inserted into each table.
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_5_seats', 'tok-web-copy-test') RETURNING seat_id`,
    [eventId],
  );
  seatId = seat.rows[0]!.seat_id;

  const guest = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Web', 'Copy', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  guestId = guest.rows[0]!.guest_id;
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the clip web-copy add (no unapplied files)', () => {
  // If the new ALTER migration failed to replay (syntax error, wrong table), the
  // replay harness would have thrown before this point.
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

for (const table of ['papic_photos', 'papic_guest_captures'] as const) {
  test(`${table}: both web-copy columns exist, nullable, correct types`, async () => {
    const cols = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND column_name IN ('clip_web_r2_key', 'clip_web_bytes')
        ORDER BY column_name`,
      [table],
    );
    assert.equal(cols.rows.length, 2, 'both columns present');
    const byName = new Map(cols.rows.map((r) => [r.column_name, r]));
    assert.equal(byName.get('clip_web_r2_key')!.data_type, 'text');
    assert.equal(byName.get('clip_web_r2_key')!.is_nullable, 'YES');
    assert.equal(byName.get('clip_web_bytes')!.data_type, 'bigint');
    assert.equal(byName.get('clip_web_bytes')!.is_nullable, 'YES');
  });
}

test('papic_photos: a clip row round-trips clip_web_r2_key + clip_web_bytes', async () => {
  const web = 'r2://setnayan-media/papic/event-x/seat-y/uuid-papic-web.mp4';
  const raw = 'r2://setnayan-media/papic/event-x/seat-y/uuid-papic.mp4';
  const r = await db.query<{ clip_web_r2_key: string | null; clip_web_bytes: string | null }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, photo_type, clip_web_r2_key, clip_web_bytes)
     VALUES ($1, $2, $3, 'clip', $4, $5)
     RETURNING clip_web_r2_key, clip_web_bytes`,
    [eventId, seatId, raw, web, 512_000],
  );
  assert.equal(r.rows[0]!.clip_web_r2_key, web);
  // bigint comes back as a string over the wire — compare numerically.
  assert.equal(Number(r.rows[0]!.clip_web_bytes), 512_000);
});

test('papic_photos: a photo row leaves both columns NULL (the normal default)', async () => {
  const r = await db.query<{ clip_web_r2_key: string | null; clip_web_bytes: string | null }>(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, photo_type)
     VALUES ($1, $2, $3, 'photo')
     RETURNING clip_web_r2_key, clip_web_bytes`,
    [eventId, seatId, 'r2://setnayan-media/papic/event-x/seat-y/uuid-photo.jpg'],
  );
  assert.equal(r.rows[0]!.clip_web_r2_key, null);
  assert.equal(r.rows[0]!.clip_web_bytes, null);
});

test('papic_guest_captures: a clip row round-trips the web-copy columns', async () => {
  const web = 'r2://setnayan-media/papic/guest/g1/papic-123-web.mp4';
  const r = await db.query<{ clip_web_r2_key: string | null; clip_web_bytes: string | null }>(
    `INSERT INTO public.papic_guest_captures
       (event_id, guest_id, r2_object_key, media_type, clip_web_r2_key, clip_web_bytes)
     VALUES ($1, $2, $3, 'clip', $4, $5)
     RETURNING clip_web_r2_key, clip_web_bytes`,
    [eventId, guestId, 'r2://setnayan-media/papic/guest/g1/papic-123.mp4', web, 431_000],
  );
  assert.equal(r.rows[0]!.clip_web_r2_key, web);
  assert.equal(Number(r.rows[0]!.clip_web_bytes), 431_000);
});
