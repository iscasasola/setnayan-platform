/**
 * THE SUPPLIER'S CREDITS ARE THE SUPPLIER'S — the couple's pool cannot see
 * them, and they cannot see the couple's pool.
 *
 * Owner 2026-09-05, asked whether the host-visible lane survives on the new
 * credits: *"base it all from the supplier's shots per event not from what the
 * host gives them."* So there are TWO ledgers on one event and they must never
 * mix: `papic_event_point_grants` is what the host bought or was granted for
 * guests' cameras; `vendor_papic_portfolio_credit_grants` is what a supplier
 * earned (5% of their booking fee) or bought (₱500/25) for their own shots.
 * A grant landing in the wrong one would either hand a couple credits they
 * did not buy or hand a supplier the couple's — and both would render as an
 * ordinary balance with nothing to notice.
 *
 * Also pinned here, because they are structural and a unit test cannot see
 * them: the ledger is append-only-positive, every writer names its source,
 * fulfilment is idempotent per (order, source), a supplier reads only their
 * own rows, and the pack SKU exists in the price table at the owner's price.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let coupleId: string;
let vendorUserA: string;
let vendorUserB: string;
let vendorA: string;
let vendorB: string;
let eventId: string;

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function newVendor(userId: string, name: string): Promise<string> {
  // on_auth_user_created seeds a vendor_profiles row for an account_type=vendor
  // user (UNIQUE on user_id), so read it back rather than inserting a twin.
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    await db.query(
      `UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`,
      [existing.rows[0].vendor_profile_id, name],
    );
    return existing.rows[0].vendor_profile_id;
  }
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function newOrder(userId: string, vendorProfileId: string | null, serviceKey: string): Promise<string> {
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, $4, 'test order', 500, 'submitted', $5)
     RETURNING order_id`,
    [eventId, userId, vendorProfileId, serviceKey, `T${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)}`],
  );
  return r.rows[0]!.order_id;
}

async function poolTotal(): Promise<number> {
  const r = await db.query<{ total_points: number | null; granted_points: number | null }>(
    `SELECT total_points, granted_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  return Number(r.rows[0]?.granted_points ?? 0);
}

async function supplierCredits(vendorProfileId: string): Promise<number> {
  const r = await db.query<{ n: string }>(
    `SELECT COALESCE(SUM(credits), 0)::text AS n
       FROM public.vendor_papic_portfolio_credit_grants
      WHERE vendor_profile_id = $1 AND event_id = $2`,
    [vendorProfileId, eventId],
  );
  return Number(r.rows[0]!.n);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);

  coupleId = await newUser('couple-vpc@test.test', 'customer');
  vendorUserA = await newUser('vendor-a-vpc@test.test', 'vendor');
  vendorUserB = await newUser('vendor-b-vpc@test.test', 'vendor');
  vendorA = await newVendor(vendorUserA, 'Supplier A Studio');
  vendorB = await newVendor(vendorUserB, 'Supplier B Studio');

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Vendor credits event', 'celebration') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the ledger + SKU (no unapplied files)', () => {
  assert.equal(replay.applied, replay.total, 'all migrations accounted for');
});

test('the pack SKU is in the price table, active, at the owner’s ₱500, per event', async () => {
  const r = await db.query<{ price_php: string; offering_type: string; is_active: boolean; title: string }>(
    `SELECT price_php::text, offering_type, is_active, title
       FROM public.vendor_billing_catalog WHERE sku_code = 'vendor_papic_portfolio_pack'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_papic_portfolio_pack is not seeded');
  const row = r.rows[0]!;
  assert.equal(Number(row.price_php), 500, 'owner: "they pay 500 pesos for 25 papic credits"');
  assert.equal(row.offering_type, 'vendor_addon_per_event');
  assert.equal(row.is_active, true);
  assert.match(row.title, /25/, 'the title tells the buyer how many credits');
});

test('🚨 a supplier grant is INVISIBLE to the couple’s pool — and the pool to the supplier', async () => {
  const poolBefore = await poolTotal();
  const grantsBefore = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.papic_event_point_grants WHERE event_id = $1`,
    [eventId],
  );

  // 5% of a ₱20,000 fee = the 1,000 cap — the biggest grant the rule can make.
  await db.query(
    `INSERT INTO public.vendor_papic_portfolio_credit_grants
       (vendor_profile_id, event_id, credits, source, note)
     VALUES ($1, $2, 1000, 'booking_fee', '5% of booking fee ₱20000')`,
    [vendorA, eventId],
  );

  assert.equal(await supplierCredits(vendorA), 1000, 'the supplier holds their credits');
  assert.equal(
    await poolTotal(),
    poolBefore,
    'the couple’s pool grew from a SUPPLIER grant — the two ledgers are mixed',
  );
  const grantsAfter = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM public.papic_event_point_grants WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(grantsAfter.rows[0]!.n, grantsBefore.rows[0]!.n, 'a row reached papic_event_point_grants');

  // …and the other direction: a host-side grant does not become supplier credit.
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, 500, 'admin', 'host-side grant, must stay host-side')`,
    [eventId],
  );
  assert.equal(await supplierCredits(vendorA), 1000, 'a host-side grant leaked into the supplier’s ledger');
  assert.equal(await supplierCredits(vendorB), 0, 'the other supplier on the same event holds nothing');
});

test('append-only and always positive: a ₱0 grant (“no floor”) has no row, a negative one is refused', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_credit_grants
         (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, 0, 'booking_fee')`,
      [vendorA, eventId],
    ),
    /vendor_papic_portfolio_credit_grants_credits_positive/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_credit_grants
         (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, -25, 'pack_order')`,
      [vendorA, eventId],
    ),
    /vendor_papic_portfolio_credit_grants_credits_positive/,
  );
});

test('every writer names its source — there is no default to fall back on', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_credit_grants
         (vendor_profile_id, event_id, credits) VALUES ($1, $2, 25)`,
      [vendorA, eventId],
    ),
    /null value in column "source"/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_credit_grants
         (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, 25, 'host_gift')`,
      [vendorA, eventId],
    ),
    /vendor_papic_portfolio_credit_grants_source_allowed/,
  );
});

test('🚨 fulfilment is idempotent per (order, source): a re-approved pack lands 25, not 50', async () => {
  const orderId = await newOrder(vendorUserA, vendorA, 'vendor_papic_portfolio_pack');
  const before = await supplierCredits(vendorA);

  const insertPack = () =>
    db.query(
      `INSERT INTO public.vendor_papic_portfolio_credit_grants
         (vendor_profile_id, event_id, credits, source, order_id)
       VALUES ($1, $2, 25, 'pack_order', $3)`,
      [vendorA, eventId, orderId],
    );
  await insertPack();
  await assert.rejects(insertPack(), /vendor_papic_portfolio_credit_grants_order_source_unique|duplicate key/);
  assert.equal(await supplierCredits(vendorA), before + 25);

  // A second, DIFFERENT pack order for the same event stacks — packs are repeatable.
  const secondOrder = await newOrder(vendorUserA, vendorA, 'vendor_papic_portfolio_pack');
  await db.query(
    `INSERT INTO public.vendor_papic_portfolio_credit_grants
       (vendor_profile_id, event_id, credits, source, order_id)
     VALUES ($1, $2, 25, 'pack_order', $3)`,
    [vendorA, eventId, secondOrder],
  );
  assert.equal(await supplierCredits(vendorA), before + 50, 'a second pack for the same event must stack');

  // Admin / comp grants carry no order and are not constrained by the index.
  await db.query(
    `INSERT INTO public.vendor_papic_portfolio_credit_grants
       (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, 5, 'comp')`,
    [vendorA, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_papic_portfolio_credit_grants
       (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, 5, 'comp')`,
    [vendorA, eventId],
  );
  assert.equal(await supplierCredits(vendorA), before + 60);
});

test('RLS: a supplier reads only their OWN ledger; the couple reads none of it; nobody but the server writes', async () => {
  const countAs = async (uid: string): Promise<number> => {
    await setAuthUid(db, uid);
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.vendor_papic_portfolio_credit_grants WHERE event_id = $1`,
      [eventId],
    );
    return Number(r.rows[0]!.n);
  };

  await db.exec(`SET ROLE authenticated`);
  try {
    // Supplier A sees their rows.
    assert.ok((await countAs(vendorUserA)) > 0, 'supplier A cannot see their own credits — a balance nobody can read');

    // Supplier B, on the same event, sees NONE of A's rows.
    assert.equal(await countAs(vendorUserB), 0, 'supplier B can read supplier A’s ledger');

    // The couple (host) sees none of it — these are not the host's credits.
    assert.equal(await countAs(coupleId), 0, 'the host can read a supplier’s private credit ledger');

    // No session may write — grants are service-role only (grant REVOKED, no policy).
    await setAuthUid(db, vendorUserA);
    const write = await db
      .query(
        `INSERT INTO public.vendor_papic_portfolio_credit_grants
           (vendor_profile_id, event_id, credits, source) VALUES ($1, $2, 1000, 'comp')`,
        [vendorA, eventId],
      )
      .then(() => 'inserted')
      .catch((e: Error) => e.message);
    assert.notEqual(write, 'inserted', 'a supplier granted themselves credits from a session');
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
  }
});

test('anon holds no grant on the ledger at all', async () => {
  const r = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_papic_portfolio_credit_grants'
        AND grantee = 'anon'`,
  );
  assert.deepEqual(r.rows, [], `anon can ${r.rows.map((x) => x.privilege_type).join(', ')} the supplier ledger`);
  const auth = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_papic_portfolio_credit_grants'
        AND grantee = 'authenticated'`,
  );
  // The replay does not reproduce Supabase's default table grants, so what is
  // asserted is the half a migration controls: no WRITE capability may remain
  // for a session role, whatever the read grant happens to be.
  const writes = auth.rows
    .map((x) => x.privilege_type)
    .filter((p) => p !== 'SELECT')
    .sort();
  assert.deepEqual(writes, [], `authenticated can ${writes.join(', ')} the supplier ledger`);
});
