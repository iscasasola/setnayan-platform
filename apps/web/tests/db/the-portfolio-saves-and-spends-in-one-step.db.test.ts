/**
 * THE PORTFOLIO SAVES IN ONE STEP — AND CHARGES NOTHING (owner 2026-11-23: *"Yes, drop it"* — the 50-photo portfolio
 * cap is dropped; storage is the only limit). Migration `supplier_event_photo_limits` replaced `shop_portfolio_commit`.
 * The promises a unit test cannot see:
 *
 *   1 · ANY NUMBER OF PHOTOS SAVES FREE — no wallet row, the wallet untouched, the list written in order, deduped.
 *   2 · A SHOP PAST THE OLD 50 adds more, free; a re-save, reorder or removal writes exactly the new list.
 *   3 · A PERSONAL INVITE'S ALLOWANCE changes nothing — it is retired, read by no one.
 *   4 · photos and clips are counted in the answer (a clip is a ref `shop_portfolio_ref_credits` calls 8).
 *   5 · OWNER-ONLY — another shop's session is answered `not_owner` and writes nothing; anon cannot call it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
// RELATIVE value import — the live constant, never a restated number.
import { VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS as PACK } from '../../lib/vendor-papic-credits';

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

test('replay applies every migration incl. the no-charge portfolio commit (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · any number of photos saves free — no wallet row, the wallet untouched', async () => {
  const owner = await newUser('port-a@test.test');
  const shop = await shopOf(owner, 'Port A');
  await landPack(shop);
  const before = await balance(shop);
  const list = refs('a', 200);
  const a = await commit(owner, shop, [...list, list[0]!, '']);
  assert.equal(a.status, 'ok');
  assert.equal(a.charged, 0, 'a portfolio save charged credits');
  assert.equal(a.photos, 200);
  assert.deepEqual(await stored(shop), list, 'the list was not written in order, deduped');
  assert.equal(await balance(shop), before, 'the wallet moved');
  assert.equal(await rows(shop), 1, 'a wallet row was written for a portfolio save');
});

test('2 · a shop past the old 50 adds more free; reorder and removal write exactly the new list', async () => {
  const owner = await newUser('port-b@test.test');
  const shop = await shopOf(owner, 'Port B');
  const eighty = refs('b', 80);
  assert.equal((await commit(owner, shop, eighty)).status, 'ok');
  const more = [...eighty, ...refs('c', 5)];
  const a = await commit(owner, shop, more);
  assert.equal(a.status, 'ok');
  assert.equal(a.charged, 0);
  assert.deepEqual(await stored(shop), more);
  const reordered = [...more].reverse().slice(0, 30);
  assert.equal((await commit(owner, shop, reordered)).status, 'ok');
  assert.deepEqual(await stored(shop), reordered);
  assert.equal(await rows(shop), 0, 'a wallet row appeared');
});

test('3 · a personal invite’s allowance changes nothing — it is retired', async () => {
  const owner = await newUser('port-c@test.test');
  const shop = await shopOf(owner, 'Port C');
  await db.query(`UPDATE public.vendor_profiles SET portfolio_photo_allowance = 100 WHERE vendor_profile_id = $1`, [shop]);
  const a = await commit(owner, shop, refs('d', 150));
  assert.equal(a.status, 'ok');
  assert.equal(a.charged, 0);
  assert.equal((await stored(shop)).length, 150);
});

test('4 · photos and clips are counted in the answer', async () => {
  const owner = await newUser('port-d@test.test');
  const shop = await shopOf(owner, 'Port D');
  const a = await commit(owner, shop, [...refs('e', 3), 'r2://setnayan-media/vendors/x/portfolio/clip.mp4']);
  assert.equal(a.status, 'ok');
  assert.equal(a.photos, 3);
  assert.equal(a.clips, 1);
  assert.equal(a.charged, 0);
});

test('5 · 🚨 owner-only: another shop is refused and writes nothing; anon cannot call it', async () => {
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
