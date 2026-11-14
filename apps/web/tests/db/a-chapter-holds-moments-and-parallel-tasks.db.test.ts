/**
 * 📖 A CHAPTER HOLDS MOMENTS, AND A MOMENT HOLDS PARALLEL TASKS — asserted against the DATABASE, through real sessions
 * (migration 20271300072429; owner 2026-11-01, DECISION_LOG "SCHEDULE AND CHAPTERS — THE PLAN" · "THE BLOW BY BLOW
 * FROM THE REAL RUN OF SHOW").
 *
 * The rows are written the way PostgREST would write them — the table is served to the browser, so the boundary is
 * the POLICY, never the screen:
 *   · the HOST (the couple) and the COORDINATOR (a helper with Edit on the Schedule) make a chapter, a moment and its
 *     tasks, and read them back;
 *   · a helper with VIEW reads, and cannot write;
 *   · a BOOKED SUPPLIER reads the tasks (not on a block the coordinator staged), and cannot write one;
 *   · a GUEST — signed in, on the guest list — and ANON read NOTHING and write nothing.
 * Every refusal asserts the ROW IS NOT THERE afterwards — a refusal that still wrote is not a refusal.
 *
 * And the SHAPE of a real run of show: a chapter whose ingress and egress cross midnight; one moment holding THREE
 * parallel tasks in TWO places (a task with no place follows the moment's room); the same crew in a second place at
 * once is found as a clash by the real `findTaskClashes` and is NOT refused by the database.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { chaptersFromBlocks, egressAt, findTaskClashes, ingressAt, taskPlace, type TaskRow } from '../../lib/schedule-chapters';

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
  coord: '',
  viewer: '',
  supplier: '',
  stranger: '',
  guestUser: '',
  booking: '',
  otherBooking: '',
  guestRow: '',
  group: '',
};

const TASK_COLS = 'task_id, block_id, vendor_id, crew, guest_id, group_id, role, who_label, what, call_at, place, sort_order';

async function count(table: string, where = 'TRUE'): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${table} WHERE ${where}`);
  return r.rows[0]!.n;
}

/** Refused BY THE DATABASE, and nothing written. */
async function assertRefused(run: () => Promise<unknown>, table: string, why: string): Promise<void> {
  const before = await count(table);
  await assert.rejects(run, /row-level security|violates|permission denied|not on/i, why);
  assert.equal(await count(table), before, `${why} — refused, but a row was written anyway`);
}

