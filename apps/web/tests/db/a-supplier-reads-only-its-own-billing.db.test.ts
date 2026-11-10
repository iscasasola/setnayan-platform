/**
 * 🧾 A SUPPLIER READS ONLY ITS OWN BILLING (Build 2 #39 — `lib/supplier-billing.server.ts`, prototype v118).
 *
 * The Billing & receipts page reads four shop tables on the supplier's OWN session (never the service role):
 * `vendor_proposal_shop_gifts` · `shop_gift_stock_entries` · `shop_badge_rewards` · `event_vendor_payments`. Before
 * this lane the first two were read admin-side only (`fetchShopGiftLedger`). What a unit test cannot see:
 *
 *   1 · RLS ALREADY ADMITS THE SHOP'S OWN ROWS — no policy was added (the canonical `current_vendor_profile_ids()` /
 *       `current_vendor_event_vendor_ids()` reads, migrations 20271309169686 · 20271323363853 · 20270315091571). The
 *       SAME selects the reader sends return shop A's gift line, stock row, reward and payment to A's login.
 *   2 · AND NOTHING ELSE — with NO filter at all, A's login reads zero of shop B's rows in all four tables, and B's
 *       login zero of A's; a login with no shop reads none.
 *   3 · THE FILTER IS NOT DECORATION — one login in TWO shops (its own + an admin helper seat) reads both shops' rows through RLS; the reader's
 *       `vendor_profile_id = <active shop>` filter (and, for payments, the active shop's bookings) is what keeps the
 *       page to the shop it is standing in.
 *
 * Sabotage (8 Nov 2026): widening `shop_badge_rewards_vendor_read` to `USING (true)` inside the test → both tests red
 * (the stranger and the other shop read the rewards); removed again.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;
const uniq = () => `bill-${++seq}-${Date.now()}`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id AS v`,
    [`${uniq()}@t.local`],
  );
}

async function newShop(userId: string): Promise<string> {
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, uniq()],
  );
}

/** Everything the billing page lists for one shop: a booking + a logged payment, a quote with a gift line, the gift
 *  given into the event, and a badge reward (through its one door, which also writes the reward's stock row). */
