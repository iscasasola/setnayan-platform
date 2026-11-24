/**
 * PAPIC_GUEST_150 GIFT = RETAIL · THE VIDEO BOOTH IS RETIRED (test:db) — migration 20271361354222
 * (owner rulings, specs DECISION_LOG "Seven open calls settled", items 6 and 7).
 *
 * Each case is a way the data migration could be wrong:
 *   · after the replay, PAPIC_GUEST_150's gift price is not its retail price;
 *   · after the replay, the photo-booth 'Patiktok' option ("Video booth") is still active, so sign-up offers it;
 *   · re-applying the migration overwrites an admin's later edit (each UPDATE must be guarded on the old value);
 *   · the migration touches a row it was not asked to.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

const MIGRATION = readFileSync(
  join(
    __dirname, '..', '..', '..', '..', 'supabase', 'migrations',
    '20271361354222_papic_guest_150_gift_equals_retail_and_retire_video_booth.sql',
  ),
  'utf8',
);

async function papic(): Promise<{ retail: string; gift: string } | null> {
  const r = await db.query<{ retail: string; gift: string }>(
    `SELECT retail_price_php::text AS retail, gift_price_php::text AS gift
       FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST_150'`,
  );
  return r.rows[0] ?? null;
}
async function videoBooth(): Promise<string | null> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.onboarding_refinement_options WHERE leaf_key = 'photo_booth' AND option_key = 'Patiktok'`,
  );
  return r.rows[0]?.status ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('1 · after the replay, PAPIC_GUEST_150 is gifted at its retail price', async () => {
  const row = await papic();
  assert.ok(row, 'PAPIC_GUEST_150 is missing from platform_retail_catalog_v2 after the replay');
  assert.equal(Number(row.gift), Number(row.retail), 'the gift price must equal the retail price');
});

test('2 · after the replay, the Video booth option is retired, so the sign-up read (status = active) hides it', async () => {
  assert.equal(await videoBooth(), 'retired');
});

test("3 · from prod's state before the ruling (99 / 90, active) the migration lands both rulings", async () => {
  await db.exec(`UPDATE public.platform_retail_catalog_v2 SET retail_price_php = 99, gift_price_php = 90 WHERE service_code = 'PAPIC_GUEST_150'`);
  await db.exec(`UPDATE public.onboarding_refinement_options SET status = 'active' WHERE leaf_key = 'photo_booth' AND option_key = 'Patiktok'`);
  await db.exec(MIGRATION);
  const row = await papic();
  assert.equal(Number(row!.gift), 99);
  assert.equal(Number(row!.retail), 99);
  assert.equal(await videoBooth(), 'retired');
});

test('4 · re-applying never overwrites a gift price an admin moved off the old value', async () => {
  await db.exec(`UPDATE public.platform_retail_catalog_v2 SET gift_price_php = 95 WHERE service_code = 'PAPIC_GUEST_150'`);
  await db.exec(MIGRATION);
  assert.equal(Number((await papic())!.gift), 95, 'an admin-set gift price (not the old 90) must be left alone');
  assert.equal(await videoBooth(), 'retired', 'an already-retired option stays retired');
});

test('5 · it touches no other row', async () => {
  const before = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.platform_retail_catalog_v2 WHERE service_code <> 'PAPIC_GUEST_150' AND gift_price_php = 90`,
  );
  const opts = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.onboarding_refinement_options WHERE status = 'active'`,
  );
  await db.exec(MIGRATION);
  const after1 = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.platform_retail_catalog_v2 WHERE service_code <> 'PAPIC_GUEST_150' AND gift_price_php = 90`,
  );
  const opts1 = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.onboarding_refinement_options WHERE status = 'active'`,
  );
  assert.equal(after1.rows[0]!.n, before.rows[0]!.n);
  assert.equal(opts1.rows[0]!.n, opts.rows[0]!.n);
});