async function chapterAs(uid: string, label: string, start: string, extra: Record<string, unknown> = {}): Promise<string> {
  await asUser(uid);
  const cols = ['event_id', 'label', 'start_at', ...Object.keys(extra)];
  const vals = [F.eventId, label, start, ...Object.values(extra)];
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING block_id`,
    vals,
  );
  return r.rows[0]!.block_id;
}

async function momentAs(uid: string, chapter: string, label: string, start: string, end: string, extra: Record<string, unknown> = {}): Promise<string> {
  return chapterAs(uid, label, start, { parent_block_id: chapter, end_at: end, ...extra });
}

async function taskAs(uid: string, row: Record<string, unknown>): Promise<string> {
  await asUser(uid);
  const cols = Object.keys(row);
  const r = await db.query<{ task_id: string }>(
    `INSERT INTO public.event_schedule_tasks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING task_id`,
    Object.values(row),
  );
  return r.rows[0]!.task_id;
}

/** A moment as `taskPlace` / `findTaskClashes` read it — its times as stored wall clocks. */
async function momentRow(uid: string, blockId: string) {
  await asUser(uid);
  const m = (
    await db.query<{ block_id: string; start_at: Date | string; end_at: Date | string | null; location: string | null; spot: string | null }>(
      `SELECT block_id, start_at, end_at, location, spot FROM public.event_schedule_blocks WHERE block_id = $1`,
      [blockId],
    )
  ).rows[0]!;
  const iso = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());
  return { block_id: m.block_id, start_at: iso(m.start_at)!, end_at: iso(m.end_at), location: m.location, spot: m.spot };
}

async function tasksAs(uid: string | 'anon'): Promise<TaskRow[]> {
  if (uid === 'anon') await asAnon();
  else await asUser(uid);
  const r = await db.query<TaskRow>(`SELECT ${TASK_COLS} FROM public.event_schedule_tasks ORDER BY sort_order`);
  return r.rows;
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

  F.couple = await mkUser('couple@chapters.test');
  F.coord = await mkUser('coord@chapters.test');
  F.viewer = await mkUser('viewer@chapters.test');
  F.supplier = await mkUser('supplier@chapters.test');
  F.stranger = await mkUser('stranger@chapters.test');
  F.guestUser = await mkUser('guest@chapters.test');
  F.eventId = await mkEvent('Sample Wedding');
  F.otherEventId = await mkEvent('Someone Else');

  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  // A signed-in guest — on the event as a guest, and on its guest list.
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [F.eventId, F.guestUser]);

  for (const [uid, level, role] of [
    [F.coord, 'edit', 'wedding_planner_external'],
    [F.viewer, 'view', 'viewer'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,$3, jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,'remove_hosts',false,
                                            'areas', jsonb_build_object('schedule',$4::text)), NOW())
       ON CONFLICT (event_id,user_id) DO UPDATE SET permissions_json = EXCLUDED.permissions_json, role_subtype = EXCLUDED.role_subtype, removed_at = NULL`,
      [F.eventId, uid, role, level],
    );
  }

  const vp = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1,'Sample HMUA','Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [F.supplier],
    )
  ).rows[0]!.vendor_profile_id;
  F.booking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'catering','Sample HMUA','contracted',30000,$2) RETURNING vendor_id`,
      [F.eventId, vp],
    )
  ).rows[0]!.vendor_id;
  F.otherBooking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php)
       VALUES ($1,'catering','Elsewhere Catering','contracted',10000) RETURNING vendor_id`,
      [F.otherEventId],
    )
  ).rows[0]!.vendor_id;

  F.guestRow = (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1,'Sample','Bridesmaid','both','friends') RETURNING guest_id`,
      [F.eventId],
    )
  ).rows[0]!.guest_id;
  F.group = (
    await db.query<{ group_id: string }>(`INSERT INTO public.guest_groups (event_id, label, team_side) VALUES ($1,'Bridesmaids','bride') RETURNING group_id`, [
      F.eventId,
    ])
  ).rows[0]!.group_id;
});

after(async () => {
  await replay?.db.close();
});

/* ── the host and the coordinator make chapters ─────────────────────────────────────────────────────────────── */

let prep = '';
let reception = '';
let hmua = '';

test('the HOST makes a chapter with its own fields; it reads back as a chapter', async () => {
  prep = await chapterAs(F.couple, 'Preparation · Bride', '2099-12-18T06:00:00Z', {
    location: 'Sample Hotel',
    spot: 'Bridal suite',
    ingress_minutes_before: 420, // from 11 PM the night before
    call_lead_minutes: 30,
    photo_who: 'tagged',
    photo_when: 'after_event',
  });
  await asUser(F.couple);
  const r = await db.query(`SELECT * FROM public.event_schedule_blocks WHERE event_id = $1`, [F.eventId]);
  const [c] = chaptersFromBlocks(r.rows as never);
  assert.ok(c, 'the host reads the chapter back');
  assert.equal(c!.label, 'Preparation · Bride');
  assert.equal(c!.call_lead_minutes, 30);
  assert.equal(c!.photo_who, 'tagged');
  assert.equal(c!.on_invitation, false, 'a chapter is off the invitation until a host says so');
  assert.equal(new Date(ingressAt(c!)!).toISOString(), '2099-12-17T23:00:00.000Z', 'ingress crosses midnight backwards');
});

test('the COORDINATOR (Edit on the Schedule) makes a chapter whose egress runs past midnight', async () => {
  reception = await chapterAs(F.coord, 'Reception', '2099-12-18T18:00:00Z', {
    end_at: '2099-12-18T23:00:00Z',
    location: 'Sample Hotel',
    spot: 'Ballroom',
    ingress_minutes_before: 1080,
    egress_minutes_after: 420,
  });
  await asUser(F.coord);
  const r = await db.query(`SELECT * FROM public.event_schedule_blocks WHERE block_id = $1`, [reception]);
  assert.equal(r.rows.length, 1, 'the coordinator reads it back');
  const [c] = chaptersFromBlocks(r.rows as never);
  assert.equal(new Date(egressAt(c!)!).toISOString(), '2099-12-19T01:00:00.000Z');
});

test('a chapter refuses a call time outside 0–60 and a photo rule it does not know', async () => {
  for (const [extra, why] of [
    [{ call_lead_minutes: 20 }, 'call time 20'],
    [{ call_lead_minutes: 90 }, 'call time 90'],
    [{ photo_who: 'strangers' }, 'photo_who'],
    [{ photo_when: 'never' }, 'photo_when'],
    [{ ingress_minutes_before: 1500 }, 'ingress over a day'],
    [{ travel_from: 'Hotel' }, 'a from with no to'],
  ] as const) {
    await assertRefused(() => chapterAs(F.couple, 'Bad', '2099-12-18T10:00:00Z', extra), 'event_schedule_blocks', `refused: ${why}`);
  }
});

test('a helper with VIEW, a supplier, a guest and a stranger cannot make a chapter', async () => {
  for (const [uid, who] of [
    [F.viewer, 'view helper'],
    [F.supplier, 'booked supplier'],
    [F.guestUser, 'guest'],
    [F.stranger, 'stranger'],
  ] as const) {
    await assertRefused(() => chapterAs(uid, 'Sneaky', '2099-12-18T09:00:00Z'), 'event_schedule_blocks', `${who} made a chapter`);
  }
});

/* ── the run-of-show shape: one moment, three tasks, two places ────────────────────────────────────────────── */

test('ONE MOMENT holds THREE parallel tasks in TWO places — host and coordinator write them', async () => {
  hmua = await momentAs(F.couple, prep, 'Entourage hair and make-up starts', '2099-12-18T08:00:00Z', '2099-12-18T08:30:00Z');
  await taskAs(F.couple, { block_id: hmua, role: 'Bride', what: 'Final make-up; changes into her robe', sort_order: 0 });
  await taskAs(F.coord, { block_id: hmua, vendor_id: F.booking, crew: 'Team B', what: 'Bridesmaids’ hair and make-up', place: '2F holding room', sort_order: 1 });
  await taskAs(F.coord, { block_id: hmua, group_id: F.group, what: 'In the chair, one by one', place: '2F holding room', sort_order: 2 });

  for (const uid of [F.couple, F.coord, F.viewer, F.supplier]) {
    const rows = await tasksAs(uid);
    assert.equal(rows.length, 3, `${uid === F.supplier ? 'the booked supplier' : 'the team'} reads the three tasks`);
  }
  const moment = await momentRow(F.couple, hmua);
  const chapter = { location: 'Sample Hotel', spot: 'Bridal suite' };
  const rows = await tasksAs(F.couple);
  const places = new Set(rows.map((t) => taskPlace(t, moment, chapter)));
  assert.deepEqual([...places].sort(), ['2F holding room', 'Sample Hotel, Bridal suite'], 'two places: the moment’s room, and the holding room');
});

test('a task’s event comes from its moment — a spoofed event_id is replaced', async () => {
  const id = await taskAs(F.couple, { block_id: hmua, event_id: F.otherEventId, who_label: 'Banquet captain', what: 'Opens the suite' });
  await asOwner();
  const r = await db.query<{ event_id: string }>(`SELECT event_id FROM public.event_schedule_tasks WHERE task_id = $1`, [id]);
  assert.equal(r.rows[0]!.event_id, F.eventId);
  await db.query(`DELETE FROM public.event_schedule_tasks WHERE task_id = $1`, [id]);
});

test('a task has exactly one who, a crew only with a supplier, and never a who from another event', async () => {
  await assertRefused(() => taskAs(F.couple, { block_id: hmua, role: 'Bride', who_label: 'Also', what: 'two whos' }), 'event_schedule_tasks', 'two whos');
  await assertRefused(() => taskAs(F.couple, { block_id: hmua, what: 'no who' }), 'event_schedule_tasks', 'no who');
  await assertRefused(() => taskAs(F.couple, { block_id: hmua, role: 'Bride', crew: 'Team A', what: 'crew without supplier' }), 'event_schedule_tasks', 'crew without a supplier');
  await assertRefused(() => taskAs(F.couple, { block_id: hmua, vendor_id: F.otherBooking, what: 'not ours' }), 'event_schedule_tasks', 'a supplier on another event');
});

test('the BOOKED SUPPLIER, a VIEW helper, a GUEST and a STRANGER cannot write a task', async () => {
  for (const [uid, who] of [
    [F.supplier, 'booked supplier'],
    [F.viewer, 'view helper'],
    [F.guestUser, 'guest'],
    [F.stranger, 'stranger'],
  ] as const) {
    await assertRefused(() => taskAs(uid, { block_id: hmua, vendor_id: F.booking, what: 'my own idea' }), 'event_schedule_tasks', `${who} wrote a task`);
  }
  // …nor change or remove one: RLS answers with zero rows, and the rows stay as they were.
  await asUser(F.supplier);
  const upd = await db.query(`UPDATE public.event_schedule_tasks SET what = 'changed' RETURNING task_id`);
  const del = await db.query(`DELETE FROM public.event_schedule_tasks RETURNING task_id`);
  assert.equal(upd.rows.length + del.rows.length, 0, 'the supplier changed or removed a task');
  assert.equal(await count('event_schedule_tasks', `what = 'changed'`), 0);
  assert.equal(await count('event_schedule_tasks'), 3);
});

test('a GUEST (signed in, on the guest list) and ANON read no task at all', async () => {
  assert.deepEqual(await tasksAs(F.guestUser), [], 'a signed-in guest read a supplier’s task');
  assert.deepEqual(await tasksAs(F.stranger), [], 'a stranger read a task');
  await asAnon();
  await assert.rejects(() => db.query(`SELECT task_id FROM public.event_schedule_tasks`), /permission denied/i, 'anon holds no grant on the tasks');
  await assert.rejects(
    () => db.query(`INSERT INTO public.event_schedule_tasks (block_id, role, what) VALUES ($1,'Bride','x')`, [hmua]),
    /permission denied/i,
    'anon wrote a task',
  );
  assert.equal(await count('event_schedule_tasks'), 3);
});

test('a block the coordinator STAGED hides its tasks from the booked supplier', async () => {
  const staged = await momentAs(F.coord, prep, 'Coordinator’s own sweep', '2099-12-18T13:30:00Z', '2099-12-18T13:45:00Z', { visibility: 'coordinator_only' });
  await taskAs(F.coord, { block_id: staged, vendor_id: F.booking, crew: 'Team B', what: 'Sweep the suite', sort_order: 9 });
  const seen = (await tasksAs(F.supplier)).map((t) => t.block_id);
  assert.ok(!seen.includes(staged), 'the supplier read a task on a staged block');
  assert.ok((await tasksAs(F.coord)).some((t) => t.block_id === staged), 'the coordinator reads it');
  await asOwner();
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1`, [staged]);
});

