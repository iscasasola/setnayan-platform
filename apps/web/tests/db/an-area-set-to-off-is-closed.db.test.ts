/**
 * PEOPLE WITH ACCESS IS ENFORCED — a View holder cannot write, an Off holder
 * cannot read (owner 2026-10-03: access is set per person, per area, as Edit ·
 * View · Off, in Event Details › People with access).
 *
 * The section's dropdowns write one thing — `event_moderators.permissions_json`
 * through `withArea` (`setDelegateArea`). This file proves, through a REAL
 * `authenticated` session on the replayed schema, that every area the section
 * lets a host set is honoured by the database readers that already existed:
 *
 *   Guest list        guests                       read IS NOT NULL · write = 'edit'
 *   Seat plan         event_tables · seat assignments  (reads closed by 20271262573732)
 *   The Day           event_schedule_blocks · event_song_picks  (reads closed by it too)
 *   Suppliers         event_vendors                (read closed by it too)
 *   Budget & payments event_vendor_payments        read only, never a write
 *   Photos            papic_guest_captures         read only
 *
 * ⚠ THE BEFORE STATE IS THE REASON THIS FILE EXISTS. Before 20271262573732 an
 * accepted delegate set to Off on the seat plan, the day or the suppliers still
 * read all three over PostgREST — the screen said "Off" and the door was open.
 * Sabotage: drop that migration's statements and the "Off cannot read" tests
 * for those three areas go red.
 *
 * Event Hub and Mood Board are NOT here on purpose: nothing asks the database
 * for those two areas, so the section does not offer them as dropdowns
 * (`areaChoices` → null) — there is no door to prove.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { withArea, type ModeratorPermissions } from '../../lib/delegate-areas';

let replay: ReplayResult;
let db: ReplayResult['db'];

let eventId: string;
let coupleUid: string;
let editUid: string;
let viewUid: string;
let offUid: string;
let tableId: string;
let blockId: string;
let vendorId: string;
let guestId: string;

const BASE = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false };
const ALL = ['guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations', 'mood_board', 'budget', 'photos'] as const;
const levels = (l: 'edit' | 'view' | null) => Object.fromEntries(ALL.map((a) => [a, l]));

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asUser(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec('SET ROLE authenticated');
}

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
  return u.rows[0]!.id;
}

async function count(sql: string): Promise<number> {
  const r = await db.query(sql, [eventId]);
  return r.rows.length;
}

/** Run a write; the number of rows it really changed (0 when RLS refused it). */
async function wrote(sql: string, params: unknown[]): Promise<number> {
  await db.exec('SAVEPOINT w');
  try {
    const r = await db.query(sql, params);
    await db.exec('RELEASE SAVEPOINT w');
    return r.rows.length;
  } catch {
    await db.exec('ROLLBACK TO SAVEPOINT w');
    return 0;
  }
}

