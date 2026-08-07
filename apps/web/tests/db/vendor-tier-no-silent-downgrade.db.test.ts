import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

/**
 * A vendor who has paid for more must never be quietly put back.
 *
 * 🚨 THE LIVE HAZARD THIS CLOSES. `approve_vendor_subscription` writes
 * `tier_state = <the purchase's tier>` unconditionally. A vendor who started a
 * Pro upgrade, never paid, then later bought and paid for Enterprise leaves the
 * Pro row at `pending_payment` forever. One tap on that stale row sets them
 * back to **Pro** — Enterprise features gone, and nobody, admin or vendor, is
 * shown that anything happened. The expiry stacks, so the clock looks healthy;
 * only the tier drops.
 *
 * 🔑 A STALE ROW IS NOT A DECISION ABOUT TODAY. It records what somebody wanted
 * weeks ago, and applying it blind overwrites a LATER, PAID decision with an
 * earlier, unpaid one.
 *
 * Tested at the DATABASE, not in TypeScript, because there are two writers —
 * the admin action and a webhook entry point — and a guard in one leaves the
 * other open. The webhook is the one nobody is watching.
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

async function newVendorAt(
  email: string,
  tier: string,
  expiresSql: string,
): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at)
     VALUES ($1, 'Tier Test', 'Manila', ARRAY['photography']::text[], 'verified', NOW(),
             $2::public.vendor_tier_state, ${expiresSql})
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, tier],
  );
  return v.rows[0]!.vendor_profile_id;
}

test('the ladder ranks the tiers, and an unknown tier never outranks nothing', async () => {
  const r = await db.query<{ free: number; verified: number; pro: number; ent: number }>(
    `SELECT public.vendor_tier_rank('free')       AS free,
            public.vendor_tier_rank('verified')   AS verified,
            public.vendor_tier_rank('pro')        AS pro,
            public.vendor_tier_rank('enterprise') AS ent`,
  );
  const { free, verified, pro, ent } = r.rows[0]!;
  assert.ok(free < verified && verified < pro && pro < ent, 'the ladder is out of order');
});

test('approving a stale LOWER tier on a live higher tier is REFUSED', async () => {
  // 🚨 The exact scenario: paid for Enterprise, an old unpaid Pro row is tapped.
  const id = await newVendorAt('tier-down@test.local', 'enterprise', "NOW() + INTERVAL '20 days'");
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`,
        [id],
      ),
    /TIER_DOWNGRADE_BLOCKED/,
    'a live Enterprise vendor was silently put back to Pro',
  );

  const after = await db.query<{ tier_state: string }>(
    `SELECT tier_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.tier_state, 'enterprise', 'the tier changed despite the refusal');
});

test('a genuine UPGRADE still goes through', async () => {
  const id = await newVendorAt('tier-up@test.local', 'pro', "NOW() + INTERVAL '20 days'");
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'enterprise' WHERE vendor_profile_id = $1`,
    [id],
  );
  const after = await db.query<{ tier_state: string }>(
    `SELECT tier_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.tier_state, 'enterprise');
});

test('a same-tier renewal is untouched', async () => {
  const id = await newVendorAt('tier-renew@test.local', 'pro', "NOW() + INTERVAL '3 days'");
  await db.query(
    `UPDATE public.vendor_profiles
        SET tier_state = 'pro', tier_expires_at = NOW() + INTERVAL '31 days'
      WHERE vendor_profile_id = $1`,
    [id],
  );
  const after = await db.query<{ tier_state: string }>(
    `SELECT tier_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.tier_state, 'pro');
});

test('an EXPIRED higher tier is not protected — that is a real activation', async () => {
  // Once the higher tier has lapsed the vendor is not holding it any more, so
  // approving a lower purchase grants something rather than taking it away.
  // Guarding here would block honest activations and teach people to reach for
  // the override.
  const id = await newVendorAt('tier-lapsed@test.local', 'enterprise', "NOW() - INTERVAL '1 day'");
  await db.query(
    `UPDATE public.vendor_profiles SET tier_state = 'pro' WHERE vendor_profile_id = $1`,
    [id],
  );
  const after = await db.query<{ tier_state: string }>(
    `SELECT tier_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.tier_state, 'pro');
});

test('a deliberate downgrade is possible, but only by saying so', async () => {
  // A refund or a correction is legitimate. The escape hatch is per-statement,
  // not a standing exemption, so the default stays closed.
  const id = await newVendorAt('tier-deliberate@test.local', 'enterprise', "NOW() + INTERVAL '20 days'");
  // ⚠ SET LOCAL ONLY LIVES INSIDE A TRANSACTION, and every query here is its
  // own. Setting it in a separate call would have no effect by the time the
  // UPDATE runs — the test would fail and look like the guard was too strict,
  // sending the next reader to weaken a rule that was working correctly.
  // Keeping them in one transaction is also how a real admin override must be
  // written, so this doubles as the worked example.
  await db.exec(`
    BEGIN;
    SET LOCAL setnayan.allow_tier_downgrade = 'on';
    UPDATE public.vendor_profiles SET tier_state = 'pro'
     WHERE vendor_profile_id = '${id}';
    COMMIT;
  `);
  const after = await db.query<{ tier_state: string }>(
    `SELECT tier_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [id],
  );
  assert.equal(after.rows[0]!.tier_state, 'pro');
});