async function seedShop(shop: string): Promise<{ eventId: string; eventVendorId: string; proposalId: string; paymentId: string }> {
  const eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`, [uniq()]);
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1, 'band_dj', 'Billing Shop', 'considering', $2, 50000) RETURNING vendor_id AS v`,
    [eventId, shop],
  );
  const paymentId = await one<string>(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 5000, 'GCash') RETURNING payment_id AS v`,
    [eventId, eventVendorId],
  );
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, total_centavos, valid_until)
     VALUES ($1, $2, 'Quote', 'sent', 5000000, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS v`,
    [shop, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 150, 999, 'Papic 150')`,
    [proposalId, shop],
  );
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', 300, 'bought')`,
    [shop],
  );
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id)
     VALUES ($1, 'papic', -150, 'given', $2, $3)`,
    [shop, eventId, proposalId],
  );
  await db.query(`SELECT public.shop_badge_reward_grant($1, 'verified', 'verified', 'papic', 1, 150, 'Badge reward · test')`, [shop]);
  return { eventId, eventVendorId, proposalId, paymentId };
}

/** The reader's own selects, as SQL (the columns `fetchSupplierBillingMeasured` asks for). */
const READS = {
  vendor_proposal_shop_gifts: `SELECT g.gift_line_id, g.proposal_id, g.title, g.gift_kind, g.srp_php, g.from_badge_reward, g.created_at, p.status, p.event_id
                                 FROM public.vendor_proposal_shop_gifts g LEFT JOIN public.vendor_proposals p USING (proposal_id)`,
  shop_gift_stock_entries: `SELECT event_id, proposal_id, gift_kind FROM public.shop_gift_stock_entries WHERE kind = 'given'`,
  shop_badge_rewards: `SELECT reward_id, reward_key, reward_kind, units, granted_at, revoked_at, used_at, returned_at FROM public.shop_badge_rewards`,
  event_vendor_payments: `SELECT payment_id, vendor_id, event_id, amount_php, paid_at, method, vendor_confirmed_at, payment_refused_at, is_deposit_record
                            FROM public.event_vendor_payments`,
} as const;

async function asUser<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

test('1 + 2 · a shop reads its own billing rows through RLS — and none of another shop’s', async () => {
  const ua = await newUser();
  const ub = await newUser();
  const stranger = await newUser();
  const shopA = await newShop(ua);
  const shopB = await newShop(ub);
  const a = await seedShop(shopA);
  const b = await seedShop(shopB);

  for (const [table, sql] of Object.entries(READS)) {
    const mineA = await asUser(ua, async () => (await db.query<Record<string, unknown>>(sql)).rows);
    const mineB = await asUser(ub, async () => (await db.query<Record<string, unknown>>(sql)).rows);
    const none = await asUser(stranger, async () => (await db.query<Record<string, unknown>>(sql)).rows);
    assert.ok(mineA.length > 0, `A cannot read its own ${table} — the page would say "No … yet" to a shop that has them`);
    assert.ok(mineB.length > 0, `B cannot read its own ${table}`);
    assert.equal(none.length, 0, `a login with no shop reads ${table}`);
    const json = (rows: Record<string, unknown>[]) => JSON.stringify(rows);
    assert.ok(!json(mineA).includes(b.proposalId) && !json(mineA).includes(b.eventId) && !json(mineA).includes(b.paymentId), `A reads B's ${table}`);
    assert.ok(!json(mineB).includes(a.proposalId) && !json(mineB).includes(a.eventId) && !json(mineB).includes(a.paymentId), `B reads A's ${table}`);
  }

  // The vendor_profile_id-scoped tables, counted by shop with no filter but RLS.
  for (const table of ['vendor_proposal_shop_gifts', 'shop_gift_stock_entries', 'shop_badge_rewards'] as const) {
    const bSeenByA = await asUser(ua, () =>
      one<string>(`SELECT COUNT(*)::text AS v FROM public.${table} WHERE vendor_profile_id = $1`, [shopB]),
    );
    assert.equal(Number(bSeenByA), 0, `A reads B's ${table}`);
  }
  const paidA = await asUser(ua, () => one<string>(`SELECT COUNT(*)::text AS v FROM public.event_vendor_payments WHERE payment_id = $1`, [a.paymentId]));
  assert.equal(Number(paidA), 1, 'A cannot read the payment its client logged');
});

test('3 · one login with two shops reads both through RLS — the reader’s shop filter is what scopes the page', async () => {
  // A login owns ONE shop (`vendor_profiles_user_id_key`); the second is a helper seat with admin rank, which
  // `current_vendor_profile_ids()` admits exactly like an owned shop.
  const u = await newUser();
  const shop1 = await newShop(u);
  const shop2 = await newShop(await newUser());
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`, [shop2, u]);
  const s1 = await seedShop(shop1);
  const s2 = await seedShop(shop2);

  const unfiltered = await asUser(u, async () => (await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.shop_badge_rewards`)).rows);
  assert.deepEqual(new Set(unfiltered.map((r) => r.vendor_profile_id)), new Set([shop1, shop2]), 'RLS alone admits both shops');

  const filtered = await asUser(u, async () =>
    (await db.query<{ proposal_id: string }>(`SELECT proposal_id FROM public.vendor_proposal_shop_gifts WHERE vendor_profile_id = $1`, [shop1])).rows,
  );
  assert.deepEqual(filtered.map((r) => r.proposal_id), [s1.proposalId], 'the shop filter keeps the page to the shop it stands in');

  // Payments: RLS admits both shops' bookings; the page keeps only the active shop's booking ids.
  const pays = await asUser(u, async () => (await db.query<{ vendor_id: string }>(READS.event_vendor_payments)).rows);
  assert.deepEqual(new Set(pays.map((p) => p.vendor_id)), new Set([s1.eventVendorId, s2.eventVendorId]));
  const shop1Bookings = new Set(
    (await db.query<{ vendor_id: string }>(`SELECT vendor_id FROM public.event_vendors WHERE marketplace_vendor_id = $1`, [shop1])).rows.map((r) => r.vendor_id),
  );
  assert.deepEqual(pays.filter((p) => shop1Bookings.has(p.vendor_id)).map((p) => p.vendor_id), [s1.eventVendorId]);
});
