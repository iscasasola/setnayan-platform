/**
 * 📷 PAPIC SHOOTS INTO A CHAPTER — asserted against the DATABASE (migration 20271300249267; owner 2026-11-01,
 * DECISION_LOG "THE PAPIC CARD ON HOME SHOOTS INTO A CHAPTER" · "A CHAPTER'S PHOTOS: WHO + WHEN").
 *
 * The three guards the build was asked for, each at the layer that ENFORCES it (the link's trigger and the one refusal
 * the capture routes ask before a credit moves — never a screen):
 *   1 · a capture outside the chapter's window is refused (before its start, after its end, a Time-TBA chapter nobody
 *       started) — and Start now opens it early;
 *   2 · a person not in the chapter cannot shoot into it, under each photo rule (People in this chapter · Only people
 *       tagged · Everybody), the hosts always may, and a guest of ANOTHER event is nobody here;
 *   3 · the Home card's read names the chapter — `papic_event_chapters` returns its label, window, the host's pick and
 *       "This chapter: N" — and only the couple writes the pick.
 * Every refusal asserts the LINK IS NOT THERE afterwards. Deleting the chapter deletes its links and never a photo.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asAnon(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'anon', false)`);
  await db.exec(`SET ROLE anon`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = {
  eventId: '',
  otherEventId: '',
  couple: '',
  supplier: '',
  stranger: '',
  booking: '',
  inGuest: '',
  groupGuest: '',
  roleGuest: '',
  outGuest: '',
  otherEventGuest: '',
  group: '',
  seat: '',
  seatHolder: '',
};

// Wall clocks (the venue's clock in a UTC column) — Manila, +08:00.
const MEETING_START_WALL = '2099-06-10T14:00:00Z'; // 2 PM Manila
const MEETING_END_WALL = '2099-06-10T16:00:00Z'; // 4 PM Manila
// The same moments as REAL instants.
const BEFORE_REAL = '2099-06-10T05:59:00Z'; // 1:59 PM Manila
const DURING_REAL = '2099-06-10T07:00:00Z'; // 3 PM Manila
const AFTER_REAL = '2099-06-10T08:01:00Z'; // 4:01 PM Manila

async function linkCount(where = 'TRUE'): Promise<number> {
  await asOwner();
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.papic_chapter_captures WHERE ${where}`)).rows[0]!.n;
}

async function chapter(label: string, start: string | null, extra: Record<string, unknown> = {}, eventId = F.eventId): Promise<string> {
  await asOwner();
  const cols = ['event_id', 'label', 'start_at', ...Object.keys(extra)];
  const vals = [eventId, label, start, ...Object.values(extra)];
  return (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING block_id`,
      vals,
    )
  ).rows[0]!.block_id;
}

async function task(row: Record<string, unknown>): Promise<void> {
  await asOwner();
  const cols = Object.keys(row);
  await db.query(
    `INSERT INTO public.event_schedule_tasks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
}

async function guestShot(guestId: string, at: string, eventId = F.eventId): Promise<string> {
  await asOwner();
  return (
    await db.query<{ capture_id: string }>(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, captured_at) VALUES ($1,$2,'r2://g',$3) RETURNING capture_id`,
      [eventId, guestId, at],
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

/** The capture route's write — the service role, the trigger re-checking. */
async function link(blockId: string, capture: { guest?: string; seat?: string }): Promise<void> {
  await asOwner();
  await db.query(`INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id, seat_photo_id) VALUES ($1,$2,$3)`, [
    blockId,
    capture.guest ?? null,
    capture.seat ?? null,
  ]);
}

async function refusedLink(blockId: string, capture: { guest?: string; seat?: string }, code: string, why: string): Promise<void> {
  const before = await linkCount();
  await assert.rejects(() => link(blockId, capture), new RegExp(code), why);
  assert.equal(await linkCount(), before, `${why} — refused, but the link was written anyway`);
}

