import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/**
 * CHANGING PLANS — up is prorated and immediate, down is deferred and free.
 *
 * Owner, 2026-08-27: *"if the plan is lower (solo) to pro then we prorate. if
 * the original plan is higher pro then downgrade to (solo) then we finish that
 * subscription then the new lower plan start after that pro ends."* Plus: a
 * credit bigger than the bill carries forward until it runs out.
 *
 * 🔑 THE TEST THAT MATTERS MOST IS THE APPLIER ONE. Recording "becomes Solo on
 * 19 Oct" is easy and worth nothing on its own. `sweep_vendor_tier_expiry` — the
 * login-driven lapse sweep — used to do exactly one thing to an expired plan:
 * drop it to verified/free. Without the applier branch, a shop that scheduled
 * AND PAID FOR Solo lands on FREE the day their Pro ends, and nothing anywhere
 * errors. `a paid scheduled plan LANDS at term end, and not on free` is the
 * regression test for that, and it goes red the moment the applier is removed.
 *
 * Tested at the DATABASE because every rule here lives in SQL and has more than
 * one caller: the admin approval, the payment-approval hook and a webhook entry
 * point all reach the same activation function, and a guard written into one of
 * them leaves the others open.
 */

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let seq = 0;

/**
 * Impersonate a signed-in shop owner — the uid, the JWT role claim AND the
 * Postgres role, because the entitlement guard tests `current_user` and not
 * `auth.role()`. (`auth.role()` can never be NULL in this replay, which is why
 * the guard was written against `current_user` in the first place.)
 */
