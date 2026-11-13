/**
 * DAYS PER EVENT TYPE — migration 20271343002292_event_type_max_days, owner
 * ruling 2026-11-13. Pins the ruling's table, the multi_day parity (derived by
 * trigger, so a write naming multi_day cannot make it disagree), and the CHECK.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

const RULING: Record<string, number> = {
  travel: 30, tournament: 30,
  wedding: 7, debut: 7, birthday: 7, anniversary: 7, celebration: 7,
  corporate: 7, reunion: 7, wake: 7, graduation: 7, concert: 7,
  gala_night: 1, christening: 1, gender_reveal: 1, date: 1, hangout: 1,
  grand_opening: 1, open_house: 1, simple_event: 1,
};

test('every seeded type carries the ruled maximum', async () => {
  const r = await db.query<{ event_type: string; max_days: number }>(
    `SELECT event_type, max_days FROM public.event_type_profiles`,
  );
  const seen = new Map(r.rows.map((x) => [x.event_type, x.max_days]));
  for (const [type, max] of Object.entries(RULING)) {
    if (seen.has(type)) assert.equal(seen.get(type), max, `${type} should be ${max}`);
  }
  for (const key of ['wedding', 'travel', 'wake', 'simple_event']) {
    assert.ok(seen.has(key), `${key} has no profile row`);
  }
});

test('multi_day is always max_days > 1, on seed and on any later write', async () => {
  const bad = await db.query(`SELECT 1 FROM public.event_type_profiles WHERE multi_day <> (max_days > 1)`);
  assert.equal(bad.rows.length, 0);
  // A write that names multi_day (older migrations / admin saves do) cannot break parity.
  await db.query(`UPDATE public.event_type_profiles SET multi_day = TRUE WHERE event_type = 'simple_event'`);
  const r = await db.query<{ multi_day: boolean }>(
    `SELECT multi_day FROM public.event_type_profiles WHERE event_type = 'simple_event'`,
  );
  assert.equal(r.rows[0]!.multi_day, false);
  await db.query(`UPDATE public.event_type_profiles SET max_days = 3 WHERE event_type = 'simple_event'`);
  const r2 = await db.query<{ multi_day: boolean }>(
    `SELECT multi_day FROM public.event_type_profiles WHERE event_type = 'simple_event'`,
  );
  assert.equal(r2.rows[0]!.multi_day, true);
});

test('max_days refuses 0 and 31', async () => {
  await assert.rejects(db.query(`UPDATE public.event_type_profiles SET max_days = 0 WHERE event_type = 'wedding'`));
  await assert.rejects(db.query(`UPDATE public.event_type_profiles SET max_days = 31 WHERE event_type = 'wedding'`));
});
