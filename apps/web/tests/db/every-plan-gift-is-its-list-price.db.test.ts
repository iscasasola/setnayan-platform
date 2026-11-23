/**
 * 🎁 EVERY EVENT-PLAN GIFT IS ITS LIST PRICE — controller ruling on PR #8004, 20 Nov; DECISION_LOG 2026-11-14
 * "EVERYONE PAYS THE REGULAR PRICE" (`gift_price_php` is not a price anywhere) and 16 Nov "every shop pays the list price
 * for a bought gift".
 *
 * Read from the catalogue after the full replay — never typed: whatever an event plan's list price is, its gift price
 * is the same figure (or NULL, not giftable). Event Plus was the last plan row still carrying an old discount (₱2,690
 * against ₱2,990), fixed in 20271356433378 § 2c.
 *
 * ⚠ SCOPE: the event plans this PR re-cuts. The Papic pack rows still carry their 4 Nov gift figures in a column no
 * code reads (lib/shop-gifts.ts: "`gift_price_php` is not a price anywhere") — flagged on the PR, not changed here.
 *
 * Run: pnpm --filter @setnayan/web test:db
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

const EVENT_PLANS = ['EVENT_PLUS', 'COUPLE_WEBSITE_PRO', 'EVENT_ULTRA'];

test('every event plan’s gift price equals its own list price (or it is not giftable)', async () => {
  const r = await db.query<{ service_code: string; retail: string | null; gift: string | null }>(
    `SELECT service_code, retail_price_php::text AS retail, gift_price_php::text AS gift
       FROM public.platform_retail_catalog_v2
      WHERE service_code = ANY($1)`,
    [EVENT_PLANS],
  );
  assert.ok(r.rows.length >= 2, 'the event plan rows are in the catalogue');
  for (const row of r.rows) {
    if (row.gift === null) continue;
    assert.equal(Number(row.gift), Number(row.retail), `${row.service_code}: gift ₱${row.gift} ≠ list ₱${row.retail}`);
  }
});

test('Event Plus specifically is giftable at its list price — the row this PR moved', async () => {
  const r = await db.query<{ retail: string; gift: string | null }>(
    `SELECT retail_price_php::text AS retail, gift_price_php::text AS gift
       FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_PLUS'`,
  );
  assert.equal(r.rows.length, 1);
  assert.notEqual(r.rows[0]!.gift, null, 'Event Plus stays giftable');
  assert.equal(Number(r.rows[0]!.gift), Number(r.rows[0]!.retail));
});