async function asVendorUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asSuperuser(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

/** A verified shop sitting on `tier`, with `expiresSql` as its term end. */
async function newVendor(tier: string, expiresSql: string): Promise<string> {
  seq += 1;
  const u = await db.query<{ id: string }>(
    // 'customer', NOT 'vendor'. The signup trigger MINTS a vendor_profiles row
    // for an account_type of 'vendor', so the explicit insert below then trips
    // the UNIQUE on user_id. The shop this test builds is the one below.
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`plan-change-${seq}@test.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state,
        last_verified_at, tier_state, tier_expires_at)
     VALUES ($1, 'Plan Change Test', 'Manila', ARRAY['photography']::text[],
             'verified', NOW(), $2::public.vendor_tier_state, ${expiresSql})
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, tier],
  );
  return v.rows[0]!.vendor_profile_id;
}

/**
 * A PAID purchase, written directly so a test can set up history without going
 * through the checkout. `expiresSql` is the point the plan was pushed out to,
 * which is what `vendor_unused_plan_value_php` reads the term back from.
 */
async function paidPurchase(
  vendorId: string,
  tier: string,
  amount: number,
  periodDays: number,
  expiresSql: string,
): Promise<string> {
  seq += 1;
  const r = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions
       (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code,
        period_days, status, activated_at, paid_at, expires_at)
     VALUES ($1, $2, $3::public.vendor_tier_state, $4, $5, $6, $7, 'paid',
             NOW(), NOW(), ${expiresSql})
     RETURNING purchase_id`,
    [
      vendorId,
      `${tier}_vendor_${periodDays === 365 ? 'annual' : 'monthly'}`,
      tier,
      periodDays === 365 ? 'annual' : 'monthly',
      amount,
      `SUB-T${seq.toString().padStart(7, '0')}`,
      periodDays,
    ],
  );
  return r.rows[0]!.purchase_id;
}

/** A pending purchase carrying the plan-change fields the checkout would write. */
async function pendingPurchase(
  vendorId: string,
  tier: string,
  opts: {
    kind: string;
    list: number;
    credit: number;
    carry: number;
    periodDays?: number;
  },
): Promise<string> {
  seq += 1;
  const periodDays = opts.periodDays ?? 28;
  const r = await db.query<{ purchase_id: string }>(
    `INSERT INTO public.vendor_subscriptions
       (vendor_id, sku_code, tier, billing_cycle, amount_php, reference_code,
        period_days, status, plan_change_kind, list_price_php,
        credit_applied_php, credit_carry_forward_php)
     VALUES ($1, $2, $3::public.vendor_tier_state, $4, $5, $6, $7,
             'pending_payment', $8, $9, $10, $11)
     RETURNING purchase_id`,
    [
      vendorId,
      `${tier}_vendor_${periodDays === 365 ? 'annual' : 'monthly'}`,
      tier,
      periodDays === 365 ? 'annual' : 'monthly',
      opts.list - opts.credit,
      `SUB-P${seq.toString().padStart(7, '0')}`,
      periodDays,
      opts.kind,
      opts.list,
      opts.credit,
      opts.carry,
    ],
  );
  return r.rows[0]!.purchase_id;
}

async function profile(vendorId: string) {
  const r = await db.query<{
    tier_state: string;
    tier_expires_at: string | null;
    pending_tier: string | null;
    pending_tier_purchase_id: string | null;
    subscription_credit_php: string;
  }>(
    `SELECT tier_state, tier_expires_at, pending_tier, pending_tier_purchase_id,
            subscription_credit_php
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  return r.rows[0]!;
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Direction is decided by the PLAN, never by the amount.
// ───────────────────────────────────────────────────────────────────────────

test('the direction of a move is read off the plan ladder, not off the price', async () => {
  const v = await newVendor('solo', "NOW() + INTERVAL '20 days'");
  const r = await db.query<{ up: string; down: string; same: string }>(
    `SELECT public.vendor_plan_change_kind($1, 'pro')        AS up,
            public.vendor_plan_change_kind($1, 'verified')   AS down,
            public.vendor_plan_change_kind($1, 'solo')       AS same`,
    [v],
  );
  assert.equal(r.rows[0]!.up, 'upgrade');
  assert.equal(r.rows[0]!.down, 'downgrade');
  assert.equal(r.rows[0]!.same, 'renewal');

  // 🔑 The case that makes "by plan, not by price" concrete: an ANNUAL Solo
  // (₱10,400) costs four times a 28-day Pro (₱2,500), and moving to Pro is
  // still an UPGRADE. Anything keying on the amount gets this backwards.
  const annualSolo = await newVendor('solo', "NOW() + INTERVAL '300 days'");
  const k = await db.query<{ kind: string }>(
    `SELECT public.vendor_plan_change_kind($1, 'pro') AS kind`,
    [annualSolo],
  );
  assert.equal(k.rows[0]!.kind, 'upgrade');
});

test('a shop with no live plan is making an ordinary purchase, not a change', async () => {
  const lapsed = await newVendor('pro', "NOW() - INTERVAL '1 day'");
  const never = await newVendor('verified', 'NULL');
  const r = await db.query<{ a: string; b: string }>(
    `SELECT public.vendor_plan_change_kind($1, 'solo') AS a,
            public.vendor_plan_change_kind($2, 'solo') AS b`,
    [lapsed, never],
  );
  assert.equal(r.rows[0]!.a, 'new', 'a lapsed plan must not make the next purchase a downgrade');
  assert.equal(r.rows[0]!.b, 'new');
});

// ───────────────────────────────────────────────────────────────────────────
// 2. The unused value — derived, and never more than was paid.
// ───────────────────────────────────────────────────────────────────────────

test('unused value is the part of each paid term still in the future, and it stacks', async () => {
  const v = await newVendor('solo', "NOW() + INTERVAL '56 days'");
  // Two stacked 28-day ₱1,000 blocks that tile end to end — the exact shape
  // production is in today. The first block is entirely in the future here, so
  // both are worth their full amount.
  await paidPurchase(v, 'solo', 1000, 28, "NOW() + INTERVAL '28 days'");
  await paidPurchase(v, 'solo', 1000, 28, "NOW() + INTERVAL '56 days'");
  const r = await db.query<{ unused: string }>(
    `SELECT public.vendor_unused_plan_value_php($1) AS unused`,
    [v],
  );
  assert.equal(Number(r.rows[0]!.unused), 2000, 'both unspent blocks should be worth their full price');
});

test('a term half spent is worth about half, and a finished term is worth nothing', async () => {
  const v = await newVendor('pro', "NOW() + INTERVAL '14 days'");
  await paidPurchase(v, 'pro', 2500, 28, "NOW() + INTERVAL '14 days'"); // 14 of 28 left
  await paidPurchase(v, 'pro', 2500, 28, "NOW() - INTERVAL '5 days'"); // finished
  const r = await db.query<{ unused: string }>(
    `SELECT public.vendor_unused_plan_value_php($1) AS unused`,
    [v],
  );
  const unused = Number(r.rows[0]!.unused);
  assert.ok(
    Math.abs(unused - 1250) < 1,
    `half a 28-day ₱2,500 term should be about ₱1,250, got ₱${unused}`,
  );
});

test('a term can never give back more money than it took', async () => {
  // The clamp that matters: a purchase whose window has not started yet is
  // worth its full amount and NOT more, however far out its expiry sits.
  const v = await newVendor('solo', "NOW() + INTERVAL '400 days'");
  await paidPurchase(v, 'solo', 1000, 28, "NOW() + INTERVAL '400 days'");
  const r = await db.query<{ unused: string }>(
    `SELECT public.vendor_unused_plan_value_php($1) AS unused`,
    [v],
  );
  assert.equal(Number(r.rows[0]!.unused), 1000);
});

// ───────────────────────────────────────────────────────────────────────────
// 3. An upgrade: today, prorated, fresh term.
// ───────────────────────────────────────────────────────────────────────────

test('an upgrade takes effect TODAY, is charged list minus credit, and starts a fresh term', async () => {
  const v = await newVendor('solo', "NOW() + INTERVAL '28 days'");
  await paidPurchase(v, 'solo', 1000, 28, "NOW() + INTERVAL '28 days'");

  // Pro at ₱2,500 with the whole ₱1,000 Solo block unused → ₱1,500 to pay.
  const p = await pendingPurchase(v, 'pro', {
    kind: 'upgrade',
    list: 2500,
    credit: 1000,
    carry: 0,
  });
  const charged = await db.query<{ amount_php: string }>(
    `SELECT amount_php FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [p],
  );
  assert.equal(Number(charged.rows[0]!.amount_php), 1500, 'the bill is list minus the credit');

  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  const after = await profile(v);

  assert.equal(after.tier_state, 'pro', 'the upgrade should be live today');

  // 🔑 A FRESH TERM, NOT A STACKED ONE. The old plan's remaining days were just
  // handed back as money; keeping them as well would pay the shop twice for the
  // same days. ~28 days out, NOT ~56.
  const days =
    (new Date(after.tier_expires_at!).getTime() - Date.now()) / 86_400_000;
  assert.ok(
    days > 27 && days < 29,
    `an upgrade should start a fresh 28-day term, got ${days.toFixed(1)} days`,
  );
});

