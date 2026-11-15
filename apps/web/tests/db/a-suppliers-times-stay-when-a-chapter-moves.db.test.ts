/**
 * 🗓 A SUPPLIER'S TIMES STAY WHEN A CHAPTER MOVES — asserted against the DATABASE (migration 20271340572060; owner
 * 2026-11-12, DECISION_LOG "SCHEDULES HAND-IN-HAND part (b)" rule 1).
 *
 *   1 · the chapter and every moment NOT named in the keep list move by the same amount, in one statement;
 *   2 · the moments named (a supplier's own "arrives" / "is done") stay exactly where they were;
 *   3 · a kept id that is not a moment of this chapter changes nothing — the other chapter does not move;
 *   4 · the two-argument call every existing caller makes still moves everything, as shipped.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let couple = '';

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

async function startOf(id: string): Promise<string> {
  await asCouple();
  const r = await db.query<{ start_at: Date | string }>(`SELECT start_at FROM public.event_schedule_blocks WHERE block_id = $1`, [id]);
  const v = r.rows[0]!.start_at;
  return (v instanceof Date ? v : new Date(v)).toISOString();
}

let chapter = '';
let other = '';
let vows = '';
let arrives = '';
let done = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('couple@times-stay.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  chapter = await insert({ label: 'Ceremony', start_at: '2099-12-18T14:00:00Z', end_at: '2099-12-18T15:30:00Z' });
  other = await insert({ label: 'Reception', start_at: '2099-12-18T18:00:00Z' });
  vows = await insert({ label: 'Vows', start_at: '2099-12-18T14:30:00Z', parent_block_id: chapter });
  arrives = await insert({ label: 'Rosa Lens Studio arrives', start_at: '2099-12-18T12:30:00Z', parent_block_id: chapter });
  done = await insert({ label: 'Rosa Lens Studio is done', start_at: '2099-12-18T15:30:00Z', parent_block_id: chapter });
});

after(async () => {
  await replay?.db.close();
});

test('1 + 2 · the chapter and its moments move 30 min; the kept arrive / done stay', async () => {
  await asCouple();
  const r = await db.query<{ n: number }>(`SELECT public.move_schedule_chapter($1, '2099-12-18T14:30:00Z', $2::uuid[]) AS n`, [
    chapter,
    [arrives, done],
  ]);
  assert.equal(r.rows[0]?.n, 2, 'the chapter and Vows — two rows moved, never the kept ones');
  assert.equal(await startOf(chapter), '2099-12-18T14:30:00.000Z');
  assert.equal(await startOf(vows), '2099-12-18T15:00:00.000Z', 'a moment that is not kept moves with its chapter');
  assert.equal(await startOf(arrives), '2099-12-18T12:30:00.000Z', 'the supplier’s arrive moved');
  assert.equal(await startOf(done), '2099-12-18T15:30:00.000Z', 'the supplier’s done moved');
});

test('3 · a kept id outside the chapter changes nothing there', async () => {
  await asCouple();
  await db.query(`SELECT public.move_schedule_chapter($1, '2099-12-18T14:00:00Z', $2::uuid[])`, [chapter, [other, arrives, done]]);
  assert.equal(await startOf(other), '2099-12-18T18:00:00.000Z', 'another chapter moved');
  assert.equal(await startOf(chapter), '2099-12-18T14:00:00.000Z');
});

test('4 · the two-argument call still moves every moment, as shipped', async () => {
  await asCouple();
  const r = await db.query<{ n: number }>(`SELECT public.move_schedule_chapter($1, '2099-12-18T15:00:00Z') AS n`, [chapter]);
  assert.equal(r.rows[0]?.n, 4);
  assert.equal(await startOf(arrives), '2099-12-18T13:30:00.000Z');
});
