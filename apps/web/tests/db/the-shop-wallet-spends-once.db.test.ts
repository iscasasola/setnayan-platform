/**
 * THE SHOP WALLET SPENDS ONCE — and only the shop reads it.
 *
 * Owner 2026-10-23 (option A): ONE shop wallet. Packs go into one shop balance
 * (`shop_papic_wallet_entries`), spendable on the portfolio or on any event the
 * shop is booked on. A balance is money; these are the structural promises a
 * unit test cannot see:
 *
 *   1 · NO DOUBLE SPEND — the only spend door (`shop_papic_wallet_spend`)
 *       refuses what the balance cannot cover (nothing written), and a repeat
 *       of the same spend_ref charges nothing (`duplicate`).
 *   2 · SIGN IS TIED TO KIND — a spend row can never mint, a pack can never
 *       drain; a zero row is refused.
 *   3 · A PACK LANDS ONCE — (order_id, kind) is unique, so a re-approval
 *       cannot double-grant and a re-run refund cannot take it back twice.
 *   4 · RLS — a shop reads only its own wallet; another shop and a couple read
 *       none of it; no session can write a row or call the spend door.
 *   5 · THE BALANCE IS THE SUM — `shop_papic_wallet_balance` agrees with the
 *       rows, including a reversal that takes it below zero (and then every
 *       spend is refused).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
// RELATIVE value import — the live constant, never a restated number.
import { VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS as PACK } from '../../lib/vendor-papic-credits';

let replay: ReplayResult;
let db: PGlite;

let coupleId: string;
let userA: string;
let userB: string;
let shopA: string;
let shopB: string;

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    await db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [
      existing.rows[0].vendor_profile_id,
      name,
    ]);
    return existing.rows[0].vendor_profile_id;
  }
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function packOrder(userId: string, shop: string): Promise<string> {
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, 'vendor_papic_portfolio_pack', 'Papic credit pack', 500, 'submitted', $3)
     RETURNING order_id`,
    [userId, shop, `W${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)}`],
  );
  return r.rows[0]!.order_id;
}

async function landPack(shop: string, orderId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind, order_id)
     VALUES ($1, $2, 'pack_order', $3)`,
    [shop, PACK, orderId],
  );
}

async function balance(shop: string): Promise<number> {
  const r = await db.query<{ n: number }>(`SELECT public.shop_papic_wallet_balance($1) AS n`, [shop]);
  return Number(r.rows[0]!.n);
}

type Spend = { status: string; balance?: number; entry_id?: string };
async function spend(shop: string, credits: number, ref: string, kind = 'portfolio_spend'): Promise<Spend> {
  const r = await db.query<{ out: Spend }>(
    `SELECT public.shop_papic_wallet_spend($1, $2, $3, $4) AS out`,
    [shop, credits, kind, ref],
  );
  return r.rows[0]!.out;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  coupleId = await newUser('couple-wallet@test.test', 'customer');
  userA = await newUser('shop-a-wallet@test.test', 'vendor');
  userB = await newUser('shop-b-wallet@test.test', 'vendor');
  shopA = await shopOf(userA, 'Wallet Shop A');
  shopB = await shopOf(userB, 'Wallet Shop B');
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the wallet (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total);
});

test('3 · a pack lands once per order; a second pack stacks', async () => {
  const o1 = await packOrder(userA, shopA);
  await landPack(shopA, o1);
  await assert.rejects(landPack(shopA, o1), /shop_papic_wallet_entries_order_kind_unique|duplicate key/);
  assert.equal(await balance(shopA), PACK, 'a re-approved pack landed twice');
  const o2 = await packOrder(userA, shopA);
  await landPack(shopA, o2);
  assert.equal(await balance(shopA), PACK * 2, 'a second pack must stack');
});

test('1 · 🚨 no double spend: a repeat spend_ref charges nothing; an over-spend writes nothing', async () => {
  const start = await balance(shopA);
  const first = await spend(shopA, 3, 'portfolio:save-1');
  assert.equal(first.status, 'ok');
  assert.equal(first.balance, start - 3);
  assert.equal(await balance(shopA), start - 3);

  // The same Save, retried (a double tap, a network retry): answered, not charged.
  const again = await spend(shopA, 3, 'portfolio:save-1');
  assert.equal(again.status, 'duplicate');
  assert.equal(again.entry_id, first.entry_id, 'the duplicate answer must name the row that already paid');
  assert.equal(await balance(shopA), start - 3, 'a repeated spend_ref charged twice');

  // More than the balance: refused, and nothing written.
  const rowsBefore = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
    [shopA],
  );
  const over = await spend(shopA, (await balance(shopA)) + 1, 'portfolio:save-2');
  assert.equal(over.status, 'insufficient');
  assert.equal(over.balance, start - 3);
  const rowsAfter = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
    [shopA],
  );
  assert.equal(rowsAfter.rows[0]!.n, rowsBefore.rows[0]!.n, 'a refused spend wrote a row');

  // Exactly the balance: allowed, and the wallet reads 0 — then 1 more is refused.
  const all = await spend(shopA, await balance(shopA), 'capture:last-credit', 'event_spend');
  assert.equal(all.status, 'ok');
  assert.equal(await balance(shopA), 0);
  assert.equal((await spend(shopA, 1, 'capture:one-more', 'event_spend')).status, 'insufficient');

  // A spend for ANOTHER shop with the same ref is a different spend (the key is per shop).
  const oB = await packOrder(userB, shopB);
  await landPack(shopB, oB);
  assert.equal((await spend(shopB, 3, 'portfolio:save-1')).status, 'ok');
});

test('1b · the spend door refuses nonsense without writing', async () => {
  for (const [credits, kind, ref] of [
    [0, 'portfolio_spend', 'x:zero'],
    [-5, 'portfolio_spend', 'x:negative'],
    [1, 'pack_order', 'x:mint'],
    [1, 'reversal', 'x:reversal'],
    [1, 'portfolio_spend', '   '],
  ] as const) {
    const r = await spend(shopB, credits, ref, kind);
    assert.equal(r.status, 'invalid', `spend(${credits}, ${kind}, "${ref}") was not refused`);
  }
});

test('2 · the sign is tied to the kind; a zero row is refused', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind, spend_ref)
       VALUES ($1, 50, 'portfolio_spend', 'mint-by-spend')`,
      [shopB],
    ),
    /shop_papic_wallet_entries_sign_matches_kind/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind) VALUES ($1, -50, 'pack_order')`,
      [shopB],
    ),
    /shop_papic_wallet_entries_sign_matches_kind/,
  );
  await assert.rejects(
    db.query(`INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind) VALUES ($1, 0, 'admin')`, [
      shopB,
    ]),
    /shop_papic_wallet_entries_delta_nonzero/,
  );
  await assert.rejects(
    db.query(`INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta) VALUES ($1, 5)`, [shopB]),
    /null value in column "kind"/,
  );
});

test('5 · a refund takes it back once — below zero if spent — and every spend is then refused', async () => {
  const user = await newUser('shop-c-wallet@test.test', 'vendor');
  const shop = await shopOf(user, 'Wallet Shop C');
  const o = await packOrder(user, shop);
  await landPack(shop, o);
  assert.equal((await spend(shop, PACK - 10, 'portfolio:big')).status, 'ok');
  const reverse = () =>
    db.query(
      `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind, order_id)
       VALUES ($1, $2, 'reversal', $3)`,
      [shop, -PACK, o],
    );
  await reverse();
  await assert.rejects(reverse(), /shop_papic_wallet_entries_order_kind_unique|duplicate key/);
  assert.equal(await balance(shop), 10 - PACK, 'the sum must include the reversal, below zero');
  assert.equal((await spend(shop, 1, 'portfolio:after-refund')).status, 'insufficient');
});

test('4 · 🚨 RLS: a shop reads only its own wallet; nobody but the server writes or spends', async () => {
  const countAs = async (uid: string, shop: string): Promise<number> => {
    await setAuthUid(db, uid);
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
      [shop],
    );
    return Number(r.rows[0]!.n);
  };
  const balanceAs = async (uid: string, shop: string): Promise<number> => {
    await setAuthUid(db, uid);
    const r = await db.query<{ n: number }>(`SELECT public.shop_papic_wallet_balance($1) AS n`, [shop]);
    return Number(r.rows[0]!.n);
  };
  const ownerBalance = await balance(shopA);
  const ownerRows = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`,
    [shopA],
  );

  await db.exec(`SET ROLE authenticated`);
  try {
    assert.equal(await countAs(userA, shopA), Number(ownerRows.rows[0]!.n), 'shop A cannot read its own wallet');
    assert.equal(await balanceAs(userA, shopA), ownerBalance, 'shop A reads a different balance than the rows say');
    assert.equal(await countAs(userB, shopA), 0, 'shop B can read shop A’s wallet');
    assert.equal(await countAs(coupleId, shopA), 0, 'a couple can read a shop’s wallet');

    await setAuthUid(db, userA);
    await assert.rejects(
      db.query(
        `INSERT INTO public.shop_papic_wallet_entries (vendor_profile_id, delta, kind) VALUES ($1, 1000, 'admin')`,
        [shopA],
      ),
      /permission denied/,
      'a shop minted its own credits',
    );
    await assert.rejects(
      db.query(`UPDATE public.shop_papic_wallet_entries SET delta = 1000 WHERE vendor_profile_id = $1`, [shopA]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`DELETE FROM public.shop_papic_wallet_entries WHERE vendor_profile_id = $1`, [shopA]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`SELECT public.shop_papic_wallet_spend($1, 1, 'portfolio_spend', 'self-serve')`, [shopA]),
      /permission denied/,
      'a session called the spend door directly — it is service-role only',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }

  await db.exec(`SET ROLE anon`);
  try {
    await assert.rejects(
      db.query(`SELECT COUNT(*) FROM public.shop_papic_wallet_entries`),
      /permission denied/,
      'anon can read the wallet table',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
});