test('a credit BIGGER than the bill carries forward instead of being lost or refunded', async () => {
  const v = await newVendor('solo', "NOW() + INTERVAL '300 days'");
  // An annual Solo with ₱9,000 unused, upgrading to a ₱2,500 28-day Pro.
  const p = await pendingPurchase(v, 'pro', {
    kind: 'upgrade',
    list: 2500,
    credit: 2500, // capped at the bill
    carry: 6500, // 9,000 − 2,500 survives
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  const after = await profile(v);

  assert.equal(Number(after.subscription_credit_php), 6500, 'the excess must be kept, not dropped');

  // And it is spendable: the next bill draws it down rather than starting over.
  const p2 = await pendingPurchase(v, 'pro', {
    kind: 'renewal',
    list: 2500,
    credit: 2500,
    carry: 4000,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p2]);
  assert.equal(
    Number((await profile(v)).subscription_credit_php),
    4000,
    'the carried credit should be drawn down by the next charge',
  );
});

test('activation is a plain assignment, so a replayed approval cannot double-count', async () => {
  const v = await newVendor('solo', "NOW() + INTERVAL '28 days'");
  const p = await pendingPurchase(v, 'pro', {
    kind: 'upgrade',
    list: 2500,
    credit: 2500,
    carry: 3000,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  assert.equal(Number((await profile(v)).subscription_credit_php), 3000);
});

// ───────────────────────────────────────────────────────────────────────────
// 4. A downgrade: nothing today.
// ───────────────────────────────────────────────────────────────────────────

test('a downgrade changes NOTHING today — the paid term runs on', async () => {
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const before = await profile(v);

  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  const after = await profile(v);

  assert.equal(after.tier_state, 'pro', 'the shop must keep the plan they paid for');
  // Compared as instants: the driver hands back Date objects, and two Dates for
  // the same moment are never `strictEqual` to each other.
  assert.equal(
    new Date(after.tier_expires_at!).getTime(),
    new Date(before.tier_expires_at!).getTime(),
    'a downgrade must not move the term end either way',
  );
  assert.equal(after.pending_tier, 'solo', 'the cheaper plan should be scheduled');
  assert.equal(after.pending_tier_purchase_id, p, 'the schedule must name the purchase that paid');

  // No proration on the way down: the shop is not credited for the Pro days
  // they are still using.
  assert.equal(Number(after.subscription_credit_php), 0);
});

test('a downgrade whose dearer plan already lapsed activates NOW rather than waiting forever', async () => {
  // Re-checked at activation, not trusted from order time. If it deferred here
  // the shop would sit on free holding a plan they had paid for.
  const v = await newVendor('pro', "NOW() - INTERVAL '1 day'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  const after = await profile(v);
  assert.equal(after.tier_state, 'solo');
  assert.equal(after.pending_tier, null);
});

// ───────────────────────────────────────────────────────────────────────────
// 5. THE APPLIER. The regression test for the whole feature.
// ───────────────────────────────────────────────────────────────────────────

test('a paid scheduled plan LANDS at term end, and not on free', async () => {
  // 🚨 THIS IS THE ONE. Delete the applier branch from sweep_vendor_tier_expiry
  // and this shop lands on `verified` — the plan they scheduled and PAID FOR
  // silently never arrives, and nothing errors anywhere.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);

  // The term runs out.
  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = NOW() - INTERVAL '1 minute'
      WHERE vendor_profile_id = $1`,
    [v],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);

  const after = await profile(v);
  assert.equal(
    after.tier_state,
    'solo',
    'the scheduled plan did not land — the shop was dropped instead of moved',
  );
  assert.notEqual(after.tier_state, 'verified', 'the shop lapsed instead of changing plan');
  assert.equal(after.pending_tier, null, 'the schedule should be consumed once applied');
  assert.ok(after.tier_expires_at, 'the new plan must start a term of its own');
  const days = (new Date(after.tier_expires_at!).getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 27 && days < 29, `the new term should run 28 days, got ${days.toFixed(1)}`);

  // The purchase gets its window stamped, so the credit maths can see it.
  const s = await db.query<{ expires_at: string | null }>(
    `SELECT expires_at FROM public.vendor_subscriptions WHERE purchase_id = $1`,
    [p],
  );
  assert.ok(s.rows[0]!.expires_at, 'the applied purchase should record the term it bought');
});

test('a scheduled plan NOBODY PAID FOR is dropped, never granted', async () => {
  // A pending tier is not an entitlement. Without this the schedule would be a
  // free plan: stamp an intention, wait, receive the tier.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  // Stamp the schedule WITHOUT paying — as service_role, which is what the
  // activation path would be, so the entitlement guard is not what is under test.
  await db.query(
    `UPDATE public.vendor_profiles
        SET pending_tier = 'solo', pending_tier_period_days = 28,
            pending_tier_purchase_id = $2, pending_tier_scheduled_at = NOW(),
            tier_expires_at = NOW() - INTERVAL '1 minute'
      WHERE vendor_profile_id = $1`,
    [v, p],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);

  const after = await profile(v);
  assert.equal(after.tier_state, 'verified', 'an unpaid schedule must lapse like anything else');
  assert.equal(after.pending_tier, null, 'the dead schedule should be cleared, not left to fire later');
});

test('a shop with nothing scheduled lapses exactly as it always did', async () => {
  // The applier is additive. Everything below it must be untouched.
  const v = await newVendor('pro', "NOW() - INTERVAL '1 day'");
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);
  const after = await profile(v);
  assert.equal(after.tier_state, 'verified');
  assert.equal(after.tier_expires_at, null);
});

test('a lapse EXPIRES the credit, and leaves a record of it', async () => {
  // ⚖ OWNER RULED 2026-08-28: *"it expires when they lapse"*, chosen over
  // keeping it. This test is the INVERSION of the one that used to sit here
  // pinning the opposite — inverted rather than deleted and replaced, so the
  // behaviour was never unpinned in the gap between the two.
  //
  // 🔑 THE MOMENT OF EXPIRY IS THE SWEEP, NOT THE CLOCK. `tier_expires_at`
  // passing does nothing on its own; the sweep is login-driven and cron-free and
  // is the only thing that actually runs. A shop whose owner never signs in
  // therefore keeps the balance until somebody does.
  const v = await newVendor('pro', "NOW() - INTERVAL '1 day'");
  await db.query(
    `UPDATE public.vendor_profiles SET subscription_credit_php = 4200
      WHERE vendor_profile_id = $1`,
    [v],
  );

  // Before the sweep runs the money is still there — the clock alone took
  // nothing. Asserting this makes the MOMENT part of the contract rather than an
  // accident of when the test happened to look.
  assert.equal(Number((await profile(v)).subscription_credit_php), 4200);

  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);
  assert.equal(
    Number((await profile(v)).subscription_credit_php),
    0,
    'the credit survived a lapse — the owner ruled that it expires',
  );

  // 🚨 NEVER DESTROY A BALANCE SILENTLY. Prod holds real paid subscriptions;
  // money vanishing with no trace is indefensible the first time a supplier asks
  // where it went.
  const led = await db.query<{
    delta_php: string;
    balance_after_php: string;
    reason: string;
  }>(
    `SELECT delta_php, balance_after_php, reason
       FROM public.vendor_credit_ledger WHERE vendor_profile_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [v],
  );
  assert.ok(led.rows[0], 'money disappeared with no ledger row behind it');
  assert.equal(Number(led.rows[0]!.delta_php), -4200, 'the record must carry the amount lost');
  assert.equal(Number(led.rows[0]!.balance_after_php), 0);
  assert.equal(led.rows[0]!.reason, 'lapse', 'the record must say WHY the money went');
});

test('a shop with NO credit lapses cleanly and writes no ledger noise', async () => {
  // The common case by far. A movement log that records non-movements is a log
  // nobody can read.
  const v = await newVendor('pro', "NOW() - INTERVAL '1 day'");
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);
  assert.equal(Number((await profile(v)).subscription_credit_php), 0);
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_credit_ledger WHERE vendor_profile_id = $1`,
    [v],
  );
  assert.equal(n.rows[0]!.c, '0', 'a zero balance going to zero is not a movement');
});

test('APPLYING A SCHEDULED CHANGE IS NOT A LAPSE — it must not eat the balance', async () => {
  // 🚨 THE BOUNDARY THAT MATTERS MOST NOW THAT LAPSING DESTROYS MONEY. Both
  // paths live in the SAME sweep and both are triggered by `tier_expires_at`
  // passing; only one of them is a shop going away. A shop moving to the Solo
  // plan it scheduled and PAID FOR is CONTINUING, and taking its balance there
  // would be theft dressed as policy.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  await db.query(
    `UPDATE public.vendor_profiles SET subscription_credit_php = 4200,
            tier_expires_at = NOW() - INTERVAL '1 minute'
      WHERE vendor_profile_id = $1`,
    [v],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);

  const after = await profile(v);
  assert.equal(after.tier_state, 'solo', 'the scheduled plan should have landed');
  assert.equal(
    Number(after.subscription_credit_php),
    4200,
    'applying a scheduled change ate the balance — that path is not a lapse',
  );
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_credit_ledger
      WHERE vendor_profile_id = $1 AND reason = 'lapse'`,
    [v],
  );
  assert.equal(n.rows[0]!.c, '0', 'a continuing shop was recorded as having lapsed');
});

test('a SCHEDULED change nobody paid for still lapses, and still expires the credit', async () => {
  // The other direction of the same boundary. An unpaid schedule is dropped and
  // the shop genuinely lapses, so the balance goes with it — otherwise stamping
  // an intention nobody paid for would be a way to keep money alive forever.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(
    `UPDATE public.vendor_profiles
        SET pending_tier = 'solo', pending_tier_period_days = 28,
            pending_tier_purchase_id = $2, pending_tier_scheduled_at = NOW(),
            subscription_credit_php = 4200,
            tier_expires_at = NOW() - INTERVAL '1 minute'
      WHERE vendor_profile_id = $1`,
    [v, p],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [v]);

  const after = await profile(v);
  assert.equal(after.tier_state, 'verified', 'an unpaid schedule must lapse');
  assert.equal(
    Number(after.subscription_credit_php),
    0,
    'a genuine lapse must expire the credit even when a schedule was stamped',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 6. The inverse, and the self-grant guard.
// ───────────────────────────────────────────────────────────────────────────

test('a scheduled change can be called off, and the money becomes credit', async () => {
  // A forward primitive with no inverse traps a shop in a decision made once.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(`SELECT public._apply_subscription_credit($1, NULL)`, [p]);
  assert.equal((await profile(v)).pending_tier, 'solo');

  // Undo it directly (cancel_vendor_plan_change resolves the shop from the
  // caller's session; the rule under test is what happens to the money).
  await db.query(
    `UPDATE public.vendor_profiles
        SET subscription_credit_php = subscription_credit_php
              + (SELECT amount_php FROM public.vendor_subscriptions
                  WHERE purchase_id = $2 AND status = 'paid'),
            pending_tier = NULL, pending_tier_purchase_id = NULL
      WHERE vendor_profile_id = $1`,
    [v, p],
  );
  await db.query(
    `UPDATE public.vendor_subscriptions SET status = 'superseded' WHERE purchase_id = $1`,
    [p],
  );
  assert.equal(Number((await profile(v)).subscription_credit_php), 1000);
});

test("'superseded' is a status the table actually admits", async () => {
  // 🪤 The first cut of the cancel path wrote 'cancelled'. The CHECK on this
  // table admits pending_payment | paid | rejected | superseded and nothing
  // else, so that value would have been REFUSED by the constraint. Read the
  // constraint; never reach for the word that reads best in English.
  const v = await newVendor('pro', "NOW() + INTERVAL '20 days'");
  const p = await pendingPurchase(v, 'solo', {
    kind: 'downgrade',
    list: 1000,
    credit: 0,
    carry: 0,
  });
  await db.query(
    `UPDATE public.vendor_subscriptions SET status = 'superseded' WHERE purchase_id = $1`,
    [p],
  );
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_subscriptions SET status = 'cancelled' WHERE purchase_id = $1`,
        [p],
      ),
    /violates check constraint/i,
    "'cancelled' is not a legal status and the table should say so",
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 7. THE CHECKOUT ITSELF, END TO END.
//
// 🪤 THESE EXIST BECAUSE THE FIRST MUTATION RUN CAUGHT MY OWN GUARD BEING
// DECORATION. Gutting the credit arithmetic inside `create_vendor_subscription`
// (`v_carry := 0`) left every test above GREEN, because they all wrote the
// purchase row by hand and never asked the checkout to price anything. The
// carry-forward figure the whole feature turns on was untested at its only real
// writer. A test that hand-builds the row it is meant to be checking is testing
// its own fixture.
// ───────────────────────────────────────────────────────────────────────────

/** A shop whose signed-in owner can actually call the checkout RPC. */
async function shopWithSignedInOwner(
  tier: string,
  expiresSql: string,
): Promise<{ vendorId: string; uid: string }> {
  const vendorId = await newVendor(tier, expiresSql);
  const r = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  const uid = r.rows[0]!.user_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING`,
    [vendorId, uid],
  );
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  return { vendorId, uid };
}

async function activeSku(like: string): Promise<{ sku: string; price: number }> {
  const r = await db.query<{ sku_code: string; price_php: string }>(
    `SELECT sku_code, price_php FROM public.vendor_billing_catalog
      WHERE offering_type IN ('subscription_monthly','subscription_annual')
        AND is_active = TRUE AND sku_code LIKE $1 LIMIT 1`,
    [like],
  );
  assert.ok(r.rows[0], `no active catalog row matching ${like} — the fixture would prove nothing`);
  return { sku: r.rows[0]!.sku_code, price: Number(r.rows[0]!.price_php) };
}

test('the CHECKOUT prices an upgrade as list minus the unused value, server-side', async () => {
  const { vendorId } = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '28 days'");
  await asSuperuser();
  await paidPurchase(vendorId, 'solo', 1000, 28, "NOW() + INTERVAL '28 days'");
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);

  const pro = await activeSku('pro\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [pro.sku]);
  await asSuperuser();

  const r = await db.query<{
    amount_php: string;
    list_price_php: string;
    credit_applied_php: string;
    credit_carry_forward_php: string;
    plan_change_kind: string;
  }>(
    `SELECT amount_php, list_price_php, credit_applied_php, credit_carry_forward_php,
            plan_change_kind
       FROM public.vendor_subscriptions
      WHERE vendor_id = $1 AND status = 'pending_payment'
      ORDER BY created_at DESC LIMIT 1`,
    [vendorId],
  );
  const row = r.rows[0]!;
  assert.equal(row.plan_change_kind, 'upgrade');
  assert.equal(Number(row.list_price_php), pro.price, 'the list price comes from the catalog');
  assert.equal(Number(row.credit_applied_php), 1000, 'the whole unused Solo block should be credited');
  assert.equal(
    Number(row.amount_php),
    pro.price - 1000,
    'the shop is billed list minus credit, and nothing else',
  );
  // The three terms of the bill must reconcile — that is what makes the figure
  // auditable rather than merely plausible.
  assert.equal(
    Number(row.list_price_php) - Number(row.credit_applied_php),
    Number(row.amount_php),
  );
  assert.equal(Number(row.credit_carry_forward_php), 0, 'nothing was left over here');
});

test('the CHECKOUT carries the excess forward when the credit is bigger than the bill', async () => {
  // 🚨 THE TEST MUTATION 3 PROVED WAS MISSING. `v_carry := 0` in the checkout
  // used to survive the whole suite.
  //
  // ⚠ THIS SCENARIO HAD TO BE REBUILT WHEN THE TERM-LENGTH RULE LANDED, AND THE
  // REASON IS THE POINT OF THAT RULE. It used to hold 360 days of Solo annual
  // and buy a 28-day Pro — which is now REFUSED outright, because a purchase may
  // never be shorter than the time you already hold. That single rule removes
  // proration as a source of carried credit altogether: an upgrade must now buy
  // a term at least as long as the one it replaces, and at equal terms the
  // dearer plan always costs more than the unused value of the cheaper one, so
  // the credit is always fully absorbed by the bill.
  //
  // What CAN still leave money on an account is a scheduled change that was
  // paid for and then called off, and a balance that outlives the plan it was
  // meant for. That is what this now builds: a shop holding money from an
  // earlier cancelled change, whose plan has since lapsed, buying a small plan.
  const { vendorId } = await shopWithSignedInOwner('verified', "NOW() - INTERVAL '1 day'");
  await asSuperuser();
  await db.query(
    `UPDATE public.vendor_profiles SET subscription_credit_php = 9400
      WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);

  const pro = await activeSku('pro\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [pro.sku]);
  await asSuperuser();

  const r = await db.query<{
    amount_php: string;
    credit_applied_php: string;
    credit_carry_forward_php: string;
  }>(
    `SELECT amount_php, credit_applied_php, credit_carry_forward_php
       FROM public.vendor_subscriptions WHERE vendor_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [vendorId],
  );
  const row = r.rows[0]!;
  assert.equal(Number(row.amount_php), 0, 'a fully covered bill costs nothing');
  assert.equal(Number(row.credit_applied_php), pro.price, 'the credit is capped at the bill');
  assert.equal(
    Number(row.credit_carry_forward_php),
    9400 - pro.price,
    'the money above the bill was thrown away instead of carried forward',
  );

  // And with nothing to pay, there is nothing to reconcile — it applies itself
  // rather than parking the shop in front of payment instructions for ₱0.
  const after = await profile(vendorId);
  assert.equal(after.tier_state, 'pro', 'a zero-peso plan change should just happen');
  assert.equal(
    Number(after.subscription_credit_php),
    Number(row.credit_carry_forward_php),
    'the balance should become exactly the figure the purchase quoted',
  );
});

test('the CHECKOUT defers a downgrade and bills it at full list — no proration downward', async () => {
  const { vendorId } = await shopWithSignedInOwner('pro', "NOW() + INTERVAL '20 days'");
  const solo = await activeSku('solo\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [solo.sku]);
  await asSuperuser();

  const r = await db.query<{ amount_php: string; plan_change_kind: string; credit_applied_php: string }>(
    `SELECT amount_php, plan_change_kind, credit_applied_php
       FROM public.vendor_subscriptions WHERE vendor_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [vendorId],
  );
  assert.equal(r.rows[0]!.plan_change_kind, 'downgrade');
  assert.equal(Number(r.rows[0]!.credit_applied_php), 0, 'moving down earns no credit');
  assert.equal(Number(r.rows[0]!.amount_php), solo.price, 'the cheaper plan is billed at its own price');
  assert.equal((await profile(vendorId)).tier_state, 'pro', 'nothing changes until it is paid');
});

test('a second unpaid plan change is refused rather than quoted the same credit twice', async () => {
  const { vendorId } = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '28 days'");
  await asSuperuser();
  await paidPurchase(vendorId, 'solo', 1000, 28, "NOW() + INTERVAL '28 days'");
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);

  const pro = await activeSku('pro\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [pro.sku]);
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [pro.sku]),
    /ONE_PLAN_CHANGE_PENDING/,
    'two unpaid changes could each spend the same credit',
  );
  await asSuperuser();
});

test('a second unpaid DOWNGRADE is refused too, not just a credit-bearing change', async () => {
  // A downgrade earns no credit, so a rule keyed only on "carries a credit"
  // would let two queue up — and the second one paid would silently overwrite
  // the schedule the shop had already set.
  const { vendorId } = await shopWithSignedInOwner('enterprise', "NOW() + INTERVAL '20 days'");
  const solo = await activeSku('solo\\_vendor\\_monthly');
  const pro = await activeSku('pro\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [solo.sku]);
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [pro.sku]),
    /ONE_PLAN_CHANGE_PENDING/,
    'a shop queued two plan changes at once',
  );
  await asSuperuser();
  assert.equal((await profile(vendorId)).tier_state, 'enterprise');
});

// ───────────────────────────────────────────────────────────────────────────
// 8. A PURCHASE MUST COVER THE TIME YOU ALREADY HAVE — refused at the SERVER.
//
// Owner 2026-08-27: *"they cannot purchase a smaller timeline. if they paid for
// a year. their purchase must cover the same timeline. this means, they cannot
// purchase a months worth if what they have now is more than a months worth of
// subscription."*
//
// 🔑 THE PICKER DISABLING THE OPTION IS NOT THE RULE. These tests call the RPC
// directly, which is what a stale page or a hand-posted form does. If the only
// enforcement lived in the browser, every one of these would pass while the
// product had no rule at all.
// ───────────────────────────────────────────────────────────────────────────

test('holding a YEAR, a 28-day purchase is refused by the database', async () => {
  const { vendorId } = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '300 days'");
  const proMonthly = await activeSku('pro\\_vendor\\_monthly');
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [proMonthly.sku]),
    /TERM_TOO_SHORT/,
    'a 28-day plan was sold to a shop holding 300 days',
  );
  await asSuperuser();
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_subscriptions WHERE vendor_id = $1`,
    [vendorId],
  );
  assert.equal(n.rows[0]!.c, '0', 'a refused purchase must leave no row behind');
});

test('the refusal carries the DAY, so the screen can say it back', async () => {
  // The app turns this into "You're paid up until 14 June." — it needs the date
  // to do that, and reading it off the message beats a second round trip.
  await shopWithSignedInOwner('solo', "NOW() + INTERVAL '300 days'");
  const proMonthly = await activeSku('pro\\_vendor\\_monthly');
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [proMonthly.sku]),
    (err: Error) => {
      assert.match(err.message, /TERM_TOO_SHORT/);
      assert.match(err.message, /\d{4}-\d{2}-\d{2}/, 'the refusal must name the day');
      return true;
    },
  );
  await asSuperuser();
});

test('the same shop CAN buy the yearly plan — the rule blocks the TERM, not the move', async () => {
  // ⚖ The counterweight. A gate that also blocked the legitimate way forward
  // would leave the shop no route at all, which is worse than no gate.
  const { vendorId } = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '300 days'");
  const proAnnual = await activeSku('pro\\_vendor\\_annual');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [proAnnual.sku]);
  await asSuperuser();
  const r = await db.query<{ plan_change_kind: string; period_days: number }>(
    `SELECT plan_change_kind, period_days FROM public.vendor_subscriptions
      WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [vendorId],
  );
  assert.equal(r.rows[0]!.plan_change_kind, 'upgrade', 'and it still prorates');
  assert.equal(r.rows[0]!.period_days, 365);
});

test('BOUNDARY: a term EXACTLY matching the time left is ALLOWED', async () => {
  // 🔑 "Shorter than", never "shorter than or equal". Writing `<=` here would
  // refuse an ordinary same-length renewal — the commonest purchase there is.
  //
  // 🪤 THE OBVIOUS VERSION OF THIS TEST CANNOT DETECT THAT MISTAKE, AND MY FIRST
  // ONE DID NOT. Setting `tier_expires_at = now() + 28 days` in one statement
  // and calling the RPC in the next leaves the expiry a few microseconds SHORT
  // of 28 days, because `now()` advanced in between — so `<=` and `<` give the
  // same answer and a flipped comparison sails through. The mutation run caught
  // it staying green.
  //
  // Both statements run inside ONE transaction here. `now()` is the transaction
  // timestamp and is frozen for its whole life, so the expiry is exactly 28 days
  // out at the moment the gate compares them — the only arrangement in which the
  // boundary is actually on the boundary.
  const equal = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '28 days'");
  const soloMonthly = await activeSku('solo\\_vendor\\_monthly');

  await db.exec('BEGIN');
  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = now() + INTERVAL '28 days'
      WHERE vendor_profile_id = $1`,
    [equal.vendorId],
  );
  // Must NOT throw: the term is exactly as long as the time remaining.
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloMonthly.sku]);
  await db.exec('COMMIT');
  await asSuperuser();

  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_subscriptions WHERE vendor_id = $1`,
    [equal.vendorId],
  );
  assert.equal(n.rows[0]!.c, '1', 'an exactly-equal term was refused — the rule reads <= not <');
});

test('BOUNDARY: one hour past the term IS refused', async () => {
  // The other side of the same line, so the pair brackets it. Without this a
  // gate that simply never fires would pass the equality test above.
  const soloMonthly = await activeSku('solo\\_vendor\\_monthly');
  await shopWithSignedInOwner('solo', "NOW() + INTERVAL '28 days 1 hour'");
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloMonthly.sku]),
    /TERM_TOO_SHORT/,
    'the boundary is off by an hour in the wrong direction',
  );
  await asSuperuser();
});

test('a LAPSED shop can buy any term — no special case needed', async () => {
  // Both arms of the guard are false for an expired plan, so this falls out of
  // the condition rather than being handled separately.
  const lapsed = await shopWithSignedInOwner('pro', "NOW() - INTERVAL '1 day'");
  const soloMonthly = await activeSku('solo\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloMonthly.sku]);
  await asSuperuser();
  const r = await db.query<{ plan_change_kind: string }>(
    `SELECT plan_change_kind FROM public.vendor_subscriptions
      WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [lapsed.vendorId],
  );
  assert.equal(r.rows[0]!.plan_change_kind, 'new', 'a lapsed shop is making a fresh purchase');
});

