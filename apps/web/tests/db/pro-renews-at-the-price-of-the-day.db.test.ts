import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/**
 * 💳 A CURRENT PRO SUBSCRIBER MOVES TO THE NEW PRICE AT THE NEXT RENEWAL — READ AT RENEWAL TIME.
 *
 * Owner ruled the change plan §C item 4 on 2026-11-19 ("Yes, all five" — specs DECISION_LOG, "SUPPLIER PLANS §C — FIVE
 * CALLS"): the 4 weeks a Pro shop has already paid for stand; its NEXT renewal is billed at Pro's catalogue price as it
 * is on the day it renews. Nothing renews by itself — a renewal is a new `create_vendor_subscription` — so the rule
 * holds if, and only if, that function reads `vendor_billing_catalog` when it is called and never a price remembered on
 * the shop or its last purchase. No figure is typed here: every price is the catalogue row's.
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

/** A verified shop already ON Pro with a few paid days left — a current subscriber. */
async function currentProShop(): Promise<{ vendorId: string; uid: string }> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`pro-renews-${seq}@test.local`],
  );
  const uid = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, tier_state, tier_expires_at)
     VALUES ($1, 'Pro Renews Test', 'Manila', ARRAY['photography']::text[],
             'verified'::public.vendor_verification_state, NOW(), 'pro'::public.vendor_tier_state, NOW() + interval '3 days')
     RETURNING vendor_profile_id`,
    [uid],
  );
  const vendorId = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [vendorId, uid],
  );
  return { vendorId, uid };
}

async function proPrice(): Promise<number> {
  const r = await db.query<{ price_php: string }>(
    `SELECT price_php FROM public.vendor_billing_catalog WHERE sku_code = 'pro_vendor_monthly' AND is_active = TRUE`,
  );
  assert.ok(r.rows[0], 'Pro has no active 4-week row in the replayed catalogue — the test would prove nothing');
  return Number(r.rows[0]!.price_php);
}

async function renew(uid: string): Promise<{ status: string; amount_php: string; purchase_id: string }> {
  await signIn(uid);
  const r = await db.query<{ status: string; amount_php: string; purchase_id: string }>(
    `SELECT status, amount_php, purchase_id FROM public.create_vendor_subscription('pro_vendor_monthly', NULL)`,
  );
  await signIn(null);
  return r.rows[0]!;
}

test('a current Pro subscriber renewing is billed the catalogue price of the day it renews', async () => {
  const today = await proPrice();
  const { vendorId, uid } = await currentProShop();
  const first = await renew(uid);
  assert.equal(first.status, 'pending_payment');
  assert.equal(Number(first.amount_php), today, 'the renewal is not billed at the catalogue price');
  // The days already paid stand: choosing the renewal does not move the shop's tier or its end date.
  const shop = await db.query<{ tier_state: string; left: string }>(
    `SELECT tier_state::text AS tier_state, EXTRACT(EPOCH FROM (tier_expires_at - NOW())) / 86400 AS left
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  assert.equal(shop.rows[0]!.tier_state, 'pro');
  assert.ok(Number(shop.rows[0]!.left) > 2, 'choosing the renewal cut short the days already paid for');

  // The catalogue moves (an admin edit) — the NEXT renewal reads the new row, not the one the shop last saw.
  await db.query(`ALTER TABLE public.vendor_billing_catalog DISABLE TRIGGER USER`);
  try {
    await db.query(`UPDATE public.vendor_billing_catalog SET price_php = price_php + 1 WHERE sku_code = 'pro_vendor_monthly'`);
  } finally {
    await db.query(`ALTER TABLE public.vendor_billing_catalog ENABLE TRIGGER USER`);
  }
  try {
    const moved = await proPrice();
    const { uid: uid2 } = await currentProShop();
    const second = await renew(uid2);
    assert.equal(Number(second.amount_php), moved, 'the renewal used a remembered price, not the catalogue on the day');
  } finally {
    await db.query(`ALTER TABLE public.vendor_billing_catalog DISABLE TRIGGER USER`);
    await db.query(`UPDATE public.vendor_billing_catalog SET price_php = price_php - 1 WHERE sku_code = 'pro_vendor_monthly'`);
    await db.query(`ALTER TABLE public.vendor_billing_catalog ENABLE TRIGGER USER`);
  }
});

test('Pro\'s year stays ten 4-week cycles (§C item 2: ₱39,900 by the 10× rule)', async () => {
  const r = await db.query<{ mo: string; yr: string }>(
    `SELECT (SELECT price_php FROM public.vendor_billing_catalog WHERE sku_code = 'pro_vendor_monthly') AS mo,
            (SELECT price_php FROM public.vendor_billing_catalog WHERE sku_code = 'pro_vendor_annual') AS yr`,
  );
  assert.equal(Number(r.rows[0]!.yr), Number(r.rows[0]!.mo) * 10, 'Pro\'s yearly row is not 10× its 4-week row');
});