async function refusal(blockId: string, who: { guest?: string; user?: string }, at: string): Promise<string | null> {
  await asOwner();
  return (
    await db.query<{ r: string | null }>(`SELECT public.papic_chapter_capture_refusal($1,$2,$3,$4,$5) AS r`, [
      blockId,
      F.eventId,
      who.guest ?? null,
      who.user ?? null,
      at,
    ])
  ).rows[0]!.r;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  const mkEvent = async (name: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  const mkGuest = async (eventId: string, first: string, role: string | null = null): Promise<string> =>
    (
      await db.query<{ guest_id: string }>(
        role
          ? `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role) VALUES ($1,$2,'Sample','both','friends',$3) RETURNING guest_id`
          : `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,$2,'Sample','both','friends') RETURNING guest_id`,
        role ? [eventId, first, role] : [eventId, first],
      )
    ).rows[0]!.guest_id;

  F.couple = await mkUser('couple@papic-chapter.test');
  F.supplier = await mkUser('supplier@papic-chapter.test');
  F.stranger = await mkUser('stranger@papic-chapter.test');
  F.seatHolder = await mkUser('seat@papic-chapter.test');
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Someone Else');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);

  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1,'Sample Caterer','Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [F.supplier],
    )
  ).rows[0]!.vendor_profile_id;
  F.booking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'catering','Sample Caterer','contracted',30000,$2) RETURNING vendor_id`,
      [F.eventId, vp],
    )
  ).rows[0]!.vendor_id;

  F.inGuest = await mkGuest(F.eventId, 'Named');
  F.groupGuest = await mkGuest(F.eventId, 'Grouped');
  F.roleGuest = await mkGuest(F.eventId, 'Roled', 'maid_of_honor');
  F.outGuest = await mkGuest(F.eventId, 'Outside');
  F.otherEventGuest = await mkGuest(F.otherEventId, 'Elsewhere');
  F.group = (
    await db.query<{ group_id: string }>(`INSERT INTO public.guest_groups (event_id, label, team_side) VALUES ($1,'Bride''s family','bride') RETURNING group_id`, [
      F.eventId,
    ])
  ).rows[0]!.group_id;
  await db.query(`INSERT INTO public.guest_group_memberships (group_id, guest_id) VALUES ($1,$2)`, [F.group, F.groupGuest]);

  F.seat = (
    await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats (event_id, claimer_user_id, seat_index, sku_code, claim_qr_token) VALUES ($1,$2,7,'PAPIC_CAMERA_MINI_DAY','tok-papic-chapter') RETURNING seat_id`,
      [F.eventId, F.seatHolder],
    )
  ).rows[0]!.seat_id;
});

after(async () => {
  await replay?.db.close();
});

/* ── 1 · the window ─────────────────────────────────────────────────────────────────────────────────────────── */

let meeting = '';

test('a capture OUTSIDE the chapter window is refused — before its start and after its end; inside it lands', async () => {
  meeting = await chapter('Meeting with caterer', MEETING_START_WALL, { end_at: MEETING_END_WALL, photo_who: 'chapter' });
  await task({ block_id: meeting, guest_id: F.inGuest, what: 'Tasting' });

  assert.equal(await refusal(meeting, { guest: F.inGuest }, BEFORE_REAL), 'chapter_not_open', 'one minute before 2 PM Manila');
  assert.equal(await refusal(meeting, { guest: F.inGuest }, AFTER_REAL), 'chapter_closed', 'one minute after 4 PM Manila');
  assert.equal(await refusal(meeting, { guest: F.inGuest }, DURING_REAL), null, '3 PM Manila, a person on the meeting');

  await refusedLink(meeting, { guest: await guestShot(F.inGuest, BEFORE_REAL) }, 'chapter_not_open', 'a shot before the meeting');
  await refusedLink(meeting, { guest: await guestShot(F.inGuest, AFTER_REAL) }, 'chapter_closed', 'a shot after the meeting');
  await link(meeting, { guest: await guestShot(F.inGuest, DURING_REAL) });
  assert.equal(await linkCount(`block_id = '${meeting}'`), 1, 'the shot inside the window is in the chapter');
});

test('a chapter with no end closes at the end of its own day (the venue’s clock)', async () => {
  const noEnd = await chapter('Fitting', MEETING_START_WALL, { photo_who: 'everybody' });
  assert.equal(await refusal(noEnd, { guest: F.outGuest }, '2099-06-10T15:59:00Z'), null, '11:59 PM Manila, the same day');
  assert.equal(await refusal(noEnd, { guest: F.outGuest }, '2099-06-10T16:01:00Z'), 'chapter_closed', '12:01 AM the next day');
});