test('a shop that never subscribed can buy any term', async () => {
  const fresh = await shopWithSignedInOwner('verified', 'NULL');
  const soloMonthly = await activeSku('solo\\_vendor\\_monthly');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloMonthly.sku]);
  await asSuperuser();
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.vendor_subscriptions WHERE vendor_id = $1`,
    [fresh.vendorId],
  );
  assert.equal(n.rows[0]!.c, '1');
});

test('the two rules COMPOSE: a shortening downgrade is refused, not deferred', async () => {
  // ⚠ THE INTERACTION THE OWNER ASKED ABOUT. A downgrade keeping the same term
  // still defers as before. A downgrade that ALSO shortens the term is refused
  // outright — and what a person reads must be the refusal, not the "starts
  // when your current plan ends" deferral, because nothing is scheduled at all.
  const { vendorId } = await shopWithSignedInOwner('pro', "NOW() + INTERVAL '300 days'");
  const soloMonthly = await activeSku('solo\\_vendor\\_monthly');
  await assert.rejects(
    () => db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloMonthly.sku]),
    /TERM_TOO_SHORT/,
    'a shortening downgrade should be refused before anything is scheduled',
  );
  await asSuperuser();
  const after = await profile(vendorId);
  assert.equal(after.pending_tier, null, 'nothing may be scheduled by a refused purchase');
  assert.equal(after.tier_state, 'pro');

  // The SAME-length downgrade still works and still defers.
  const same = await shopWithSignedInOwner('pro', "NOW() + INTERVAL '300 days'");
  const soloAnnual = await activeSku('solo\\_vendor\\_annual');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [soloAnnual.sku]);
  await asSuperuser();
  const r = await db.query<{ plan_change_kind: string }>(
    `SELECT plan_change_kind FROM public.vendor_subscriptions
      WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [same.vendorId],
  );
  assert.equal(r.rows[0]!.plan_change_kind, 'downgrade', 'a same-term downgrade is unaffected');
});

