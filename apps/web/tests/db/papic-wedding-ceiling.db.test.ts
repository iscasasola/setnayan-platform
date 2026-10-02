/**
 * A WEDDING MAY HOLD 100,000 PAPIC CREDITS — and nothing else moved.
 *
 * Migration under test: 20271258946423. Owner 2026-10-02: Admin › Pricing ›
 * Papic shot prices › "Credits recommended, by kind of celebration" › wedding ›
 * "At most" = 100000 (it read 30,000). That control writes
 * `papic_event_pool_config.ceiling_points` for `config_key = 'wedding'`.
 *
 * Also pinned (owner answer, DECISION_LOG 2026-10-02 #3): the recommendation
 * FLOOR (`recommend_floor_points`) is 5,000 for a wedding and 0 for every other
 * event type. `floor_points` is the ENTITLEMENT and stays 5,000 for all.
 *
 * Run: cd apps/web && npx tsx --test tests/db/papic-wedding-ceiling.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test("the wedding's \"at most\" is 100,000 and its floor and per-head did not move", async () => {
  const r = await db.query<Record<string, number>>(
    `SELECT points_per_guest, floor_points, recommend_floor_points, ceiling_points
       FROM public.papic_event_pool_config WHERE config_key = 'wedding'`,
  );
  assert.deepEqual(r.rows[0], {
    points_per_guest: 150,
    floor_points: 5000,
    recommend_floor_points: 5000,
    ceiling_points: 100000,
  });
});

test('every OTHER type — and the global default — keeps the ceiling it had', async () => {
  const r = await db.query<{ config_key: string; ceiling_points: number }>(
    `SELECT config_key, ceiling_points FROM public.papic_event_pool_config
      WHERE config_key <> 'wedding' ORDER BY config_key`,
  );
  assert.ok(r.rows.length >= 17, 'the sizing rows must exist');
  const moved = r.rows.filter((x) => x.ceiling_points !== 30000);
  assert.deepEqual(
    moved.map((x) => `${x.config_key}=${x.ceiling_points}`),
    [],
    'a non-wedding ceiling changed (every one was 30000 before this migration)',
  );
  const d = r.rows.find((x) => x.config_key === 'default');
  assert.equal(d?.ceiling_points, 30000, 'the global default stays 30,000');
});

test('the SQL resolver the fence sizes through returns the new ceiling for a wedding only', async () => {
  const w = await db.query<{ ceiling_points: number }>(
    `SELECT * FROM public.papic_event_pool_sizing('wedding')`,
  );
  assert.equal(w.rows[0]!.ceiling_points, 100000);
  const b = await db.query<{ ceiling_points: number }>(
    `SELECT * FROM public.papic_event_pool_sizing('birthday')`,
  );
  assert.equal(b.rows[0]!.ceiling_points, 30000);
});

test('the recommendation FLOOR is 5,000 for a wedding and 0 for every other event type', async () => {
  const r = await db.query<{ config_key: string; recommend_floor_points: number }>(
    `SELECT config_key, recommend_floor_points FROM public.papic_event_pool_config
      WHERE config_key <> 'default' ORDER BY config_key`,
  );
  const vocab = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_type_vocab`);
  assert.equal(r.rows.length, vocab.rows[0]!.n, 'one sizing row per event type');
  const wrong = r.rows.filter(
    (x) => x.recommend_floor_points !== (x.config_key === 'wedding' ? 5000 : 0),
  );
  assert.deepEqual(
    wrong.map((x) => `${x.config_key}=${x.recommend_floor_points}`),
    [],
    'wedding must recommend from 5,000; every other type from 0',
  );
});

test('the ENTITLEMENT floor is untouched — 5,000 for every type', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_event_pool_config WHERE floor_points <> 5000`,
  );
  assert.equal(r.rows[0]!.n, 0, 'floor_points is the entitlement; the recommendation floor is a different column');
});
