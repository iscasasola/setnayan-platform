/**
 * 📖 EVERY NEW EVENT STARTS WITH FOUR CHAPTERS — the database half (migration 20271306532960; owner 2026-11-03).
 *
 *   1 · every insert into public.events leaves ONE `event_default_chapters_pending` marker — whatever path made it,
 *       including a couple's own insert under RLS (the trigger is SECURITY DEFINER);
 *   2 · the marker writes no chapter: the schedule stays empty until the app's seed (`seedDefaultChapters`) claims it;
 *   3 · claiming it is one DELETE … RETURNING — a second claim finds nothing (two opens seed once);
 *   4 · it is service-only: no browser role reads or writes it;
 *   5 · it goes with its event;
 *   6 · 📅 an UNDATED event's chapters, seeded on the placeholder day, move onto the real day the moment an exact date
 *       is set — by any path — with their moments; a chapter the host put on another day stays; the marker goes;
 *   7 · a refused move never refuses the date.
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

async function undatedEventWithChapters(name: string, placeholder: string): Promise<{ id: string; chapter: string; moment: string; other: string }> {
  await db.exec(`RESET ROLE`).catch(() => {});
  const id = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting) VALUES ($1,'wedding','catholic','banquet_hall') RETURNING event_id`,
      [name],
    )
  ).rows[0]!.event_id;
  // What the app seed does for an undated event: stamp the claim with the placeholder day, then write the chapters on it.
  await db.query(`UPDATE public.event_default_chapters_pending SET placeholder_day = $2 WHERE event_id = $1`, [id, placeholder]);
  const chapter = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, is_public, sort_order) VALUES ($1,'Ceremony',$2,$3,true,100) RETURNING block_id`,
      [id, `${placeholder}T13:30:00Z`, `${placeholder}T15:30:00Z`],
    )
  ).rows[0]!.block_id;
  const moment = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, parent_block_id, label, start_at, end_at, is_public, sort_order) VALUES ($1,$2,'Procession',$3,$4,false,10) RETURNING block_id`,
      [id, chapter, `${placeholder}T13:30:00Z`, `${placeholder}T13:45:00Z`],
    )
  ).rows[0]!.block_id;
  const other = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, is_public, sort_order) VALUES ($1,'Final fitting',$2,false,10) RETURNING block_id`,
      [id, `2099-01-05T10:00:00Z`],
    )
  ).rows[0]!.block_id;
  return { id, chapter, moment, other };
}

async function startOf(blockId: string): Promise<string> {
  const r = await db.query<{ s: Date }>(`SELECT start_at AS s FROM public.event_schedule_blocks WHERE block_id = $1`, [blockId]);
  return new Date(r.rows[0]!.s).toISOString();
}

test('6 · the date arrives — the placeholder chapters and their moments move onto it; the host’s own day stays', async () => {
  const e = await undatedEventWithChapters('Undated Wedding', '2099-06-01');
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-18', event_date_precision = 'day' WHERE event_id = $1`, [e.id]);
  assert.equal(await startOf(e.chapter), '2099-12-18T13:30:00.000Z', 'the chapter stayed on the placeholder day');
  assert.equal(await startOf(e.moment), '2099-12-18T13:30:00.000Z', 'the moment did not move with its chapter');
  assert.equal(await startOf(e.other), '2099-01-05T10:00:00.000Z', 'a chapter the host put on its own day moved');
  assert.equal(await markers(e.id), 0, 'the marker stayed after the move');
  // A later date change is no longer this trigger's (the shipped Apply path moves the schedule from here).
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-19' WHERE event_id = $1`, [e.id]);
  assert.equal(await startOf(e.chapter), '2099-12-18T13:30:00.000Z');
});

test('6b · a month, not a day, moves nothing yet', async () => {
  const e = await undatedEventWithChapters('Month Only', '2099-06-01');
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-01', event_date_precision = 'month' WHERE event_id = $1`, [e.id]);
  assert.equal(await startOf(e.chapter), '2099-06-01T13:30:00.000Z');
  assert.equal(await markers(e.id), 1);
});

test('7 · a refused move never refuses the date', async () => {
  const e = await undatedEventWithChapters('Refused Move', '2099-06-01');
  // Make the move fail: a CHECK that any shift of this block breaks.
  await db.exec(`ALTER TABLE public.event_schedule_blocks ADD CONSTRAINT zz_test_pin CHECK (label <> 'Ceremony' OR start_at < '2099-07-01') NOT VALID`);
  try {
    await db.query(`UPDATE public.events SET event_date = DATE '2099-12-18', event_date_precision = 'day' WHERE event_id = $1`, [e.id]);
    const d = (await db.query<{ d: Date }>(`SELECT event_date AS d FROM public.events WHERE event_id = $1`, [e.id])).rows[0]!.d;
    assert.equal(new Date(d).toISOString().slice(0, 10), '2099-12-18', 'the date was refused over its schedule');
    assert.equal(await startOf(e.chapter), '2099-06-01T13:30:00.000Z', 'half a move landed');
    assert.equal(await markers(e.id), 1, 'the marker went though nothing moved — the next date would not try again');
  } finally {
    await db.exec(`ALTER TABLE public.event_schedule_blocks DROP CONSTRAINT zz_test_pin`);
  }
});