const READS: Record<string, string> = {
  guest_list: `SELECT guest_id FROM public.guests WHERE event_id = $1`,
  seat_plan: `SELECT table_id FROM public.event_tables WHERE event_id = $1`,
  seat_plan_assignments: `SELECT guest_id FROM public.event_seat_assignments WHERE event_id = $1`,
  schedule: `SELECT block_id FROM public.event_schedule_blocks WHERE event_id = $1`,
  schedule_songs: `SELECT song_id FROM public.event_song_picks WHERE event_id = $1`,
  vendors: `SELECT vendor_id FROM public.event_vendors WHERE event_id = $1`,
  budget: `SELECT vendor_id FROM public.event_vendor_payments WHERE event_id = $1`,
  photos: `SELECT capture_id FROM public.papic_guest_captures WHERE event_id = $1`,
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.exec('BEGIN');
  await asOwner();

  coupleUid = await newUser('couple@access.test');
  editUid = await newUser('edit@access.test');
  viewUid = await newUser('view@access.test');
  offUid = await newUser('off@access.test');

  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
       VALUES ('People with access', 'birthday', '2027-03-03'::date, 'day', 'NCR') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, coupleUid]);

  guestId = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category)
       VALUES ($1, 'Ana', 'Reyes', 'Ana Reyes', 'bride', 'family') RETURNING guest_id`,
      [eventId],
    )
  ).rows[0]!.guest_id;
  tableId = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity) VALUES ($1, 'Table 1', 'round_8', 8) RETURNING table_id`,
      [eventId],
    )
  ).rows[0]!.table_id;
  await db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1, $2, $3)`, [eventId, tableId, guestId]);
  blockId = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, end_at, sort_order, is_public)
       VALUES ($1, 'Ceremony', 'ceremony', '2027-03-03T08:00:00Z', '2027-03-03T09:00:00Z', 1, true) RETURNING block_id`,
      [eventId],
    )
  ).rows[0]!.block_id;
  const song = await db.query<{ song_id: string }>(
    `INSERT INTO public.songs (title, artist, source) VALUES ('First Dance', 'The Test Band', 'seed') RETURNING song_id`,
  );
  await db.query(`INSERT INTO public.event_song_picks (event_id, song_id, source) VALUES ($1, $2, 'editor')`, [eventId, song.rows[0]!.song_id]);
  vendorId = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name) VALUES ($1, 'photographer', 'Lights Co') RETURNING vendor_id`,
      [eventId],
    )
  ).rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 15000, 'cash')`,
    [eventId, vendorId],
  );
  await db.query(`INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key) VALUES ($1, $2, 'k/1.jpg')`, [eventId, guestId]);

  const seat = async (uid: string, perms: object) =>
    db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, now())`,
      [eventId, uid, JSON.stringify(perms)],
    );
  // Edit on the four Edit areas, View on budget and photos — the most a host can give.
  await seat(editUid, { ...BASE, areas: { ...levels('edit'), budget: 'view', photos: 'view', invitations: 'view', mood_board: 'view' } });
  // A limited helper's shape: View on every area.
  await seat(viewUid, { ...BASE, areas: levels('view') });
  // Every area Off — an explicit null each, the shape `setDelegateArea` writes.
  await seat(offUid, { ...BASE, areas: levels(null) });
});

after(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await db.exec('ROLLBACK').catch(() => {});
  await setAuthUid(db, null);
  await db?.close();
});

test('META: the session is really `authenticated`, and every seeded row is there', async () => {
  await asOwner();
  for (const [k, sql] of Object.entries(READS)) assert.equal(await count(sql), 1, `${k}: without a row, zero proves nothing`);
  await asUser(viewUid);
  const r = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(r.rows[0]!.cu, 'authenticated', 'SET ROLE did not take — every refusal below would be vacuous');
  // The trigger mints the coordinator MEMBER row too — the second door must be closed as well.
  await asOwner();
  const m = await db.query(`SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2 AND member_type = 'coordinator'`, [eventId, offUid]);
  assert.equal(m.rows.length, 1, 'the Off holder is not a coordinator member — the member-door tests prove less than they look');
});

test('Off cannot read — every area the section can set', async () => {
  await asUser(offUid);
  for (const [k, sql] of Object.entries(READS)) {
    assert.equal(await count(sql), 0, `${k}: a delegate set to Off still reads it`);
  }
});

test('View reads every area', async () => {
  await asUser(viewUid);
  for (const [k, sql] of Object.entries(READS)) assert.equal(await count(sql), 1, `${k}: View cannot read it`);
});

test('View cannot write — not one row, in any area', async () => {
  await asUser(viewUid);
  assert.equal(
    await wrote(`UPDATE public.guests SET first_name = 'Changed' WHERE guest_id = $1 RETURNING guest_id`, [guestId]),
    0,
    'guest list: View changed a guest',
  );
  assert.equal(
    await wrote(
      `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category)
       VALUES ($1, 'New', 'Guest', 'New Guest', 'bride', 'family') RETURNING guest_id`,
      [eventId],
    ),
    0,
    'guest list: View added a guest',
  );
  assert.equal(
    await wrote(`UPDATE public.event_tables SET capacity = 10 WHERE table_id = $1 RETURNING table_id`, [tableId]),
    0,
    'seat plan: View changed a table',
  );
  assert.equal(
    await wrote(`UPDATE public.event_schedule_blocks SET label = 'Changed' WHERE block_id = $1 RETURNING block_id`, [blockId]),
    0,
    'The Day: View changed a moment',
  );
  assert.equal(
    await wrote(`DELETE FROM public.event_song_picks WHERE event_id = $1 RETURNING song_id`, [eventId]),
    0,
    'The Day: View removed a song',
  );
  assert.equal(
    await wrote(`UPDATE public.event_vendors SET vendor_name = 'Changed' WHERE vendor_id = $1 RETURNING vendor_id`, [vendorId]),
    0,
    'Suppliers: View changed a booking',
  );
  assert.equal(
    await wrote(`UPDATE public.event_vendor_payments SET amount_php = 1 WHERE event_id = $1 RETURNING vendor_id`, [eventId]),
    0,
    'Budget & payments: View changed a payment',
  );
});

test('Edit writes the four Edit areas — the narrowing is not a blanket no', async () => {
  await asUser(editUid);
  assert.equal(await wrote(`UPDATE public.guests SET last_name = 'Cruz' WHERE guest_id = $1 RETURNING guest_id`, [guestId]), 1, 'guest list');
  assert.equal(await wrote(`UPDATE public.event_tables SET capacity = 9 WHERE table_id = $1 RETURNING table_id`, [tableId]), 1, 'seat plan');
  assert.equal(
    await wrote(`UPDATE public.event_schedule_blocks SET label = 'Vows' WHERE block_id = $1 RETURNING block_id`, [blockId]),
    1,
    'The Day',
  );
  assert.equal(
    await wrote(`UPDATE public.event_vendors SET vendor_name = 'Lights & Co' WHERE vendor_id = $1 RETURNING vendor_id`, [vendorId]),
    1,
    'Suppliers',
  );
  // …and Budget & payments stays read-only even at the most a host can give (locked D1).
  assert.equal(
    await wrote(`UPDATE public.event_vendor_payments SET amount_php = 1 WHERE event_id = $1 RETURNING vendor_id`, [eventId]),
    0,
    'Budget & payments was written by a delegate',
  );
});

test('the couple are untouched — they read every area without a grant', async () => {
  await asUser(coupleUid);
  for (const [k, sql] of Object.entries(READS)) assert.equal(await count(sql), 1, `${k}: the host lost their own event`);
});

test('a change made the way the section makes it reaches the reader at once', async () => {
  // `setDelegateArea` = read the seat, `withArea(perms, area, level)`, write it.
  const flip = async (uid: string, area: (typeof ALL)[number], level: 'edit' | 'view' | null) => {
    await asOwner();
    const r = await db.query<{ permissions_json: ModeratorPermissions }>(
      `SELECT permissions_json FROM public.event_moderators WHERE event_id = $1 AND user_id = $2`,
      [eventId, uid],
    );
    const next = withArea(r.rows[0]!.permissions_json, area, level);
    await db.query(`UPDATE public.event_moderators SET permissions_json = $3::jsonb WHERE event_id = $1 AND user_id = $2`, [
      eventId,
      uid,
      JSON.stringify(next),
    ]);
  };
  await flip(viewUid, 'seat_plan', null);
  await asUser(viewUid);
  assert.equal(await count(READS.seat_plan!), 0, 'View → Off on the seat plan did not close it');
  assert.equal(await count(READS.guest_list!), 1, 'turning one area Off took another with it');
  await flip(viewUid, 'seat_plan', 'edit');
  await asUser(viewUid);
  assert.equal(await wrote(`UPDATE public.event_tables SET capacity = 7 WHERE table_id = $1 RETURNING table_id`, [tableId]), 1, 'Off → Edit did not open the write');
});
