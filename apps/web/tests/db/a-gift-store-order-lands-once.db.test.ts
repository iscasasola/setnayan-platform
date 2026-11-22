/**
 * 🛒 A GIFT STORE ORDER LANDS ONCE — every line of it (owner-approved prototype `gifts-interactive` v16, 2026-11-17).
 *
 * Migration `gift_cart_orders_and_the_payment_max`. What a unit test cannot see:
 *
 *   1 · A 3-LINE ORDER DELIVERS ALL 3 — `shop_gift_grant_order_lines` lands one 'bought' row per line (Papic in packs,
 *       an unlock in units, a bundle its whole count), and APPROVING TWICE DELIVERS ONCE (the second call lands 0).
 *   2 · THE MONEY CHECK — lines that do not add up to `orders.requested_total_php`, an order with no lines, and a line
 *       for another shop are all refused, writing nothing.
 *   3 · A REFUND TAKES BACK EACH LINE ONCE — `shop_gift_reverse_order_lines` reverses every landed line exactly once.
 *   4 · THE OLD SINGLE-GIFT PATH STILL WORKS — a plain bought row lands as line 0 and a second one is a 23505, as
 *       `grantShopGiftPurchase` expects; a cart line and the single row never collide.
 *   5 · THE LINE TABLE'S SHAPE — the line total is worked out by the database; a bundle line must name its bundle;
 *       an unlock is one credit; counts and prices are bounded.
 *   6 · RLS — a shop reads only its own lines; no session writes a line or calls either door.
 *   7 · THE MOST IN ONE PAYMENT — `platform_settings.max_payment_php` is seeded 100000 and refuses 0.
 *
 * Sabotage: dropping `ON CONFLICT … DO NOTHING` from the grant turns 1 red (the re-approval raises); dropping the
 * `IS DISTINCT FROM v_total` check turns 2 red (a short order lands).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/** Catalogue codes, one per line (a code beside another code in one array reads as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const PLUS = 'EVENT_PLUS';
const B1K = 'GIFT_BUNDLE_PAPIC_1K';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id AS v`,
    [email],
  );
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

async function order(userId: string, shop: string, totalPhp: number, key = 'vendor_gift__GIFT_CART'): Promise<string> {
  n += 1;
  return one<string>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, $3, 'Gifts for your couples', $4, 'submitted', $5)
     RETURNING order_id AS v`,
    [userId, shop, key, totalPhp, `C${Date.now().toString(36).toUpperCase()}${n}`],
  );
}

type Line = {
  code: string;
  kind: 'papic' | 'event_plus' | 'event_pro' | 'event_ultra';
  bundle: string | null;
  qty: number;
  packsEach: number;
  credits: number;
  unit: number;
};

async function addLines(orderId: string, shop: string, userId: string, lines: Line[]): Promise<void> {
  for (const [i, l] of lines.entries()) {
    await db.query(
      `INSERT INTO public.shop_gift_order_lines
         (order_id, line_no, vendor_profile_id, service_code, gift_kind, bundle_code, quantity, packs_each,
          credits_per_pack, unit_price_php, price_basis, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [orderId, i + 1, shop, l.code, l.kind, l.bundle, l.qty, l.packsEach, l.credits, l.unit, l.bundle ? 'bundle' : 'list', userId],
    );
  }
}

async function grant(orderId: string, actor: string): Promise<{ lines_total: number; lines_landed: number }> {
  const r = await db.query<{ lines_total: number; lines_landed: number }>(
    `SELECT lines_total, lines_landed FROM public.shop_gift_grant_order_lines($1, $2)`,
    [orderId, actor],
  );
  return { lines_total: Number(r.rows[0]!.lines_total), lines_landed: Number(r.rows[0]!.lines_landed) };
}

async function reverse(orderId: string, actor: string): Promise<number> {
  return Number(await one<number>(`SELECT public.shop_gift_reverse_order_lines($1, $2) AS v`, [orderId, actor]));
}

async function entries(orderId: string): Promise<Array<{ kind: string; line: number; delta: number; pack_code: string | null; packs: number | null; gift_kind: string }>> {
  const r = await db.query<{ kind: string; line: number; delta: number; pack_code: string | null; packs: number | null; gift_kind: string }>(
    `SELECT kind, purchase_line_no AS line, delta, pack_code, packs, gift_kind
       FROM public.shop_gift_stock_entries WHERE order_id = $1 ORDER BY kind, purchase_line_no`,
    [orderId],
  );
  return r.rows.map((x) => ({ ...x, line: Number(x.line), delta: Number(x.delta), packs: x.packs === null ? null : Number(x.packs) }));
}

async function packStatus(shop: string, code: string): Promise<number> {
  const r = await db.query<{ balance: number }>(
    `SELECT balance FROM public.shop_gift_pack_stock_status($1, NULL) WHERE pack_code = $2`,
    [shop, code],
  );
  return Number(r.rows[0]?.balance ?? 0);
}

async function unitStatus(shop: string, kind: string): Promise<number> {
  const r = await db.query<{ balance: number }>(
    `SELECT balance FROM public.shop_gift_stock_status($1, NULL) WHERE gift_kind = $2`,
    [shop, kind],
  );
  return Number(r.rows[0]?.balance ?? 0);
}

/** A 3-line cart: 2 × Papic 150 (₱99), 1 × Papic 1000 10 + 1 (₱4,990), 1 × Event Plus (₱2,990) = ₱8,178. */
const THREE: Line[] = [
  { code: P150, kind: 'papic', bundle: null, qty: 2, packsEach: 1, credits: 150, unit: 99 },
  { code: P1K, kind: 'papic', bundle: B1K, qty: 1, packsEach: 11, credits: 1000, unit: 4990 },
  { code: PLUS, kind: 'event_plus', bundle: null, qty: 1, packsEach: 1, credits: 1, unit: 2990 },
];
const THREE_TOTAL = 2 * 99 + 4990 + 2990;