test('the same crew in a second place at once is a CLASH — found, and NOT refused by the database', async () => {
  const lobby = await taskAs(F.coord, { block_id: hmua, vendor_id: F.booking, crew: 'team b', what: 'Meets the florist', place: 'Lobby', sort_order: 3 });
  const moment = await momentRow(F.coord, hmua);
  const rows = await tasksAs(F.coord);
  const clashes = findTaskClashes(rows.map((task) => ({ task, moment, chapter: { location: 'Sample Hotel', spot: 'Bridal suite' } })));
  assert.equal(clashes.length, 1, 'Team B in the holding room and the lobby at once');
  assert.deepEqual([...clashes[0]!.places].sort(), ['2F holding room', 'Lobby']);
  await asOwner();
  await db.query(`DELETE FROM public.event_schedule_tasks WHERE task_id = $1`, [lobby]);
});

/* ── moving and deleting a chapter ─────────────────────────────────────────────────────────────────────────── */

test('MOVING a chapter moves its moments in one statement; a supplier moves nothing', async () => {
  await asUser(F.supplier);
  const refused = await db.query<{ n: number }>(`SELECT public.move_schedule_chapter($1, $2) AS n`, [prep, '2099-12-18T07:00:00Z']);
  assert.equal(refused.rows[0]!.n, 0, 'the supplier moved the chapter');

  await asUser(F.couple);
  const moved = await db.query<{ n: number }>(`SELECT public.move_schedule_chapter($1, $2) AS n`, [prep, '2099-12-18T07:00:00Z']);
  assert.equal(moved.rows[0]!.n, 2, 'the chapter and its one moment');
  const r = await db.query<{ start_at: Date; ingress_minutes_before: number | null }>(
    `SELECT start_at, ingress_minutes_before FROM public.event_schedule_blocks WHERE block_id IN ($1, $2) ORDER BY parent_block_id NULLS FIRST`,
    [prep, hmua],
  );
  assert.deepEqual(r.rows.map((x) => new Date(x.start_at).toISOString()), ['2099-12-18T07:00:00.000Z', '2099-12-18T09:00:00.000Z']);
  assert.equal(r.rows[0]!.ingress_minutes_before, 420, 'ingress is minutes from the start, so it moved with it');
});

test('DELETING a chapter takes its moments and their tasks — only for the host or coordinator', async () => {
  await asUser(F.supplier);
  const none = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [prep]);
  assert.equal(none.rows.length, 0, 'the supplier deleted a chapter');
  assert.equal(await count('event_schedule_blocks', `block_id = '${prep}'`), 1);

  await asUser(F.coord);
  const gone = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [prep]);
  assert.equal(gone.rows.length, 1);
  assert.equal(await count('event_schedule_blocks', `parent_block_id = '${prep}'`), 0, 'its moments went with it');
  assert.equal(await count('event_schedule_tasks'), 0, 'their tasks went with them');
  assert.equal(await count('event_schedule_blocks', `block_id = '${reception}'`), 1, 'another chapter is untouched');
});