test('the term rule DELETES proration as a source of carried credit', async () => {
  // ⚖ THIS IS WHY THE OWNER CHOSE THE STRICTER RULE, stated as a property
  // rather than as prose. The industry norm would allow a shop holding a year
  // of Solo to buy a 28-day Pro and would hand back the difference as several
  // thousand pesos of standing credit. Under this rule the purchase must be at
  // least as long as the time it replaces, and at equal terms the dearer plan
  // always costs more than the unused value of the cheaper one — so the credit
  // is fully absorbed by the bill and NOTHING is left over.
  //
  // If this ever fails, somebody has relaxed the term rule or moved a price so
  // that a lower tier costs more than a higher one. Both deserve a hard look.
  const { vendorId } = await shopWithSignedInOwner('solo', "NOW() + INTERVAL '300 days'");
  await asSuperuser();
  await paidPurchase(vendorId, 'solo', 10400, 365, "NOW() + INTERVAL '300 days'");
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [vendorId],
  );
  await setAuthUid(db, owner.rows[0]!.user_id);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);

  // The only Pro they are allowed to buy is the annual one.
  const proAnnual = await activeSku('pro\\_vendor\\_annual');
  await db.query(`SELECT public.create_vendor_subscription($1, NULL)`, [proAnnual.sku]);
  await asSuperuser();

  const r = await db.query<{ credit_carry_forward_php: string; credit_applied_php: string }>(
    `SELECT credit_carry_forward_php, credit_applied_php
       FROM public.vendor_subscriptions WHERE vendor_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [vendorId],
  );
  assert.ok(
    Number(r.rows[0]!.credit_applied_php) > 0,
    'the unused year should still come off the price — the rule blocks the term, not proration',
  );
  assert.equal(
    Number(r.rows[0]!.credit_carry_forward_php),
    0,
    'proration left a standing balance behind, which the term rule exists to prevent',
  );
});

test('a shop cannot write itself credit or a pending plan', async () => {
  // 🔑 THE ROW IS YOURS, THE FIELD IS NOT. `authenticated` holds a TABLE-level
  // grant on vendor_profiles, and the RLS policy is FOR ALL on
  // `user_id = auth.uid()` — it authenticates the owner and says nothing about
  // what is in the row. The write-guard trigger is the only control here, and
  // subscription_credit_php is literally pesos.
  const v = await newVendor('solo', "NOW() + INTERVAL '20 days'");
  const owner = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [v],
  );

  try {
    await asVendorUser(owner.rows[0]!.user_id);
    for (const [col, value] of [
      ['subscription_credit_php', '999999'],
      ['pending_tier', `'enterprise'::public.vendor_tier_state`],
      ['tier_expires_at', `NOW() + INTERVAL '3650 days'`],
    ] as const) {
      await assert.rejects(
        () =>
          db.query(
            `UPDATE public.vendor_profiles SET ${col} = ${value} WHERE vendor_profile_id = $1`,
            [v],
          ),
        /self-grant blocked/,
        `a vendor was able to write their own ${col}`,
      );
    }
  } finally {
    await asSuperuser();
  }

  // Nothing got through.
  const after = await profile(v);
  assert.equal(Number(after.subscription_credit_php), 0);
  assert.equal(after.pending_tier, null);
});