let userA: string;
let userB: string;
let shopA: string;
let shopB: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  userA = await newUser('store-a@test.test');
  userB = await newUser('store-b@test.test');
  shopA = await shopOf(userA, 'Store Shop A');
  shopB = await shopOf(userB, 'Store Shop B');
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the gift store', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · 🚨 a 3-line order delivers all 3, and approving twice delivers once', async () => {
  const o = await order(userA, shopA, THREE_TOTAL);
  await addLines(o, shopA, userA, THREE);
  // The database works the line totals out; they add up to what the order charged.
  assert.equal(
    Number(await one<string>(`SELECT sum(line_total_php)::text AS v FROM public.shop_gift_order_lines WHERE order_id = $1`, [o])),
    THREE_TOTAL,
  );

  assert.deepEqual(await grant(o, userA), { lines_total: 3, lines_landed: 3 });
  const landed = await entries(o);
  assert.deepEqual(
    landed.map((e) => [e.kind, e.line, e.gift_kind, e.delta, e.pack_code, e.packs]),
    [
      ['bought', 1, 'papic', 300, P150, 2],
      ['bought', 2, 'papic', 11_000, P1K, 11],
      ['bought', 3, 'event_plus', 1, null, null],
    ],
  );
  assert.equal(await packStatus(shopA, P150), 2);
  assert.equal(await packStatus(shopA, P1K), 11, 'a 10 + 1 bundle lands its whole count');
  assert.equal(await unitStatus(shopA, 'event_plus'), 1);

  // A second approval (a double click, a repair sweep) lands nothing more.
  assert.deepEqual(await grant(o, userA), { lines_total: 3, lines_landed: 0 });
  assert.equal((await entries(o)).length, 3, 'approving twice delivered twice');
  assert.equal(await packStatus(shopA, P1K), 11);
});

test('2 · 🚨 the money check: lines that do not add up, no lines, or another shop’s line — refused, nothing written', async () => {
  const short = await order(userA, shopA, THREE_TOTAL - 1);
  await addLines(short, shopA, userA, THREE);
  await assert.rejects(grant(short, userA), /lines add up to/);
  assert.equal((await entries(short)).length, 0, 'a mismatched order landed stock');

  const empty = await order(userA, shopA, 99);
  await assert.rejects(grant(empty, userA), /has no lines/);

  const mixed = await order(userA, shopA, 99);
  await addLines(mixed, shopB, userA, [THREE[0]!].map((l) => ({ ...l, qty: 1 })));
  await assert.rejects(grant(mixed, userA), /another shop/);
  assert.equal((await entries(mixed)).length, 0);

  await assert.rejects(grant('00000000-0000-0000-0000-000000000000', userA), /not found/);
});

test('3 · a refund takes back each landed line once', async () => {
  const o = await order(userB, shopB, THREE_TOTAL);
  await addLines(o, shopB, userB, THREE);
  await grant(o, userB);
  assert.equal(await reverse(o, userB), 3);
  assert.equal(await reverse(o, userB), 0, 'a second refund took back twice');
  assert.equal(await packStatus(shopB, P150), 0);
  assert.equal(await packStatus(shopB, P1K), 0);
  assert.equal(await unitStatus(shopB, 'event_plus'), 0);
  const rows = await entries(o);
  assert.equal(rows.filter((e) => e.kind === 'reversal').length, 3);
});

