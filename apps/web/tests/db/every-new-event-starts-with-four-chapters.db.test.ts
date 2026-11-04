/**
 * 📖 EVERY NEW EVENT STARTS WITH FOUR CHAPTERS — the database half (migration 20271306532960; owner 2026-11-03).
 *
 *   1 · every insert into public.events leaves ONE `event_default_chapters_pending` marker — whatever path made it,
 *       including a couple's own insert under RLS (the trigger is SECURITY DEFINER);
 *   2 · the marker writes no chapter: the schedule stays empty until the app's seed (`seedDefaultChapters`) claims it;
 *   3 · claiming it is one DELETE … RETURNING — a second claim finds nothing (two opens seed once);
 *   4 · it is service-only: no browser role reads or writes it;
 *   5 · it goes with its event.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function newEvent(name: string): Promise<string> {
  await db.exec(`RESET ROLE`).catch(() => {});
  return (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
      [name],
    )
  ).rows[0]!.event_id;
}

async function markers(eventId: string): Promise<number> {
  await db.exec(`RESET ROLE`).catch(() => {});
  return Number(
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_default_chapters_pending WHERE event_id = $1`, [eventId])).rows[0]!.n,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.db.close();
});

test('1 · a new event leaves one marker', async () => {
  const id = await newEvent('Marker Wedding');
  assert.equal(await markers(id), 1);
});

test('2 · the marker writes no chapter by itself', async () => {
  const id = await newEvent('Empty Until Opened');
  const n = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_blocks WHERE event_id = $1`, [id])).rows[0]!.n;
  assert.equal(Number(n), 0, 'the marker wrote blocks — every test event in the suite would carry four chapters');
});

test('3 · the claim is one DELETE … RETURNING — the second finds nothing', async () => {
  const id = await newEvent('Claimed Once');
  const first = await db.query(`DELETE FROM public.event_default_chapters_pending WHERE event_id = $1 RETURNING event_id`, [id]);
  const second = await db.query(`DELETE FROM public.event_default_chapters_pending WHERE event_id = $1 RETURNING event_id`, [id]);
  assert.equal(first.rows.length, 1);
  assert.equal(second.rows.length, 0, 'a second open could seed the chapters again');
});

test('4 · no browser role reads or writes the marker', async () => {
  const id = await newEvent('Service Only');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`RESET ROLE`).catch(() => {});
    await db.exec(`SET ROLE ${role}`);
    const who = (await db.query<{ u: string }>(`SELECT current_user AS u`)).rows[0]!.u;
    assert.equal(who, role, 'the check is not running as the browser role — it would pass vacuously');
    await assert.rejects(db.query(`SELECT 1 FROM public.event_default_chapters_pending WHERE event_id = $1`, [id]), /permission denied/, `${role} reads the marker`);
    await assert.rejects(db.query(`DELETE FROM public.event_default_chapters_pending WHERE event_id = $1`, [id]), /permission denied/, `${role} claims the marker`);
  }
  await db.exec(`RESET ROLE`);
  assert.equal(await markers(id), 1);
});

test('5 · the marker goes with its event', async () => {
  const id = await newEvent('Deleted Event');
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [id]);
  assert.equal(await markers(id), 0);
});
