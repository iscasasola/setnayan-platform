/**
 * Photo-tag cap — 20 LIVE tags per photo (owner 2026-07-23).
 *
 * Migration 20270916200000 amends the cap two ways, in lockstep across the
 * enforce_photo_tag_cap trigger and both tag RPCs' pre-checks:
 *   1. cap raised 10 → 20 ("maximum generosity" — covers 12-seat rounds,
 *      king/long tables, big group shots);
 *   2. the count filters `removed_at IS NULL` — tombstoned ("Not me") removals
 *      no longer permanently burn cap slots. Before this fix a photo with 10
 *      removals silently rejected ALL future tags (the trigger RETURNs NULL,
 *      truncate semantics), shrinking the effective cap over a photo's life.
 *
 * Proven here against the FULL replayed prod schema (every migration, in order,
 * in an in-memory PGlite) by driving the BEFORE INSERT trigger directly:
 *   • 20 live tags land; the 21st is silently SKIPPED (no error, no row);
 *   • tombstoning 5 of the 20 frees 5 slots — the next insert is ACCEPTED;
 *   • the tombstoned guest's row still exists (gravestone kept — re-adding that
 *     guest is blocked by the (source_table, source_id, guest_id) UNIQUE, i.e.
 *     the never-silently-re-tag rule is untouched by the cap change).
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
let photoId: string;
const guestIds: string[] = [];

async function liveTagCount(): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.photo_tags
     WHERE source_table = 'papic_photos' AND source_id = $1 AND removed_at IS NULL`,
    [photoId],
  );
  return r.rows[0]!.n;
}

async function totalRowCount(): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.photo_tags
     WHERE source_table = 'papic_photos' AND source_id = $1`,
    [photoId],
  );
  return r.rows[0]!.n;
}

async function tag(guestId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
     VALUES ($1, 'papic_photos', $2, $3, 'manual_pick')
     ON CONFLICT (source_table, source_id, guest_id) DO NOTHING`,
    [eventId, photoId, guestId],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null); // operate as the migration owner — the trigger fires regardless

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Tag Cap Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;

  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_camera_addon', 'tagcap-test-token') RETURNING seat_id`,
    [eventId],
  );

  const photo = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key)
     VALUES ($1, $2, 'papic/test/tagcap.jpg') RETURNING photo_id`,
    [eventId, seat.rows[0]!.seat_id],
  );
  photoId = photo.rows[0]!.photo_id;

  // 22 guests: 20 to fill the cap, one to bounce off it, one to land post-tombstone.
  for (let i = 0; i < 22; i++) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, $2, 'Cap', 'both', 'friends') RETURNING guest_id`,
      [eventId, `Guest${String(i).padStart(2, '0')}`],
    );
    guestIds.push(g.rows[0]!.guest_id);
  }
});

after(async () => {
  await db?.close();
});

test('20 live tags land; the 21st is silently skipped (truncate, never error)', async () => {
  for (let i = 0; i < 20; i++) await tag(guestIds[i]!);
  assert.equal(await liveTagCount(), 20, 'all 20 tags under the cap landed');

  await tag(guestIds[20]!); // 21st distinct guest — over cap
  assert.equal(await liveTagCount(), 20, '21st tag was skipped, count stays 20');
  assert.equal(await totalRowCount(), 20, 'no row was inserted for the over-cap tag');
});

test('tombstoned tags free their slots — ghosts no longer burn the cap', async () => {
  // Remove 5 of the 20 (the shipped "Not me" shape: soft tombstone, row kept).
  await db.query(
    `UPDATE public.photo_tags SET removed_at = now(), removed_by = 'guest'
     WHERE source_table = 'papic_photos' AND source_id = $1
       AND guest_id = ANY($2::uuid[])`,
    [photoId, guestIds.slice(0, 5)],
  );
  assert.equal(await liveTagCount(), 15, '15 live after 5 tombstones');
  assert.equal(await totalRowCount(), 20, 'tombstoned rows are kept, not deleted');

  // Pre-fix, this insert was rejected: the count saw 20 rows (15 live + 5 ghosts).
  await tag(guestIds[21]!);
  assert.equal(await liveTagCount(), 16, 'a fresh guest tags fine — ghosts do not count');
});

test('the gravestone rule is untouched: a removed guest cannot be silently re-added', async () => {
  // Re-inserting a tombstoned guest hits the (source_table, source_id, guest_id)
  // UNIQUE → DO NOTHING. The removal stays a removal (revival is a deliberate,
  // separate affordance — not a side effect of the cap fix).
  await tag(guestIds[0]!); // guest 0 was tombstoned above
  const g0 = await db.query<{ removed_at: string | null }>(
    `SELECT removed_at FROM public.photo_tags
     WHERE source_table = 'papic_photos' AND source_id = $1 AND guest_id = $2`,
    [photoId, guestIds[0]!],
  );
  assert.equal(g0.rows.length, 1, 'exactly one row for the tombstoned guest');
  assert.ok(g0.rows[0]!.removed_at !== null, 'the tombstone survives a re-tag attempt');
});
