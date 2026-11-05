/**
 * 🕑 A MOMENT'S TIME CAN BE "ABOUT 3:15" OR "2:15/2:30" — asserted against the DATABASE (migration 20271303051692; owner
 * 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (2)).
 *
 *   1 · every existing row reads 'at' (exactly) — nothing changes for a schedule nobody touched;
 *   2 · 'about' saves; 'or' saves with its second time (minutes after the first), and reads back as written;
 *   3 · refused: an unknown shape, an 'or' with no second time (or one out of range), a second time on 'about', and a
 *       shape on a row with no clock (Time TBA / right after);
 *   4 · the second time moves with the first — a chapter move carries both.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { clockWords } from '../../lib/schedule-chapters';
import { timeAsWritten } from '../../lib/time-shape';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let couple = '';
let chapter = '';

async function asCouple(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, couple);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

async function insert(row: Record<string, unknown>): Promise<string> {
  await asCouple();
  const cols = ['event_id', ...Object.keys(row)];
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING block_id`,
    [eventId, ...Object.values(row)],
  );
  return r.rows[0]!.block_id;
}

async function read(id: string) {
  await asCouple();
  const r = await db.query<{ start_at: Date | string; time_shape: string; time_or_minutes: number | null }>(
    `SELECT start_at, time_shape, time_or_minutes FROM public.event_schedule_blocks WHERE block_id = $1`,
    [id],
  );
  const x = r.rows[0]!;
  return { ...x, start_at: (x.start_at instanceof Date ? x.start_at : new Date(x.start_at)).toISOString() };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('couple@shape.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  chapter = await insert({ label: 'Ceremony', start_at: '2099-12-18T14:00:00Z' });
});

after(async () => {
  await replay?.db.close();
});

test('1 · a row nobody touched reads "at" — exactly, as before', async () => {
  const id = await insert({ label: 'Mass', start_at: '2099-12-18T15:40:00Z', parent_block_id: chapter });
  const r = await read(id);
  assert.equal(r.time_shape, 'at');
  assert.equal(r.time_or_minutes, null);
  assert.equal(timeAsWritten(r, clockWords), '3:40 PM');
});

test('2 · "about" and "one of two" save and read back as written', async () => {
  const about = await insert({ label: 'Entourage lines up', start_at: '2099-12-18T15:15:00Z', parent_block_id: chapter, time_shape: 'about' });
  assert.equal(timeAsWritten(await read(about), clockWords), 'About 3:15 PM');
  const either = await insert({ label: 'Bridal car leaves', start_at: '2099-12-18T14:15:00Z', parent_block_id: chapter, time_shape: 'or', time_or_minutes: 15 });
  assert.equal(timeAsWritten(await read(either), clockWords), '2:15/2:30 PM');
});

test('3 · refused: an unknown shape, a bad or missing second time, a second time on "about", a shape with no clock', async () => {
  const bad = [
    { time_shape: 'around' },
    { time_shape: 'or' },
    { time_shape: 'or', time_or_minutes: 0 },
    { time_shape: 'or', time_or_minutes: 241 },
    { time_shape: 'about', time_or_minutes: 10 },
    { time_shape: 'at', time_or_minutes: 10 },
  ];
  for (const extra of bad) {
    await assert.rejects(
      insert({ label: 'x', start_at: '2099-12-18T15:00:00Z', parent_block_id: chapter, ...extra }),
      /time_shape_check|violates/i,
      `saved ${JSON.stringify(extra)}`,
    );
  }
  await assert.rejects(
    insert({ label: 'Reception', start_at: '2099-12-18T00:00:00Z', time_tba: true, is_public: false, time_shape: 'about' }),
    /time_shape_check|violates/i,
    'a Time-TBA row was "about" a time it does not have',
  );
});

test('4 · the second time moves with the first — a chapter move carries "2:15/2:30" whole', async () => {
  const ch = await insert({ label: 'Bridal car', start_at: '2099-12-18T13:00:00Z' });
  const car = await insert({ label: 'Leaves the hotel', start_at: '2099-12-18T14:15:00Z', parent_block_id: ch, time_shape: 'or', time_or_minutes: 15 });
  await asCouple();
  await db.query(`SELECT public.move_schedule_chapter($1, '2099-12-18T13:30:00Z')`, [ch]);
  assert.equal(timeAsWritten(await read(car), clockWords), '2:45/3:00 PM');
});
