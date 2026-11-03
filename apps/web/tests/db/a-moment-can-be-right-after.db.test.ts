/**
 * ⏭ A MOMENT CAN BE "RIGHT AFTER THE ONE ABOVE" — asserted against the DATABASE (migration 20271302727358; owner
 * 2026-11-02, DECISION_LOG "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (1)).
 *
 *   1 · a moment saves with no time of its own (`time_tba`), following the moment above it — its start is that
 *       moment's start (an order key), never a midnight;
 *   2 · still refused: an untimed moment shown to guests, or carrying an end; an anchor on a timed row, on a chapter,
 *       on itself, or in another chapter;
 *   3 · when the moment above moves, the one right after moves with it — a chain moves as one;
 *   4 · a chapter move shifts every moment once (a follower is not moved twice);
 *   5 · deleting the moment above keeps the follower, unanchored, where it was.
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

async function row(id: string) {
  await asCouple();
  return (
    await db.query<{ follows_block_id: string | null; time_tba: boolean }>(
      `SELECT follows_block_id, time_tba FROM public.event_schedule_blocks WHERE block_id = $1`,
      [id],
    )
  ).rows[0];
}

let chapter = '';
let other = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('couple@after.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  chapter = await insert({ label: 'Reception', start_at: '2099-12-18T18:00:00Z' });
  other = await insert({ label: 'Ceremony', start_at: '2099-12-18T15:00:00Z' });
});

after(async () => {
  await replay?.db.close();
});

test('1 · a moment saves with no time of its own, after the moment above, at its order key', async () => {
  const cake = await insert({ label: 'Cake cutting', start_at: '2099-12-18T20:15:00Z', parent_block_id: chapter });
  const toss = await insert({
    label: 'Bouquet toss',
    start_at: '2099-12-18T20:15:00Z',
    parent_block_id: chapter,
    time_tba: true,
    is_public: false,
    follows_block_id: cake,
  });
  const r = await row(toss);
  assert.equal(r?.time_tba, true);
  assert.equal(r?.follows_block_id, cake);
  assert.equal(await startOf(toss), await startOf(cake), 'its stored start is the moment above’s — an order key');
  assert.doesNotMatch(await startOf(toss), /T00:00/, 'a guessed midnight was stored');
});

test('2 · still refused: shown to guests, an end, an anchor on a timed row / a chapter / itself / another chapter', async () => {
  const a = await insert({ label: 'First dance', start_at: '2099-12-18T19:00:00Z', parent_block_id: chapter });
  await assert.rejects(
    insert({ label: 'x', start_at: '2099-12-18T19:00:00Z', parent_block_id: chapter, time_tba: true, is_public: true, follows_block_id: a }),
    /time_tba_check|violates/i,
    'an untimed moment was shown to guests',
  );
  await assert.rejects(
    insert({ label: 'x', start_at: '2099-12-18T19:00:00Z', end_at: '2099-12-18T19:30:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: a }),
    /time_tba_check|violates/i,
    'an untimed moment carried an end',
  );
  await assert.rejects(
    insert({ label: 'x', start_at: '2099-12-18T19:00:00Z', parent_block_id: chapter, follows_block_id: a }),
    /follows_check|violates/i,
    'a TIMED moment named an anchor',
  );
  await assert.rejects(
    insert({ label: 'x', start_at: '2099-12-18T00:00:00Z', time_tba: true, is_public: false, follows_block_id: a }),
    // The same-chapter trigger runs before the CHECK; either refusal is the database saying no.
    /follows_check|follows_other_chapter|violates/i,
    'a chapter followed a moment',
  );
  const inOther = await insert({ label: 'Vows', start_at: '2099-12-18T15:30:00Z', parent_block_id: other });
  await assert.rejects(
    insert({ label: 'x', start_at: '2099-12-18T15:30:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: inOther }),
    /follows_other_chapter/i,
    'a moment followed a moment of another chapter',
  );
  const self = await insert({ label: 'y', start_at: '2099-12-18T19:00:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: a });
  await asCouple();
  await assert.rejects(
    db.query(`UPDATE public.event_schedule_blocks SET follows_block_id = block_id WHERE block_id = $1`, [self]),
    /follows_check|violates/i,
    'a moment followed itself',
  );
});

test('3 · when the moment above moves, the one right after moves with it — a chain moves as one', async () => {
  const speech = await insert({ label: 'Speeches', start_at: '2099-12-18T21:00:00Z', parent_block_id: chapter });
  const toast = await insert({ label: 'Toast', start_at: '2099-12-18T21:00:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: speech });
  const photo = await insert({ label: 'Photo with the toast', start_at: '2099-12-18T21:00:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: toast });
  await asCouple();
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = '2099-12-18T21:30:00Z' WHERE block_id = $1`, [speech]);
  assert.equal(await startOf(toast), '2099-12-18T21:30:00.000Z', 'the moment right after stayed behind');
  assert.equal(await startOf(photo), '2099-12-18T21:30:00.000Z', 'the chain broke');
});

test('4 · a chapter move shifts every moment once — a follower is not moved twice', async () => {
  const ch = await insert({ label: 'After party', start_at: '2099-12-18T22:00:00Z' });
  const a = await insert({ label: 'DJ set', start_at: '2099-12-18T22:00:00Z', parent_block_id: ch });
  const b = await insert({ label: 'Last song', start_at: '2099-12-18T22:00:00Z', parent_block_id: ch, time_tba: true, is_public: false, follows_block_id: a });
  const c = await insert({ label: 'Sparklers', start_at: '2099-12-18T22:30:00Z', parent_block_id: ch });
  await asCouple();
  const moved = await db.query<{ n: number }>(`SELECT public.move_schedule_chapter($1, '2099-12-18T22:30:00Z') AS n`, [ch]);
  assert.equal(moved.rows[0]?.n, 4);
  assert.equal(await startOf(a), '2099-12-18T22:30:00.000Z');
  assert.equal(await startOf(b), '2099-12-18T22:30:00.000Z', 'the follower was moved twice (or not at all)');
  assert.equal(await startOf(c), '2099-12-18T23:00:00.000Z', 'a timed moment that shares a key with the follower was disturbed');
});

test('5 · deleting the moment above keeps the follower, unanchored, where it was', async () => {
  const a = await insert({ label: 'Garter', start_at: '2099-12-18T23:30:00Z', parent_block_id: chapter });
  const b = await insert({ label: 'Send-off', start_at: '2099-12-18T23:30:00Z', parent_block_id: chapter, time_tba: true, is_public: false, follows_block_id: a });
  await asCouple();
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1`, [a]);
  const r = await row(b);
  assert.ok(r, 'the follower was deleted with the moment above it');
  assert.equal(r.follows_block_id, null);
  assert.equal(r.time_tba, true);
  assert.equal(await startOf(b), '2099-12-18T23:30:00.000Z');
});