test('4 · the old single-gift path still lands as line 0, once', async () => {
  const o = await order(userA, shopA, 499, 'vendor_gift__PAPIC_GUEST_1K');
  const single = () =>
    db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, order_id, pack_code, packs)
       VALUES ($1, 'papic', 1000, 'bought', $2, $3, 1)`,
      [shopA, o, P1K],
    );
  await single();
  await assert.rejects(single(), (e: { code?: string }) => e.code === '23505', 'a second single landed');
  assert.deepEqual((await entries(o)).map((e) => e.line), [0]);
  // A reversal of the single path is line 0 too, once.
  const back = () =>
    db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, order_id, pack_code, packs)
       VALUES ($1, 'papic', -1000, 'reversal', $2, $3, -1)`,
      [shopA, o, P1K],
    );
  await back();
  await assert.rejects(back(), (e: { code?: string }) => e.code === '23505');
  // The store's reverse door never touches a line-0 (single) row.
  assert.equal(await reverse(o, userA), 0);
});

test('5 · the line table refuses a malformed line', async () => {
  const o = await order(userA, shopA, 99);
  const bad: Array<[string, Partial<Line> & { basis?: string }]> = [
    ['bundle without its code', { bundle: null, packsEach: 11, basis: 'bundle' }],
    ['a list line with packs_each > 1', { bundle: null, packsEach: 11, basis: 'list' }],
    ['an unlock worth 2 credits', { kind: 'event_plus', code: PLUS, credits: 2 }],
    ['quantity 0', { qty: 0 }],
    ['quantity 101', { qty: 101 }],
    ['a free line', { unit: 0 }],
    ['a bad bundle code', { bundle: 'NOT_A_BUNDLE', basis: 'bundle' }],
  ];
  for (const [why, over] of bad) {
    const l = { ...THREE[0]!, qty: 1, ...over };
    await assert.rejects(
      db.query(
        `INSERT INTO public.shop_gift_order_lines
           (order_id, line_no, vendor_profile_id, service_code, gift_kind, bundle_code, quantity, packs_each,
            credits_per_pack, unit_price_php, price_basis)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [o, shopA, l.code, l.kind, l.bundle, l.qty, l.packsEach, l.credits, l.unit, over.basis ?? (l.bundle ? 'bundle' : 'list')],
      ),
      /violates check constraint/,
      `accepted ${why}`,
    );
  }
  // The total is the database's, never written.
  await assert.rejects(
    db.query(
      `INSERT INTO public.shop_gift_order_lines
         (order_id, line_no, vendor_profile_id, service_code, gift_kind, quantity, credits_per_pack, unit_price_php, price_basis, line_total_php)
       VALUES ($1, 1, $2, $3, 'papic', 1, 150, 99, 'list', 1)`,
      [o, shopA, P150],
    ),
    /generated column|cannot insert/i,
  );
  // One line number per order.
  await addLines(o, shopA, userA, [{ ...THREE[0]!, qty: 1 }]);
  await assert.rejects(addLines(o, shopA, userA, [{ ...THREE[0]!, qty: 1 }]), /duplicate key/);
});

test('6 · 🚨 RLS: a shop reads only its own lines; no session writes a line or calls either door', async () => {
  const o = await order(userA, shopA, THREE_TOTAL);
  await addLines(o, shopA, userA, THREE);
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, userA);
    assert.equal(Number(await one<string>(`SELECT count(*)::text AS v FROM public.shop_gift_order_lines WHERE order_id = $1`, [o])), 3);
    await setAuthUid(db, userB);
    assert.equal(
      Number(await one<string>(`SELECT count(*)::text AS v FROM public.shop_gift_order_lines WHERE order_id = $1`, [o])),
      0,
      'shop B reads shop A’s order lines',
    );
    await setAuthUid(db, userA);
    await assert.rejects(addLines(o, shopA, userA, [{ ...THREE[0]!, qty: 9, unit: 1 }]), /permission denied/, 'a shop wrote its own order line');
    await assert.rejects(
      db.query(`UPDATE public.shop_gift_order_lines SET unit_price_php = 1 WHERE order_id = $1`, [o]),
      /permission denied/,
      'a shop repriced its own order',
    );
    await assert.rejects(grant(o, userA), /permission denied/, 'a session landed its own order');
    await assert.rejects(reverse(o, userA), /permission denied/, 'a session called the reverse door');
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
  for (const role of ['anon', 'authenticated']) {
    for (const fn of ['shop_gift_grant_order_lines(uuid, uuid)', 'shop_gift_reverse_order_lines(uuid, uuid)']) {
      assert.equal(
        await one<boolean>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS v`, [role, `public.${fn}`]),
        false,
        `${role} may call ${fn}`,
      );
    }
  }
});

test('7 · the most in one payment is a setting, seeded 100000, never 0', async () => {
  assert.equal(Number(await one<string>(`SELECT max_payment_php::text AS v FROM public.platform_settings LIMIT 1`)), 100_000);
  await assert.rejects(db.query(`UPDATE public.platform_settings SET max_payment_php = 0`), /platform_settings_max_payment_php_positive/);
});
