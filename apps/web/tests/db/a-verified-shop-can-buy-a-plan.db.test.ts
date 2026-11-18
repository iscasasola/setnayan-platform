import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/**
 * 💳 A VERIFIED SHOP CAN BUY A PLAN, END TO END (plan-purchase audit, 2026-11-16 · build-sessions/PLAN-PURCHASE-TRACE.md).
 *
 * The supplier phase goal is "a shop invited by QR can do its basic functions on live without failure", and step 5 —
 * Get a plan — had never been walked past the Verified gate. Each rule here lives in SQL with more than one caller
 * (the Plan screen, /admin/subscriptions, /admin/payments' activation hook), so the walk is proven at the database:
 *
 *   plan chosen (create_vendor_subscription, as the shop's own signed-in owner)
 *     → a pending_payment row priced from vendor_billing_catalog, never from the caller
 *   paid (approve_vendor_subscription, as a signed-in console admin)
 *     → the row is `paid` and the shop's tier_state / tier_expires_at are the plan's
 *   active → and when the paid days end, sweep_vendor_tier_expiry writes the shop back to Verified.
 *
 * Plus the two refusals an unverified shop and a zero-row reject must keep.
 */

let replay: ReplayResult;
let db: ReplayResult['db'];
let seq = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
});

async function signIn(uid: string | null): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [uid ? 'authenticated' : '']);
}

/** A shop with its owner on the team (admin of the store), on `verification`, sitting on Free · Verified. */
async function newShop(verification: 'verified' | 'unverified'): Promise<{ vendorId: string; uid: string }> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    // 'customer', so the signup trigger does not mint a second vendor_profiles row (UNIQUE on user_id).
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`buy-a-plan-${seq}@test.local`],
  );
  const uid = u.rows[0]!.id;
  const tier = verification === 'verified' ? 'verified' : 'free';
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, tier_state)
     VALUES ($1, 'Buy A Plan Test', 'Manila', ARRAY['photography']::text[],
             $2::public.vendor_verification_state, ${verification === 'verified' ? 'NOW()' : 'NULL'},
             $3::public.vendor_tier_state)
     RETURNING vendor_profile_id`,
    [uid, verification, tier],
  );
  const vendorId = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [vendorId, uid],
  );
  return { vendorId, uid };
}

async function newConsoleAdmin(): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','admin')) RETURNING id`,
    [`buy-a-plan-admin-${seq}@test.local`],
  );
  // is_console_admin() reads public.users, not the auth metadata.
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [u.rows[0]!.id]);
  return u.rows[0]!.id;
}

async function catalogPrice(sku: string): Promise<number> {
  const r = await db.query<{ price_php: string }>(
    `SELECT price_php FROM public.vendor_billing_catalog
      WHERE sku_code = $1 AND is_active = TRUE
        AND offering_type IN ('subscription_monthly','subscription_annual')`,
    [sku],
  );
  assert.ok(r.rows[0], `${sku} is not an active plan in the replayed catalog — the walk would prove nothing`);
  return Number(r.rows[0]!.price_php);
}

type PlanRow = { purchase_id: string; status: string; amount_php: string; reference_code: string; tier: string };

async function choosePlan(uid: string, sku: string): Promise<PlanRow> {
  await signIn(uid);
  const r = await db.query<PlanRow>(
    `SELECT purchase_id, status, amount_php, reference_code, tier::text AS tier
       FROM public.create_vendor_subscription($1, NULL)`,
    [sku],
  );
  await signIn(null);
  return r.rows[0]!;
}

async function shopPlan(vendorId: string): Promise<{ tier_state: string; days_left: number | null }> {
  const r = await db.query<{ tier_state: string; days_left: string | null }>(
    `SELECT tier_state::text AS tier_state,
            EXTRACT(EPOCH FROM (tier_expires_at - NOW())) / 86400 AS days_left
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  const row = r.rows[0]!;
  return { tier_state: row.tier_state, days_left: row.days_left === null ? null : Number(row.days_left) };
}

for (const [tier, word] of [
  ['solo', 'Plus'],
  ['pro', 'Pro'],
  ['enterprise', 'Ultra'],
] as const) {
  test(`a Verified shop goes ${word}: chosen → paid → active → lapses back to Verified`, async () => {
    const sku = `${tier}_vendor_monthly`;
    const price = await catalogPrice(sku);
    const { vendorId, uid } = await newShop('verified');

    // ── chosen ──
    const order = await choosePlan(uid, sku);
    assert.equal(order.status, 'pending_payment');
    assert.equal(order.tier, tier);
    assert.equal(Number(order.amount_php), price, 'the bill is the catalogue price — nothing else sets it');
    assert.match(order.reference_code, /^SUB-[0-9A-F]{8}$/);
    assert.equal((await shopPlan(vendorId)).tier_state, 'verified', 'nothing switches on before the money is confirmed');

    // ── paid (an admin confirms) ──
    const adminUid = await newConsoleAdmin();
    await signIn(adminUid);
    const res = await db.query<{ r: { paid?: boolean } }>(`SELECT public.approve_vendor_subscription($1) AS r`, [order.purchase_id]);
    await signIn(null);
    assert.equal(res.rows[0]!.r.paid, true);

    // ── active ──
    const st = await db.query<{ status: string }>(`SELECT status FROM public.vendor_subscriptions WHERE purchase_id = $1`, [order.purchase_id]);
    assert.equal(st.rows[0]!.status, 'paid');
    const on = await shopPlan(vendorId);
    assert.equal(on.tier_state, tier, `the shop is on ${word} once it is confirmed`);
    assert.ok(on.days_left !== null && on.days_left > 27.9 && on.days_left <= 28, `a 4-week plan runs 28 days (got ${on.days_left})`);

    // ── the paid days end → the sweep writes the shop back to Verified ──
    await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`, [vendorId]);
    await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [vendorId]);
    assert.equal((await shopPlan(vendorId)).tier_state, 'verified', `an ended ${word} reads Verified, never the paid plan`);
  });
}

test('an unverified shop is refused at the database, and no order is written', async () => {
  const { vendorId, uid } = await newShop('unverified');
  await signIn(uid);
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription('pro_vendor_monthly', NULL)`),
    /NOT_VERIFIED/,
  );
  await signIn(null);
  const n = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.vendor_subscriptions WHERE vendor_id = $1`, [vendorId]);
  assert.equal(n.rows[0]!.n, '0');
});

test('rejecting a plan that is already paid changes nothing and raises nothing — the action must read it back', async () => {
  // This is the database half of app/admin/subscriptions/a-reject-that-changed-nothing-says-so.test.ts: the RPC is a
  // zero-row UPDATE here, so only a read-back can tell the admin (and spare the shop a false "rejected" email).
  const { uid } = await newShop('verified');
  const order = await choosePlan(uid, 'pro_vendor_monthly');
  const adminUid = await newConsoleAdmin();
  await signIn(adminUid);
  await db.query(`SELECT public.approve_vendor_subscription($1)`, [order.purchase_id]);
  await db.query(`SELECT public.reject_vendor_subscription($1, 'late tab')`, [order.purchase_id]);
  await signIn(null);
  const st = await db.query<{ status: string }>(`SELECT status FROM public.vendor_subscriptions WHERE purchase_id = $1`, [order.purchase_id]);
  assert.equal(st.rows[0]!.status, 'paid', 'a reject after a confirm must not undo the paid plan');
});