test('Start now opens a chapter early — and only the couple may press it', async () => {
  const later = await chapter('Site visit', MEETING_END_WALL, { photo_who: 'everybody' }); // 4 PM Manila
  assert.equal(await refusal(later, { guest: F.outGuest }, DURING_REAL), 'chapter_not_open', '3 PM, before the 4 PM site visit');

  // A stranger cannot open it.
  await asUser(F.stranger);
  await assert.rejects(
    () => db.query(`INSERT INTO public.papic_chapter_windows (block_id, opened_early_at) VALUES ($1,$2)`, [later, '2099-06-10T06:30:00Z']),
    /row-level security|violates|permission denied/i,
  );
  // The couple presses Start now at 2:30 PM Manila.
  await asUser(F.couple);
  await db.query(`INSERT INTO public.papic_chapter_windows (block_id, opened_early_at) VALUES ($1,$2)`, [later, '2099-06-10T06:30:00Z']);
  assert.equal(await refusal(later, { guest: F.outGuest }, DURING_REAL), null, 'opened early, 3 PM now shoots in');
  assert.equal(await refusal(later, { guest: F.outGuest }, '2099-06-10T06:29:00Z'), 'chapter_not_open', 'still not before it was started');
});

/* ── 2 · who may shoot ──────────────────────────────────────────────────────────────────────────────────────── */

test('People in this chapter: named, by group, by role, the booked supplier and the hosts — never anyone else', async () => {
  const c = await chapter('Preparation · Bride', MEETING_START_WALL, { end_at: MEETING_END_WALL, photo_who: 'chapter' });
  const m = await chapter('Hair and make-up', MEETING_START_WALL, { parent_block_id: c, end_at: MEETING_END_WALL });
  await task({ block_id: m, guest_id: F.inGuest, what: 'In the chair' });
  await task({ block_id: m, group_id: F.group, what: 'Watching' });
  await task({ block_id: m, role: 'Maid_of_honor ', what: 'Holding the veil' });
  await task({ block_id: m, vendor_id: F.booking, what: 'Serving coffee' });

  for (const [name, who] of [
    ['named on a moment', { guest: F.inGuest }],
    ['in a named group', { guest: F.groupGuest }],
    ['holding the named role', { guest: F.roleGuest }],
    ['the booked supplier', { user: F.supplier }],
    ['the couple', { user: F.couple }],
  ] as const) {
    assert.equal(await refusal(c, who, DURING_REAL), null, `${name} may shoot`);
  }
  for (const [name, who] of [
    ['a guest on no task', { guest: F.outGuest }],
    ['a guest of another event', { guest: F.otherEventGuest }],
    ['a stranger', { user: F.stranger }],
    ['a seat holder on no task', { user: F.seatHolder }],
  ] as const) {
    assert.equal(await refusal(c, who, DURING_REAL), 'not_in_chapter', `${name} may not shoot`);
  }
  await refusedLink(c, { guest: await guestShot(F.outGuest, DURING_REAL) }, 'not_in_chapter', 'a guest outside the chapter');
  await refusedLink(c, { seat: await seatShot(DURING_REAL) }, 'not_in_chapter', 'a seat camera outside the chapter');
  await link(c, { guest: await guestShot(F.groupGuest, DURING_REAL) });
});

test('Only people tagged: named one by one — a group or a role is not enough', async () => {
  const c = await chapter('Bride and parents', MEETING_START_WALL, { end_at: MEETING_END_WALL, photo_who: 'tagged' });
  await task({ block_id: c, guest_id: F.inGuest, what: 'Letter reading' });
  await task({ block_id: c, group_id: F.group, what: 'Watching' });
  await task({ block_id: c, role: 'maid_of_honor', what: 'Holding tissues' });
  assert.equal(await refusal(c, { guest: F.inGuest }, DURING_REAL), null, 'named one by one');
  assert.equal(await refusal(c, { guest: F.groupGuest }, DURING_REAL), 'not_in_chapter', 'only through a group');
  assert.equal(await refusal(c, { guest: F.roleGuest }, DURING_REAL), 'not_in_chapter', 'only through a role');
  assert.equal(await refusal(c, { user: F.couple }, DURING_REAL), null, 'the hosts always may');
});

