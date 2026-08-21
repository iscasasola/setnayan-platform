/**
 * APPROVING A SHOP'S PLAN PAYMENT MUST ACTUALLY SWITCH THE PLAN ON.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The activation hook added with the ONE payment page (2026-08-21) called
 * `approve_vendor_subscription` through `ctx.admin` — the SERVICE-ROLE client.
 * That client carries no user, so `auth.uid()` is NULL, so `is_console_admin()`
 * is false, so the function RAISES `FORBIDDEN: admin only` before touching a
 * row. The dispatcher catches and logs. Net effect: the admin approves the
 * payment, the shop is told "your order is fully paid", and their plan stays
 * off — the exact harm the hook's own comment said it prevented.
 *
 * 🔑 THE GUARD THAT SHIPPED WITH IT WAS DECORATION. It counted occurrences of
 * `assertOrderOwnsVendorTarget(` and string-matched `rpc('approve_vendor_
 * subscription'` in the source. Both were present and correct. A source scan
 * can prove a call is WRITTEN; only calling the function proves it can SUCCEED.
 *
 * So this file CALLS IT, twice, from the two identities that matter:
 *   • with no `auth.uid()` — the service-role shape — it must REFUSE.
 *     (That refusal is the whole reason the hook needs the admin's own client;
 *      if this assertion ever goes green-by-permission, the ceiling moved and
 *      somebody should know.)
 *   • as a real console admin — it must flip the purchase to paid.
 */

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function newUser(email: string, kind: 'admin' | 'vendor'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, kind === 'admin' ? 'admin' : 'vendor'],
  );
  const uid = u.rows[0]!.id;
  if (kind === 'admin') {
    // is_console_admin() reads public.users, not the auth metadata.
    await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [uid]);
  }
  return uid;
}

/** A verified shop with a plan purchase sitting in pending_payment. */
async function newPendingPurchase(label: string): Promise<{ purchaseId: string }> {
  const uid = await newUser(`shop-${label}@plan.test`, 'vendor');
  // A vendor signup already gets a profile row from the account trigger, and
  // vendor_profiles is UNIQUE on user_id — so adopt the existing row rather
  // than inserting a second one.
  await db.query(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Banawe Blooms', 'Manila', ARRAY['florist']::text[], 'verified', NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET verification_state = 'verified', last_verified_at = NOW()`,
    [uid],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [uid],
  );
  const p = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions
       (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code,
        period_days, status, holder_user_id)
     VALUES ($1, 'pro_vendor_monthly', 'pro', 'monthly', 2500, $2, 28,
             'pending_payment', $3)
     RETURNING purchase_id`,
    [v.rows[0]!.vendor_profile_id, `SUB-${label.toUpperCase().padEnd(8, 'X').slice(0, 8)}`, uid],
  );
  return { purchaseId: p.rows[0]!.purchase_id };
}

async function statusOf(purchaseId: string): Promise<string> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [purchaseId],
  );
  return r.rows[0]!.status;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

test('with no signed-in admin — the service-role shape — the plan RPC REFUSES', async () => {
  const { purchaseId } = await newPendingPurchase('refuse');

  await setAuthUid(db, null);
  await assert.rejects(
    () => db.query(`SELECT public.approve_vendor_subscription($1)`, [purchaseId]),
    /FORBIDDEN/i,
    'a caller with no auth.uid() must not be able to activate a plan',
  );

  // And nothing moved — the refusal is before the write, not after it.
  assert.equal(
    await statusOf(purchaseId),
    'pending_payment',
    'a refused call must leave the purchase exactly where it was',
  );
});

test('as the approving admin, the same call switches the plan on', async () => {
  const { purchaseId } = await newPendingPurchase('accept');
  const adminUid = await newUser('admin@plan.test', 'admin');

  await setAuthUid(db, adminUid);
  await db.query(`SELECT public.approve_vendor_subscription($1)`, [purchaseId]);

  assert.equal(
    await statusOf(purchaseId),
    'paid',
    'the admin’s own session must be able to activate the plan it just took money for',
  );
});

test('confirming twice is safe — the second answer is “already”, not a second period', async () => {
  const { purchaseId } = await newPendingPurchase('twice');
  const adminUid = await newUser('admin2@plan.test', 'admin');
  await setAuthUid(db, adminUid);

  const first = await db.query<{ approve_vendor_subscription: unknown }>(
    `SELECT public.approve_vendor_subscription($1)`,
    [purchaseId],
  );
  const second = await db.query<{ approve_vendor_subscription: unknown }>(
    `SELECT public.approve_vendor_subscription($1)`,
    [purchaseId],
  );

  // The admin can approve at /admin/payments AND /admin/subscriptions; both
  // land on this function, so the second one must not extend the period again.
  assert.ok(JSON.stringify(first.rows[0]).includes('paid'));
  assert.ok(
    JSON.stringify(second.rows[0]).includes('already'),
    'a re-confirm must answer "already", so approving in both places is harmless',
  );
  assert.equal(await statusOf(purchaseId), 'paid');
});
