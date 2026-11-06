/**
 * 📷 PAPIC CAPTURES KNOW THEIR MOMENT — and deleting a moment removes ITS Papic items, against real SQL (migration
 * 20271302139013; owner 2026-11-01, plan §3: *"deleting this moment will also delete the papic photos and videos"*).
 *
 * Each test is one way it could be quietly wrong:
 *   · a capture tagged with the wrong moment (or with one when none was on, or a later-added link tagged at all);
 *   · a moment delete removing ANOTHER moment's Papic items;
 *   · a photo also in another chapter removed with the moment (it must stay there);
 *   · a CHAPTER delete removing photos (ruled 1 Nov: they fall back to Unsorted);
 *   · a spent credit handed back — the spend is SUM(points_cost) over the capture rows, so a removed row would return it;
 *   · a coordinator with Edit on the Schedule unable to delete a moment that has Papic items.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let db: ReplayResult['db'];

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}
async function asUser(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await db.exec('SET ROLE authenticated');
}

const F = { eventId: '', guest: '', seat: '', coord: '' };

// Wall clocks (Manila, +08:00, in a UTC column) and the matching real instants.
const wall = (hhmm: string) => `2099-06-10T${hhmm}:00Z`;
const real = (hhmmManila: string) => {
  const [h, m] = hhmmManila.split(':').map(Number);
  return new Date(Date.UTC(2099, 5, 10, h! - 8, m!)).toISOString();
};

async function block(label: string, start: string, end: string, parent: string | null): Promise<string> {
  await asOwner();
  return (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, parent_block_id, photo_who)
       VALUES ($1,$2,$3,$4,$5,'everybody') RETURNING block_id`,
      [F.eventId, label, start, end, parent],
    )
  ).rows[0]!.block_id;
}
async function guestShot(at: string, points = 1): Promise<string> {
  await asOwner();
  return (
    await db.query<{ capture_id: string }>(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, captured_at, points_cost) VALUES ($1,$2,'r2://g',$3,$4) RETURNING capture_id`,
      [F.eventId, F.guest, at, points],
    )
  ).rows[0]!.capture_id;
}
async function seatShot(at: string): Promise<string> {
  await asOwner();
  return (
    await db.query<{ photo_id: string }>(
      `INSERT INTO public.papic_photos (event_id, paparazzi_seat_id, r2_object_key, captured_at) VALUES ($1,$2,'r2://s',$3) RETURNING photo_id`,
      [F.eventId, F.seat, at],
    )
  ).rows[0]!.photo_id;
}
async function link(chapter: string, c: { guest?: string; seat?: string }, how: 'captured' | 'added' = 'captured'): Promise<void> {
  await asOwner();
  await db.query(`INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id, seat_photo_id, how) VALUES ($1,$2,$3,$4)`, [
    chapter,
    c.guest ?? null,
    c.seat ?? null,
    how,
  ]);
}
async function momentOf(chapter: string, c: { guest?: string; seat?: string }): Promise<string | null> {
  await asOwner();
  const r = await db.query<{ m: string | null }>(
    `SELECT moment_block_id AS m FROM public.papic_chapter_captures WHERE block_id = $1 AND (guest_capture_id = $2 OR seat_photo_id = $3)`,
    [chapter, c.guest ?? null, c.seat ?? null],
  );
  return r.rows[0]?.m ?? null;
}
async function hidden(c: { guest?: string; seat?: string }): Promise<boolean> {
  await asOwner();
  const r = c.guest
    ? await db.query<{ h: boolean }>(`SELECT hidden_at IS NOT NULL AS h FROM public.papic_guest_captures WHERE capture_id = $1`, [c.guest])
    : await db.query<{ h: boolean }>(`SELECT hidden_at IS NOT NULL AS h FROM public.papic_photos WHERE photo_id = $1`, [c.seat]);
  assert.equal(r.rows.length, 1, 'the capture ROW is gone — its spent credits would come back');
  return r.rows[0]!.h;
}
async function chapterLinks(chapter: string): Promise<number> {
  await asOwner();
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.papic_chapter_captures WHERE block_id = $1`, [chapter])).rows[0]!.n;
}
async function spent(): Promise<number> {
  await asOwner();
  return (await db.query<{ n: number }>(`SELECT COALESCE(SUM(points_cost),0)::int AS n FROM public.papic_guest_captures WHERE guest_id = $1`, [F.guest]))
    .rows[0]!.n;
}
async function deleteBlock(id: string): Promise<void> {
  await asOwner();
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1`, [id]);
}

before(async () => {
  db = (await createReplayedDb()).db;
  await asOwner();
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision) VALUES ('Papic moments','birthday', DATE '2099-06-10','day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  F.guest = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,'Shooter','Sample','both','friends') RETURNING guest_id`,
      [F.eventId],
    )
  ).rows[0]!.guest_id;
  const holder = (
    await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('seat@papic-moment.test','{}'::jsonb) RETURNING id`)
  ).rows[0]!.id;
  F.seat = (
    await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token) VALUES ($1,$2,3,'PAPIC_CAMERA_MINI_DAY','tok-papic-moment') RETURNING seat_id`,
      [F.eventId, holder],
    )
  ).rows[0]!.seat_id;
  F.coord = (
    await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('coord@papic-moment.test','{}'::jsonb) RETURNING id`)
  ).rows[0]!.id;
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1,$2,'wedding_planner_external',
             jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,'remove_hosts',false,
                                'areas', jsonb_build_object('schedule','edit')), NOW())`,
    [F.eventId, F.coord],
  );
});
after(async () => {
  await db?.close();
});

test('a capture is tagged with the moment on at the shutter — none when none was on, never for an added link', async () => {
  const ch = await block('Reception', wall('18:00'), wall('23:00'), null);
  const entrance = await block('Grand entrance', wall('18:00'), wall('18:30'), ch);
  const dinner = await block('Dinner', wall('18:30'), wall('20:00'), ch);
  const toast = await block('Toast', wall('19:00'), wall('19:10'), ch); // overlaps dinner — the later start wins

  const a = await guestShot(real('18:10'));
  const b = await seatShot(real('18:45'));
  const c = await guestShot(real('19:05'));
  const d = await guestShot(real('21:00')); // no moment on
  for (const [x, cap] of [[a, { guest: a }], [b, { seat: b }], [c, { guest: c }], [d, { guest: d }]] as const) {
    void x;
    await link(ch, cap);
  }
  assert.equal(await momentOf(ch, { guest: a }), entrance);
  assert.equal(await momentOf(ch, { seat: b }), dinner, 'a seat camera’s shot was not tagged');
  assert.equal(await momentOf(ch, { guest: c }), toast, 'two moments on at once: the later-starting one is the moment');
  assert.equal(await momentOf(ch, { guest: d }), null, 'a shot with no moment on was tagged with one');

  // A link added later (Memories) was not shot during one of this chapter's moments.
  const other = await block('After party', wall('23:00'), wall('23:59'), null);
  await link(other, { guest: a }, 'added');
  assert.equal(await momentOf(other, { guest: a }), null, 'an added link was tagged with a moment');
});

test('deleting a moment removes ONLY its own Papic items; one also in another chapter stays there; no credit moves', async () => {
  const ch = await block('Ceremony', wall('14:00'), wall('16:00'), null);
  const vows = await block('Vows', wall('14:30'), wall('14:45'), ch);
  const rings = await block('Rings', wall('14:45'), wall('15:00'), ch);
  const elsewhere = await block('Photo session', wall('16:00'), wall('17:00'), null);

  const v1 = await guestShot(real('14:31'), 2);
  const v2 = await seatShot(real('14:40'));
  const kept = await guestShot(real('14:35'), 3); // also added to another chapter
  const r1 = await guestShot(real('14:50'), 1); // another moment's
  await link(ch, { guest: v1 });
  await link(ch, { seat: v2 });
  await link(ch, { guest: kept });
  await link(ch, { guest: r1 });
  await link(elsewhere, { guest: kept }, 'added');
  assert.equal(await momentOf(ch, { guest: v1 }), vows);
  const spentBefore = await spent();

  await deleteBlock(vows);

  assert.equal(await hidden({ guest: v1 }), true, 'the moment’s guest shot is still in the galleries');
  assert.equal(await hidden({ seat: v2 }), true, 'the moment’s seat shot is still in the galleries');
  assert.equal(await hidden({ guest: kept }), false, 'a photo also in another chapter was removed');
  assert.equal(await hidden({ guest: r1 }), false, 'another moment’s Papic item was removed');
  assert.equal(await momentOf(ch, { guest: r1 }), rings);
  assert.equal(await chapterLinks(ch), 1, 'the deleted moment’s items are still in its chapter (only Rings’ one should be)');
  assert.equal(await chapterLinks(elsewhere), 1, 'the photo left the other chapter it was added to');
  assert.equal(await spent(), spentBefore, 'deleting a moment moved spent credits');
});

test('deleting a CHAPTER removes no photo — they fall back to Unsorted', async () => {
  const ch = await block('Despedida', wall('10:00'), wall('12:00'), null);
  await block('Games', wall('10:00'), wall('11:00'), ch);
  const g = await guestShot(real('10:30'));
  await link(ch, { guest: g });
  await deleteBlock(ch);
  assert.equal(await hidden({ guest: g }), false, 'a chapter delete removed its moment’s photo');
});

test('a coordinator with Edit on the Schedule deletes a moment that has Papic items', async () => {
  const ch = await block('Cocktails', wall('17:00'), wall('18:00'), null);
  const m = await block('Signature drink', wall('17:00'), wall('17:30'), ch);
  const g = await guestShot(real('17:10'));
  await link(ch, { guest: g });
  await asUser(F.coord);
  const r = await db.query<{ block_id: string }>(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [m]);
  assert.equal(r.rows.length, 1, 'the coordinator could not delete the moment');
  assert.equal(await hidden({ guest: g }), true, 'the coordinator’s delete left the moment’s Papic item in the galleries');
});

test('the whole event still deletes', async () => {
  await asOwner();
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [F.eventId]);
  const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.papic_guest_captures WHERE event_id = $1`, [F.eventId])).rows[0]!.n;
  assert.equal(n, 0);
});
