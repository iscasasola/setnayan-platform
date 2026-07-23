/**
 * Shared Pool Gallery + Self-Link (migration 20270917300000, OnTheDay build ⑥).
 *
 * Proven against the FULL replayed prod schema (every migration, in order, in
 * an in-memory PGlite):
 *   • events.pool_gallery_open defaults FALSE and, while FALSE, the reader
 *     returns EMPTY and the link RPC denies ('pool_closed') — the inert hold;
 *   • the reader's strict outbound stack: 'clean' allowlist, hidden_at,
 *     web-copy-or-skip (a row with only the geo-bearing r2_object_key never
 *     serves), the photo_consent veto, and the FaceBlock baked-blur rule
 *     (FB event ⇒ only baked photos serve, ONLY the wall_safe key, clips
 *     excluded entirely);
 *   • self-link: photos-only (clips rejected), manual_pick lands, live-only
 *     20-cap pre-check matches the 20270916200000 trigger, own-tombstone
 *     revive works, host removal is final, unlink is idempotent.
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
let viewerId: string; // the browsing/linking guest
let otherId: string; // a second guest (consent-veto subject)
const guestIds: string[] = [];

let cleanPhotoId: string; // clean + thumb → serves
let bareCleanId: string; // clean but NO derivative → never serves
let unscreenedId: string; // unscreened → never serves
let hiddenId: string; // clean but hidden → never serves
let clipId: string; // clean clip with clip_web → serves, not linkable

async function poolRows(guestId: string): Promise<
  {
    source_table: string;
    source_id: string;
    media_type: string;
    display_r2_key: string | null;
    thumb_r2_key: string | null;
    clip_web_r2_key: string | null;
    linked: boolean;
  }[]
> {
  const r = await db.query<{
    source_table: string;
    source_id: string;
    media_type: string;
    display_r2_key: string | null;
    thumb_r2_key: string | null;
    clip_web_r2_key: string | null;
    linked: boolean;
  }>(`SELECT * FROM public.guest_pool_gallery($1)`, [guestId]);
  return r.rows;
}

async function link(
  guestId: string,
  table: string,
  id: string,
): Promise<Record<string, unknown>> {
  const r = await db.query<{ guest_link_capture: Record<string, unknown> }>(
    `SELECT public.guest_link_capture($1, $2, $3) AS guest_link_capture`,
    [guestId, table, id],
  );
  return r.rows[0]!.guest_link_capture;
}

async function unlink(
  guestId: string,
  table: string,
  id: string,
): Promise<Record<string, unknown>> {
  const r = await db.query<{ guest_unlink_capture: Record<string, unknown> }>(
    `SELECT public.guest_unlink_capture($1, $2, $3) AS guest_unlink_capture`,
    [guestId, table, id],
  );
  return r.rows[0]!.guest_unlink_capture;
}

async function addPhoto(opts: {
  state?: string;
  thumb?: string | null;
  hidden?: boolean;
  type?: string;
  clipWeb?: string | null;
  baked?: boolean;
}): Promise<string> {
  const r = await db.query<{ photo_id: string }>(
    `INSERT INTO public.papic_photos
       (event_id, paparazzi_seat_id, r2_object_key, photo_type, moderation_state,
        thumb_r2_key, clip_web_r2_key, hidden_at, faceblock_baked_at, wall_safe_r2_key)
     VALUES ($1, $2, 'papic/test/original-geo.jpg', $3, $4, $5, $6,
             CASE WHEN $7 THEN now() END,
             CASE WHEN $8 THEN now() END,
             CASE WHEN $8 THEN 'papic/test/baked-blur.jpg' END)
     RETURNING photo_id`,
    [
      eventId,
      seatId,
      opts.type ?? 'photo',
      opts.state ?? 'clean',
      opts.thumb === undefined ? 'papic/test/thumb.jpg' : opts.thumb,
      opts.clipWeb ?? null,
      opts.hidden ?? false,
      opts.baked ?? false,
    ],
  );
  return r.rows[0]!.photo_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  const ev = await db.query<{ event_id: string; pool_gallery_open: boolean }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Pool Gallery Event', 'birthday') RETURNING event_id, pool_gallery_open`,
  );
  eventId = ev.rows[0]!.event_id;
  assert.equal(ev.rows[0]!.pool_gallery_open, false, 'toggle defaults FALSE (the ship gate)');

  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token)
     VALUES ($1, 1, 'paparazzi_camera_addon', 'pool-test-token') RETURNING seat_id`,
    [eventId],
  );
  seatId = seat.rows[0]!.seat_id;

  for (let i = 0; i < 24; i++) {
    const g = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, $2, 'Pool', 'both', 'friends') RETURNING guest_id`,
      [eventId, `Guest${String(i).padStart(2, '0')}`],
    );
    guestIds.push(g.rows[0]!.guest_id);
  }
  viewerId = guestIds[0]!;
  otherId = guestIds[1]!;

  cleanPhotoId = await addPhoto({});
  bareCleanId = await addPhoto({ thumb: null }); // clean, but only the geo original
  unscreenedId = await addPhoto({ state: 'unscreened' });
  hiddenId = await addPhoto({ hidden: true });
  clipId = await addPhoto({ type: 'clip', thumb: null, clipWeb: 'papic/test/clip-web.mp4' });
});

after(async () => {
  await db?.close();
});

test('toggle OFF: reader is empty, link denies pool_closed (the inert hold)', async () => {
  assert.equal((await poolRows(viewerId)).length, 0, 'closed pool serves nothing');
  const res = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'pool_closed');
});

test('toggle ON: only clean + unhidden + web-copy rows serve; never the geo original', async () => {
  await db.query(`UPDATE public.events SET pool_gallery_open = TRUE WHERE event_id = $1`, [
    eventId,
  ]);
  const rows = await poolRows(viewerId);
  const ids = rows.map((r) => r.source_id);
  assert.ok(ids.includes(cleanPhotoId), 'clean photo with a thumb serves');
  assert.ok(ids.includes(clipId), 'clean clip with a web copy serves (browse shows clips)');
  assert.ok(!ids.includes(bareCleanId), 'a row with ONLY r2_object_key is skipped, never served raw');
  assert.ok(!ids.includes(unscreenedId), 'unscreened fails CLOSED under the allowlist');
  assert.ok(!ids.includes(hiddenId), 'couple-hidden rows are out (retroactive)');
  for (const r of rows) {
    const served = [r.display_r2_key, r.thumb_r2_key, r.clip_web_r2_key].filter(Boolean);
    assert.ok(
      served.every((k) => !String(k).includes('original-geo')),
      'no served key is the geo-bearing original',
    );
  }
});

test('photo_consent veto: a tagged non-consenting guest pulls the capture', async () => {
  await db.query(
    `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
     VALUES ($1, 'papic_photos', $2, $3, 'individual_qr')`,
    [eventId, cleanPhotoId, otherId],
  );
  await db.query(`UPDATE public.guests SET photo_consent = FALSE WHERE guest_id = $1`, [otherId]);
  const ids = (await poolRows(viewerId)).map((r) => r.source_id);
  assert.ok(!ids.includes(cleanPhotoId), 'the veto removes the capture from the pool');
  // ...and out of reach of self-link (a manual_pick would resurface the vetoed
  // capture in the linker's own gallery/ZIP, which don't re-apply the veto).
  const vetoedLink = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(vetoedLink.ok, false, 'a vetoed capture cannot be self-linked');
  assert.equal(vetoedLink.error, 'not_in_pool');
  // restore for the rest of the suite
  await db.query(`UPDATE public.guests SET photo_consent = TRUE WHERE guest_id = $1`, [otherId]);
  await db.query(
    `DELETE FROM public.photo_tags WHERE source_table='papic_photos' AND source_id=$1 AND guest_id=$2`,
    [cleanPhotoId, otherId],
  );
});

test('FaceBlock event: only baked photos serve, ONLY the wall_safe key; clips excluded', async () => {
  const bakedId = await addPhoto({ baked: true });
  await db.query(`UPDATE public.guests SET faceblock_enabled = TRUE WHERE guest_id = $1`, [
    otherId,
  ]);
  const rows = await poolRows(viewerId);
  const ids = rows.map((r) => r.source_id);
  assert.deepEqual(ids, [bakedId], 'only the baked photo serves on an FB event');
  const baked = rows[0]!;
  assert.equal(baked.display_r2_key, 'papic/test/baked-blur.jpg', 'display IS the baked blur');
  assert.equal(baked.thumb_r2_key, null, 'the un-blurred thumb never escapes');
  assert.equal(baked.clip_web_r2_key, null, 'no clip playback under FaceBlock');
  await db.query(`UPDATE public.guests SET faceblock_enabled = FALSE WHERE guest_id = $1`, [
    otherId,
  ]);
  await db.query(`DELETE FROM public.papic_photos WHERE photo_id = $1`, [bakedId]);
});

test('self-link lands as manual_pick and the reader marks it linked', async () => {
  const res = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(res.ok, true);
  const tag = await db.query<{ source: string; removed_at: string | null }>(
    `SELECT source, removed_at FROM public.photo_tags
     WHERE source_table='papic_photos' AND source_id=$1 AND guest_id=$2`,
    [cleanPhotoId, viewerId],
  );
  assert.equal(tag.rows.length, 1);
  assert.equal(tag.rows[0]!.source, 'manual_pick');
  assert.equal(tag.rows[0]!.removed_at, null);

  const row = (await poolRows(viewerId)).find((r) => r.source_id === cleanPhotoId);
  assert.equal(row?.linked, true, 'the reader reflects the live link');

  const again = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(again.ok, true);
  assert.equal(again.already, true, 'idempotent re-link is a no-op success');
});

test('clips are browsable but NOT linkable (photos-only V1)', async () => {
  const res = await link(viewerId, 'papic_photos', clipId);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'not_in_pool', 'a clip is rejected by the photos-only gate');
});

test('unlink tombstones own manual_pick; unlink again stays ok; relink revives', async () => {
  const res = await unlink(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(res.ok, true);
  assert.equal(res.removed, true);
  const tag = await db.query<{ removed_at: string | null; removed_by: string | null }>(
    `SELECT removed_at, removed_by FROM public.photo_tags
     WHERE source_table='papic_photos' AND source_id=$1 AND guest_id=$2`,
    [cleanPhotoId, viewerId],
  );
  assert.ok(tag.rows[0]!.removed_at !== null, 'soft tombstone, row kept');
  assert.equal(tag.rows[0]!.removed_by, 'guest');

  const idem = await unlink(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(idem.ok, true);
  assert.equal(idem.removed, false, '0-row unlink is still ok (idempotent)');

  const relink = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(relink.ok, true);
  assert.equal(relink.revived, true, 'own guest tombstone revives as manual_pick');
});

test('host removal is FINAL: the guest cannot re-assert', async () => {
  await db.query(
    `UPDATE public.photo_tags SET removed_at = now(), removed_by = 'couple'
     WHERE source_table='papic_photos' AND source_id=$1 AND guest_id=$2`,
    [cleanPhotoId, viewerId],
  );
  const res = await link(viewerId, 'papic_photos', cleanPhotoId);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'removed_by_host');
});

test('cap pre-check matches the merged live-only 20-cap trigger', async () => {
  const capPhotoId = await addPhoto({});
  // Fill 20 live tags (guests 2..21).
  for (let i = 2; i < 22; i++) {
    await db.query(
      `INSERT INTO public.photo_tags (event_id, source_table, source_id, guest_id, source)
       VALUES ($1, 'papic_photos', $2, $3, 'individual_qr')
       ON CONFLICT (source_table, source_id, guest_id) DO NOTHING`,
      [eventId, capPhotoId, guestIds[i]!],
    );
  }
  const res = await link(viewerId, 'papic_photos', capPhotoId);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'cap_reached', 'at 20 live tags the link denies (no silent skip)');

  // Tombstone one → a slot frees (live-only count, matching 20270916200000).
  await db.query(
    `UPDATE public.photo_tags SET removed_at = now(), removed_by = 'guest'
     WHERE source_table='papic_photos' AND source_id=$1 AND guest_id=$2`,
    [capPhotoId, guestIds[2]!],
  );
  const after20 = await link(viewerId, 'papic_photos', capPhotoId);
  assert.equal(after20.ok, true, 'a freed live slot admits the self-link');
});

test('deleted or foreign guest gets nothing', async () => {
  const foreign = await db.query<{ guest_id: string }>(
    `WITH ev AS (
       INSERT INTO public.events (display_name, event_type)
       VALUES ('Other Event', 'birthday') RETURNING event_id
     )
     INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     SELECT event_id, 'Outsider', 'Guest', 'both', 'friends' FROM ev
     RETURNING guest_id`,
  );
  const rows = await poolRows(foreign.rows[0]!.guest_id);
  assert.equal(rows.length, 0, 'a guest of another event sees an empty pool');
  const res = await link(foreign.rows[0]!.guest_id, 'papic_photos', cleanPhotoId);
  assert.equal(res.ok, false, 'and cannot link across events');
});
