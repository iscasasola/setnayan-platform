/**
 * THE PORTFOLIO SAVES AND SPENDS IN ONE STEP — the free room, then the shop wallet.
 *
 * Owner 2026-10-23 (option A): every shop has 50 portfolio credits free; after that 1 credit a photo (a clip 8),
 * paid once from the SHOP wallet, kept while the shop exists. `shop_portfolio_commit` writes the list AND the wallet
 * row in one transaction under the wallet's per-shop lock. The promises a unit test cannot see:
 *
 *   1 · charge = max(0, after − max(free, kept)) — under the free room nothing is charged; past it each NEW photo is
 *       charged once; a re-save / reorder charges nothing; taking photos off frees free spots, never credits.
 *   2 · A SAVE THE WALLET CANNOT COVER WRITES NOTHING — not the list, not a row.
 *   3 · GRANDFATHERED — a shop already past the free room keeps every photo and pays only for a NEW one.
 *   4 · A PERSONAL INVITE'S ALLOWANCE is the shop's free room (read from the row — never a parameter).
 *   5 · A CLIP IS 8 — `shop_portfolio_ref_credits`, the rule the TS quote mirrors.
 *   6 · OWNER-ONLY — another shop's session is answered `not_owner` and writes nothing; anon cannot call it.
 *   7 · A REPEATED spend_ref is answered `duplicate` and writes nothing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
// RELATIVE value imports — the live constants, never restated numbers.
import { VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS as PACK } from '../../lib/vendor-papic-credits';
import { PORTFOLIO_FREE_CREDITS as FREE, portfolioQuote } from '../../lib/shop-portfolio-credits';

let replay: ReplayResult;
let db: PGlite;

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

const refs = (prefix: string, n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => `r2://setnayan-media/vendors/x/portfolio/${prefix}${from + i}.jpg`);

async function stored(shop: string): Promise<string[]> {
  const r = await db.query<{ k: string[] }>(
    `SELECT portfolio_r2_keys AS k FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]!.k;
}

async function balance(shop: string): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT public.shop_papic_wallet_balance($1) AS n`, [shop]);
  return Number(r.rows[0]!.n);
}

async function rows(shop: string): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
    [shop],
  );
  return Number(r.rows[0]!.n);
}

async function landPack(shop: string): Promise<void> {
  await db.query(
    `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind, note) VALUES ($1, $2, 'comp', 'test')`,
    [shop, PACK],
  );
}

type Answer = { status: string; charged?: number; balance?: number | null; charge?: number; photos?: number; clips?: number };
let seq = 0;
async function commit(uid: string, shop: string, list: string[], ref = `portfolio:t${++seq}`): Promise<Answer> {
  await setAuthUid(db, uid);
  try {
    const r = await db.query<{ out: Answer }>(`SELECT public.shop_portfolio_commit($1, $2::text[], $3) AS out`, [
      shop,
      list,
      ref,
    ]);
    return r.rows[0]!.out;
  } finally {
    await setAuthUid(db, null);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the portfolio commit (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 + 2 · the free room is free; past it the wallet pays per new photo; short writes nothing', async () => {
  const u = await newUser('port-a@test.test');
  const shop = await shopOf(u, 'Port A');

  const ten = refs('a', 10);
  const a1 = await commit(u, shop, ten);
  assert.equal(a1.status, 'ok');
  assert.equal(a1.charged, 0, 'a photo inside the free room was charged');
  assert.deepEqual(await stored(shop), ten);

  const full = refs('a', FREE);
  assert.equal((await commit(u, shop, full)).charged, 0, 'filling the free room was charged');

  // Past the free room with an EMPTY wallet: refused, and NOTHING lands.
  const over = [...full, ...refs('b', 3)];
  const short = await commit(u, shop, over);
  assert.equal(short.status, 'insufficient');
  assert.equal(short.charge, 3);
  assert.equal(short.balance, 0);
  assert.deepEqual(await stored(shop), full, 'a refused save still wrote the list');
  assert.equal(await rows(shop), 0, 'a refused save wrote a wallet row');

  // A pack lands; the same save now pays 3, once.
  await landPack(shop);
  const paid = await commit(u, shop, over, 'portfolio:paid-once');
  assert.equal(paid.status, 'ok');
  assert.equal(paid.charged, 3);
  assert.equal(paid.photos, 3, 'the row does not say how many photos it paid for');
  assert.equal(await balance(shop), PACK - 3);
  assert.deepEqual(await stored(shop), over);
  assert.equal(portfolioQuote(full, over, FREE).charge, 3, 'the TS quote disagrees with the SQL charge');

  // 7 · the same spend_ref again: answered, nothing written.
  const again = await commit(u, shop, [...over, ...refs('c', 5)], 'portfolio:paid-once');
  assert.equal(again.status, 'duplicate');
  assert.equal(await balance(shop), PACK - 3, 'a repeated save charged twice');
  assert.deepEqual(await stored(shop), over);

  // A re-save in another order charges nothing.
  assert.equal((await commit(u, shop, [...over].reverse())).charged, 0, 'a reorder was charged');

  // Taking 5 off (48 kept) and adding 5 new: 2 free spots reopen, 3 are paid — no credit comes back.
  const kept = over.slice(0, 48);
  const swap = [...kept, ...refs('d', 5)];
  const s = await commit(u, shop, swap);
  assert.equal(s.charged, 3, 'taking photos off must free free spots, never credits');
  assert.equal(portfolioQuote(over, swap, FREE).charge, 3, 'the TS quote disagrees with the SQL charge');
  assert.equal(await balance(shop), PACK - 6);
});

test('3 · grandfathered: a shop past the free room keeps everything and pays only for a new photo', async () => {
  const u = await newUser('port-b@test.test');
  const shop = await shopOf(u, 'Port B');
  const eighty = refs('g', 80);
  await db.query(`UPDATE public.vendor_profiles SET portfolio_r2_keys = $2 WHERE vendor_profile_id = $1`, [shop, eighty]);
  assert.equal((await commit(u, shop, eighty.slice(0, 60))).charged, 0, 'removing photos was charged');
  await db.query(`UPDATE public.vendor_profiles SET portfolio_r2_keys = $2 WHERE vendor_profile_id = $1`, [shop, eighty]);
  const plusOne = await commit(u, shop, [...eighty, ...refs('h', 1)]);
  assert.equal(plusOne.status, 'insufficient', 'a grandfathered shop added a photo past the free room for free');
  assert.deepEqual(await stored(shop), eighty);
  await landPack(shop);
  const paid = await commit(u, shop, [...eighty, ...refs('h', 1)]);
  assert.equal(paid.charged, 1);
});

test('4 · a personal invite’s allowance is the free room — read from the row', async () => {
  const u = await newUser('port-c@test.test');
  const shop = await shopOf(u, 'Port C');
  await db.query(`UPDATE public.vendor_profiles SET portfolio_photo_allowance = 100 WHERE vendor_profile_id = $1`, [shop]);
  const sixty = await commit(u, shop, refs('p', 60));
  assert.equal(sixty.status, 'ok');
  assert.equal(sixty.charged, 0, 'the personal invite’s 100 free were charged past 50');
  const over = await commit(u, shop, refs('p', 101));
  assert.equal(over.status, 'insufficient');
  assert.equal(over.charge, 1);
});

test('5 · a clip is 8 credits — and uses 8 of the free room', async () => {
  const r = await db.query<{ p: number; c: number; m: number }>(
    `SELECT public.shop_portfolio_ref_credits('a/b.jpg') AS p,
            public.shop_portfolio_ref_credits('a/b.mp4') AS c,
            public.shop_portfolio_ref_credits('a/b.MOV') AS m`,
  );
  assert.deepEqual([Number(r.rows[0]!.p), Number(r.rows[0]!.c), Number(r.rows[0]!.m)], [1, 8, 8]);
  const u = await newUser('port-d@test.test');
  const shop = await shopOf(u, 'Port D');
  const list = [...refs('q', FREE - 4), 'r2://setnayan-media/vendors/x/portfolio/clip.mp4'];
  const a = await commit(u, shop, list);
  assert.equal(a.status, 'insufficient', 'a clip at the edge of the free room was let in free');
  assert.equal(a.charge, 4);
  assert.equal(portfolioQuote([], list, FREE).charge, 4, 'the TS quote prices a clip differently from the SQL');
});

test('6 · 🚨 owner-only: another shop is refused and writes nothing; anon cannot call it', async () => {
  const owner = await newUser('port-e@test.test');
  const other = await newUser('port-f@test.test');
  const shop = await shopOf(owner, 'Port E');
  await shopOf(other, 'Port F');
  await db.exec(`SET ROLE authenticated`);
  try {
    const a = await commit(other, shop, refs('z', 3));
    assert.equal(a.status, 'not_owner', 'another shop’s session saved this portfolio');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
  assert.deepEqual(await stored(shop), [], 'a refused session still wrote the list');
  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(
      db.query(`SELECT public.shop_portfolio_commit($1, ARRAY['x']::text[], 'anon')`, [shop]),
      /permission denied/,
      'anon can call the portfolio commit',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
});