test('Everybody: anyone the camera let in — and a seat camera shoots in', async () => {
  const c = await chapter('Despedida', MEETING_START_WALL, { end_at: MEETING_END_WALL, photo_who: 'everybody' });
  assert.equal(await refusal(c, { guest: F.outGuest }, DURING_REAL), null);
  await link(c, { seat: await seatShot(DURING_REAL) });
  assert.equal(await linkCount(`block_id = '${c}'`), 1);
});

test('a moment is not a chapter, and a capture from another event is refused', async () => {
  const c = await chapter('Reception', MEETING_START_WALL, { end_at: MEETING_END_WALL, photo_who: 'everybody' });
  const m = await chapter('First dance', MEETING_START_WALL, { parent_block_id: c, end_at: MEETING_END_WALL });
  await refusedLink(m, { guest: await guestShot(F.inGuest, DURING_REAL) }, 'not_a_chapter', 'a capture linked to a moment');
  await refusedLink(c, { guest: await guestShot(F.otherEventGuest, DURING_REAL, F.otherEventId) }, 'not_a_chapter', 'another event’s capture');
  assert.equal(await refusal(m, { guest: F.inGuest }, DURING_REAL), 'not_a_chapter');
});

/* ── 3 · the card's read ────────────────────────────────────────────────────────────────────────────────────── */

test('the card reads the chapter it names — label, window, the pick and "This chapter: N" — and only the couple picks', async () => {
  await asUser(F.couple);
  await db.query(`INSERT INTO public.papic_chapter_windows (block_id, picked) VALUES ($1, TRUE)`, [meeting]);
  const rows = (
    await db.query<{ block_id: string; label: string; opens_at: Date; closes_at: Date; picked: boolean; captures: number }>(
      `SELECT * FROM public.papic_event_chapters($1)`,
      [F.eventId],
    )
  ).rows;
  const named = rows.find((r) => r.block_id === meeting);
  assert.ok(named, 'the couple reads the meeting');
  assert.equal(named!.label, 'Meeting with caterer');
  assert.equal(named!.picked, true);
  assert.equal(new Date(named!.opens_at).toISOString(), '2099-06-10T06:00:00.000Z', 'opens 2 PM Manila');
  assert.equal(new Date(named!.closes_at).toISOString(), '2099-06-10T08:00:00.000Z', 'closes 4 PM Manila');
  assert.equal(named!.captures, 1, 'This chapter: 1');
  assert.equal(rows.filter((r) => r.picked).length, 1);

  // One pick per event.
  const other = rows.find((r) => r.block_id !== meeting)!;
  await assert.rejects(() => db.query(`INSERT INTO public.papic_chapter_windows (block_id, picked) VALUES ($1, TRUE)`, [other.block_id]), /unique|duplicate/i);

  // The links are the couple's to read, never anon's or a stranger's, and nobody writes one through the API.
  assert.ok((await db.query(`SELECT 1 FROM public.papic_chapter_captures`)).rows.length > 0, 'the couple reads the links');
  await asUser(F.stranger);
  assert.equal((await db.query(`SELECT 1 FROM public.papic_chapter_captures`)).rows.length, 0, 'a stranger reads none');
  assert.equal((await db.query(`SELECT 1 FROM public.papic_chapter_windows`)).rows.length, 0);
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`INSERT INTO public.papic_chapter_captures (block_id, guest_capture_id) VALUES ($1,$2)`, [meeting, F.inGuest]),
    /permission denied/i,
    'the couple cannot write a link — only the capture routes do',
  );
  await asAnon();
  await assert.rejects(() => db.query(`SELECT 1 FROM public.papic_chapter_captures`), /permission denied/i);
});

test('deleting the chapter deletes its links, never a photo (they fall back under Unsorted)', async () => {
  const shots = (await linkCount(`block_id = '${meeting}'`));
  assert.ok(shots > 0);
  await asOwner();
  const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.papic_guest_captures WHERE event_id = $1`, [F.eventId])).rows[0]!.n;
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1`, [meeting]);
  assert.equal(await linkCount(`block_id = '${meeting}'`), 0, 'the links went with the chapter');
  const after = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.papic_guest_captures WHERE event_id = $1`, [F.eventId])).rows[0]!.n;
  assert.equal(after, before, 'no photo was deleted');
});
