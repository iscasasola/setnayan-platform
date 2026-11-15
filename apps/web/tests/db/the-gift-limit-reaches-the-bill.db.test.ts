/**
 * THE GIFT LIMIT IS ONE SETTING, AND THE BILL OBEYS IT (test:db) — THE ONE BUILD, lane C2 (owner v112 answer,
 * 8 Nov 2026: "Gift limit · % of the booking fee", default 40, set in Admin › Gifts; spec
 * plans/supplier_one_build_2026-11-08 §5.3, B2 §5 guard 2).
 *
 * The gift percentage lives in TWO languages: the TS the quote shows (`setnayanGiftForFee(…, { limitPct })`) and
 * the SQL the bill charges (`setnayan_gift_for_fee`, which now READS `platform_settings.gift_limit_pct`). A setting
 * that moved one and not the other would show a couple one photo count and bill the supplier for another. So:
 *   · the column exists, defaults to 40, and refuses anything outside 0–100;
 *   · at 40 and at 25 the SQL charge is exactly floor(fee × pct / 100) below the cap;
 *   · at 40 and at 25 TS == SQL over a sweep of real booking amounts (the fee is read from SQL);
 *   · the 2-arg wrapper (the shop's gift price) follows the setting with no change of its own;
 *   · the function body names the column — a re-typed 40 would pass every number at the default and fail here.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { bookingFeePhp } from '../../lib/booking-fee';
import {
  GIFT_LIMIT_PCT_DEFAULT,
  giftLadderFrom,
  setnayanGiftForFee,
  type GiftCatalogRow,
  type GiftRung,
  type GiftTierRow,
} from '../../lib/setnayan-gift';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Gift = { credits: number; charge_centavos: number; capped: boolean };

async function sqlGiftForFee(feeCentavos: number): Promise<Gift> {
  const r = await db.query<{ credits: number; charge_centavos: string; capped: boolean }>(
    `SELECT credits, charge_centavos, capped FROM public.setnayan_gift_for_fee($1::bigint)`,
    [feeCentavos],
  );
  const row = r.rows[0]!;
  return { credits: Number(row.credits), charge_centavos: Number(row.charge_centavos), capped: row.capped };
}
async function sqlFeeCentavos(bookingPhp: number): Promise<number> {
  const r = await db.query<{ fee: string }>(`SELECT public.booking_fee_centavos($1::bigint) AS fee`, [
    Math.round(bookingPhp * 100),
  ]);
  return Number(r.rows[0]!.fee);
}
async function tsLadder(): Promise<GiftRung[]> {
  const c = await db.query<GiftCatalogRow>(
    `SELECT service_code, retail_price_php, is_active, retired_at
       FROM public.platform_retail_catalog_v2 WHERE service_code LIKE 'PAPIC_GUEST%'`,
  );
  const t = await db.query<GiftTierRow>(
    `SELECT service_code, points, is_active, is_topup
       FROM public.papic_pass_tiers WHERE service_code LIKE 'PAPIC_GUEST%'`,
  );
  return giftLadderFrom(c.rows, t.rows);
}
async function setLimit(pct: number): Promise<void> {
  await db.query(`UPDATE public.platform_settings SET gift_limit_pct = $1 WHERE id = 1`, [pct]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('the column exists, defaults to the ruled 40, and refuses anything outside 0–100', async () => {
  const r = await db.query<{ pct: number }>(`SELECT gift_limit_pct AS pct FROM public.platform_settings WHERE id = 1`);
  assert.equal(Number(r.rows[0]!.pct), 40);
  assert.equal(GIFT_LIMIT_PCT_DEFAULT, 40, 'the TS default must be the same ruled 40');
  for (const bad of [-1, 101]) {
    await assert.rejects(setLimit(bad), /gift_limit_pct_range|check constraint/i, `${bad} must be refused`);
  }
  await setLimit(0);
  await setLimit(100);
  await setLimit(40);
});

test('at 40 and at 25 the SQL charge is floor(fee × pct / 100) below the cap — the setting, not a constant', async () => {
  for (const pct of [40, 25]) {
    await setLimit(pct);
    for (const booking of [20_000, 30_000, 45_000]) {
      const fee = await sqlFeeCentavos(booking);
      const g = await sqlGiftForFee(fee);
      assert.equal(g.charge_centavos, Math.floor((fee * pct) / 100), `₱${booking} at ${pct}%`);
      assert.equal(g.capped, false);
    }
  }
  await setLimit(40);
});

test('TS == SQL at 40 and at 25, over a sweep of real booking amounts', async () => {
  const ladder = await tsLadder();
  assert.ok(ladder.length >= 3, `the replayed gift ladder has rungs (${ladder.length})`);
  let differs = 0;
  for (const pct of [40, 25]) {
    await setLimit(pct);
    let checked = 0;
    for (let booking = 0; booking <= 1_500_000; booking += booking < 100_000 ? 2_311 : 61_007) {
      const sqlFee = await sqlFeeCentavos(booking);
      assert.equal(Math.round(bookingFeePhp(booking) * 100), sqlFee, `fee parity at ₱${booking}`);
      const sql = await sqlGiftForFee(sqlFee);
      const ts = setnayanGiftForFee(sqlFee, ladder, { limitPct: pct });
      assert.deepEqual(
        { credits: ts.credits, charge_centavos: ts.chargeCentavos, capped: ts.capped },
        sql,
        `gift parity at ₱${booking}, ${pct}%`,
      );
      if (pct === 25 && sql.credits !== setnayanGiftForFee(sqlFee, ladder, { limitPct: 40 }).credits) differs += 1;
      checked += 1;
    }
    assert.ok(checked > 50, `swept ${checked} amounts at ${pct}%`);
  }
  assert.ok(differs > 10, `25% must actually size a different gift than 40% (${differs} amounts differed)`);
  await setLimit(40);
});

test('the 2-arg wrapper (shop gift price) follows the setting with no change of its own', async () => {
  const fee = await sqlFeeCentavos(30_000);
  await setLimit(40);
  const at40 = await db.query<{ credits: number }>(
    `SELECT credits FROM public.setnayan_gift_for_fee($1::bigint, gen_random_uuid())`,
    [fee],
  );
  await setLimit(25);
  const at25 = await db.query<{ credits: number }>(
    `SELECT credits FROM public.setnayan_gift_for_fee($1::bigint, gen_random_uuid())`,
    [fee],
  );
  await setLimit(40);
  assert.equal(Number(at40.rows[0]!.credits), (await sqlGiftForFeeAt(fee, 40)).credits);
  assert.ok(Number(at25.rows[0]!.credits) < Number(at40.rows[0]!.credits), 'a lower limit sizes a smaller gift');
});

async function sqlGiftForFeeAt(fee: number, pct: number): Promise<Gift> {
  await setLimit(pct);
  const g = await sqlGiftForFee(fee);
  await setLimit(40);
  return g;
}

test('the live function body READS gift_limit_pct — no re-typed share', async () => {
  const r = await db.query<{ src: string }>(
    `SELECT prosrc AS src FROM pg_proc WHERE proname = 'setnayan_gift_for_fee' AND pronargs = 1`,
  );
  const src = r.rows[0]!.src;
  assert.match(src, /gift_limit_pct/, 'setnayan_gift_for_fee must read platform_settings.gift_limit_pct');
  assert.doesNotMatch(src, /c_share_pct\s+CONSTANT/i, 'the share must not be a CONSTANT any more');
});
