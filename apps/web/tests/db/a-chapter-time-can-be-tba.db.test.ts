/**
 * 📖 A CHAPTER'S TIME MAY BE TBA — asserted against the DATABASE (migration 20271300482585; owner 2026-11-01, corpus
 * SCHEDULE_CHAPTERS_BUILD_PLAN §2 "Blank start = Time TBA", §3 "Chapter time TBA = no call time").
 *
 *   1 · the couple saves a chapter with no time — it keeps its DAY (`start_at` at 00:00) and reads back as TBA through
 *       the real `chaptersFromBlocks`, and its one line says "Time TBA" (never a guessed 12:00 AM);
 *   2 · setting a time later clears TBA in the same save;
 *   3 · 🛑 a TBA chapter can NEVER be shown to guests (every guest reader filters `is_public`, so the placeholder midnight
 *       never reaches the Event Hub) — refused when made so, and refused when shown later;
 *   4 · a TBA chapter has no end. (A TBA MOMENT — "right after the one above" — was refused here until 2026-11-02; the
 *       owner's 4 additions allow it, held by a-moment-can-be-right-after.db.test.ts.)
 * `is_public` defaults to TRUE on the table, so a TBA row must say FALSE — the Schedule's door does (`createScheduleBlock`).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { CHAPTER_FIELDS, chapterLine, chapterWhen, chaptersFromBlocks } from '../../lib/schedule-chapters';

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

async function readAll() {
  await asCouple();
  const r = await db.query<Record<string, unknown> & { block_id: string }>(
    `SELECT ${CHAPTER_FIELDS} FROM public.event_schedule_blocks WHERE event_id = $1`,
    [eventId],
  );
  // PGlite hands timestamps back as Date — the reader takes either.
  return chaptersFromBlocks(r.rows);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('couple@tba.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
});

after(async () => {
  await replay?.db.close();
});

test('1 · a chapter with no time saves, keeps its day, and reads "Time TBA"', async () => {
  const id = await insert({ label: 'Final fitting', start_at: '2099-12-10T00:00:00Z', time_tba: true, is_public: false });
  const c = (await readAll()).find((x) => x.block_id === id);
  assert.ok(c, 'the TBA chapter did not read back');
  assert.equal(c.time_tba, true);
  assert.equal(c.start_at.slice(0, 10), '2099-12-10', 'a TBA chapter lost its day');
  assert.equal(chapterWhen(c), 'Time TBA');
  assert.match(chapterLine(c), /^Time TBA · /, 'a TBA chapter is drawn at a guessed clock');
  assert.doesNotMatch(chapterLine(c), /12:00 AM/, 'the placeholder midnight reached the screen');
});

test('2 · setting a time later clears TBA in the same save', async () => {
  const id = await insert({ label: 'Tasting', start_at: '2099-12-01T00:00:00Z', time_tba: true, is_public: false });
  await asCouple();
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = '2099-12-01T15:00:00Z', time_tba = FALSE WHERE block_id = $1`, [id]);
  const c = (await readAll()).find((x) => x.block_id === id)!;
  assert.equal(c.time_tba, false);
  assert.equal(chapterWhen(c), '3:00 PM onward');
});

test('3 · a TBA chapter can never be shown to guests', async () => {
  await assert.rejects(
    insert({ label: 'Reception', start_at: '2099-12-18T00:00:00Z', time_tba: true, is_public: true }),
    /time_tba_check|violates/i,
    'a TBA chapter was shown to guests at a guessed midnight',
  );
  const id = await insert({ label: 'After party', start_at: '2099-12-18T00:00:00Z', time_tba: true, is_public: false });
  await asCouple();
  await assert.rejects(
    db.query(`UPDATE public.event_schedule_blocks SET is_public = TRUE WHERE block_id = $1`, [id]),
    /time_tba_check|violates/i,
    'a TBA chapter was switched on for guests',
  );
});

test('4 · a TBA chapter has no end', async () => {
  await assert.rejects(
    insert({ label: 'Cocktails', start_at: '2099-12-18T00:00:00Z', end_at: '2099-12-18T02:00:00Z', time_tba: true, is_public: false }),
    /time_tba_check|violates/i,
    'a TBA chapter carried an end',
  );
});
