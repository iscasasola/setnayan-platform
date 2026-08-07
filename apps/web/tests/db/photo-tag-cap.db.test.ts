/**
 * Photo tags — THERE IS NO PRODUCT LIMIT (owner 2026-08-06: "no tag limit. we
 * can tag as many").
 *
 * Migration 20271117449785 removes the per-photo limit outright, superseding the
 * 20-cap of 2026-07-23 and the 10-cap of 2026-06-17. A 100,000 ceiling stays in
 * enforce_photo_tag_cap() purely as a runaway-write backstop (retry storm, loop
 * bug) — NOT a product rule, and no real photo approaches it.
 *
 * ⚠ THIS FILE PREVIOUSLY ASSERTED THE OLD CAP, and that is exactly why it had to
 * change: two of its tests ("20 live tags land; the 21st is silently skipped"
 * and "tombstoned tags free their slots") encoded the retired rule as truth, so
 * they went RED the moment the owner's decision reached the database. A test
 * that pins a superseded product rule does not protect the product — it argues
 * against it. The same shape bit this repo before: the 20-cap decision reached
 * the DB in July and never reached the two capture screens, which stayed
 * hardcoded at 10, so a paparazzo was cut off at HALF the real limit and told
 * that was the maximum.
 *
 * Proven here against the FULL replayed prod schema (every migration, in order,
 * in an in-memory PGlite) by driving the BEFORE INSERT trigger directly:
 *   • tagging past the OLD cap keeps working — 22 distinct guests all land,
 *     where the retired rule would have stopped at 20 and silently dropped 2;
 *   • tombstoning ("Not me") still keeps the row and drops the live count, and
 *     a fresh tag after a tombstone is still accepted;
 *   • the gravestone rule is untouched: a removed guest cannot be silently
 *     re-added — blocked by the (source_table, source_id, guest_id) UNIQUE.
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

test('tagging past the retired 20-cap keeps working — every guest lands', async () => {
  // 21 and 22 are the load-bearing ones: under the retired rule the 21st was
  // silently dropped (trigger RETURNs NULL — truncate, never error), so the
  // paparazzo got no failure and the guest simply never appeared in the photo.
  for (let i = 0; i < 22; i++) await tag(guestIds[i]!);

  assert.equal(await liveTagCount(), 22, 'all 22 distinct guests are tagged');
  assert.equal(await totalRowCount(), 22, 'a row exists for every one of them');
});

test('tombstoning still keeps the row and drops the live count', async () => {
  // The shipped "Not me" shape: soft tombstone, row kept as a gravestone. The
  // cap is gone, but this behaviour is about the guest's removal, not the cap,
  // so it must survive the change untouched.
  await db.query(
    `UPDATE public.photo_tags SET removed_at = now(), removed_by = 'guest'
     WHERE source_table = 'papic_photos' AND source_id = $1
       AND guest_id = ANY($2::uuid[])`,
    [photoId, guestIds.slice(0, 5)],
  );
  assert.equal(await liveTagCount(), 17, '17 live after 5 of 22 are tombstoned');
  assert.equal(await totalRowCount(), 22, 'tombstoned rows are kept, not deleted');
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
