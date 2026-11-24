/**
 * 🧰 A PAID WIDGET OPENS ONLY WHEN BOUGHT AND SUBSCRIBED — the photo challenge and the 3D booth (migration
 * 20271360126307 § 4, replacing 20271356215288's "comes with the plan" and its frozen grandfather arms).
 *
 * ⚖ DECISION_LOG a02673ac (owner 23 Nov 2026): a paid tool opens only when the shop bought it AND is on Plus, Pro or
 * Ultra. The plan alone no longer includes it. On Free or Verified an owned tool locks ("Works again when you
 * subscribe"). The grandfathering is 5bfefe76's owned rows (tests/db/the-toolkit-opens-bought-widgets-only.db.test.ts).
 *
 * Proves:
 *   1 · `vendor_pro_tools_included` is the subscription half only: live Plus, Pro, Ultra; never lapsed, Free, Verified,
 *       and the frozen 20 Nov columns (a Plus term, a window) open nothing any more (the trial arm is gone with them).
 *   2 · the plan alone opens neither tool; bought + subscribed opens both; bought + lapsed locks both again.
 *   3 · the TS mirror `proToolsIncludedFrom` agrees with the SQL on every case.
 *   5 · the frozen columns stay on a service-role-only table.  6 · a badge-reward window is still time-boxed.
 *
 * Sabotage (23 Nov, each turned this file RED, then reverted): put the grandfather arms back · drop the
 * `AND vendor_pro_tools_included` from vendor_store_tool_open · put the plan arm back in vendor_papic_challenge_entitled.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { proToolsIncludedFrom } from '../../lib/specialized-tools-access';
import { isVendor3dBoothActive } from '../../lib/vendor-3d-booth-pricing';

let replay: ReplayResult;
let db: PGlite;
before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `protools-${++seq}-${Date.now()}`;
const FUTURE = (days = 10) => new Date(Date.now() + days * 864e5).toISOString();
const PAST = () => new Date(Date.now() - 10 * 864e5).toISOString();

async function newShop(a: { tier: string; verified?: boolean; tierExpires?: string | null }): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        tier_state, tier_expires_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], $3::vendor_verification_state, NOW(),
             $4::vendor_tier_state, $5,
             (CASE WHEN $3 = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id, `Shop ${uniq()}`, a.verified === false ? 'unverified' : 'verified', a.tier, a.tierExpires ?? null],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** An event with this shop booked on it (the booking may claim the shop's trial — spent below where it matters). */
async function newBooking(vpid: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('An event','birthday','2030-08-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const host = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    host.rows[0]!.id,
  ]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','A Shop','contracted',$2,50000)`,
    [eventId, vpid],
  );
  return eventId;
}

async function spendTrial(vpid: string) {
  await db.query(
    `UPDATE public.vendor_specialized_tools_access SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE vendor_profile_id = $1`,
    [vpid],
  );
}

const included = async (vpid: string, eventId: string | null) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_pro_tools_included($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;
const challenge = async (vpid: string, eventId: string) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_papic_challenge_entitled($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;
const unlocked = async (vpid: string, eventId: string | null) =>
  (await db.query<{ ok: boolean }>(`SELECT public.vendor_specialized_tools_unlocked($1, $2) AS ok`, [vpid, eventId])).rows[0]!.ok;

async function branded(eventId: string): Promise<string[]> {
  await db.exec('BEGIN');
  try {
    await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', true)`);
    await db.exec('SET LOCAL ROLE service_role');
    const r = await db.query<{ id: string }>(`SELECT public.event_branded_booth_vendor_ids($1) AS id`, [eventId]);
    return r.rows.map((x) => x.id);
  } finally {
    await db.exec('ROLLBACK');
    await db.exec('RESET ROLE').catch(() => {});
  }
}

async function buy(vpid: string, tool: string): Promise<string> {
  const owner = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [vpid])).rows[0]!.user_id;
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, $3, 'Toolkit widget', 1, 'paid'::order_status, $4) RETURNING order_id`,
    [owner, vpid, `vendor_tool_${tool}`, `P${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)}`],
  );
  return r.rows[0]!.order_id;
}

async function freeze(vpid: string, cols: { plus?: string | null; unlock?: string | null }) {
  await db.query(
    `INSERT INTO public.vendor_specialized_tools_access (vendor_profile_id, pro_tools_plus_until, pro_tools_unlock_until)
     VALUES ($1, $2::timestamptz, $3)
     ON CONFLICT (vendor_profile_id) DO UPDATE SET pro_tools_plus_until = EXCLUDED.pro_tools_plus_until,
       pro_tools_unlock_until = EXCLUDED.pro_tools_unlock_until`,
    [vpid, cols.plus ?? null, cols.unlock ?? null],
  );
}

test('1 · the subscription half: live Plus, Pro and Ultra only — the frozen 20 Nov columns open nothing any more', async () => {
  for (const tier of ['solo', 'pro', 'enterprise']) {
    assert.equal(await included(await newShop({ tier, tierExpires: FUTURE() }), null), true, `${tier}: subscribed`);
    assert.equal(await included(await newShop({ tier, tierExpires: null }), null), true, `${tier}, no end date: subscribed`);
  }
  assert.equal(await included(await newShop({ tier: 'pro', tierExpires: PAST() }), null), false, 'a lapsed plan');
  assert.equal(await included(await newShop({ tier: 'verified' }), null), false, 'Verified');
  assert.equal(await included(await newShop({ tier: 'free', verified: false }), null), false, 'Free');

  const window = await newShop({ tier: 'verified' });
  await freeze(window, { unlock: FUTURE(15), plus: 'infinity' });
  assert.equal(await included(window, null), false, 'a frozen window or Plus term no longer opens anything');
});

test('2 · the plan alone opens neither tool; bought AND subscribed opens both; bought then lapsed locks both again', async () => {
  const pro = await newShop({ tier: 'pro', tierExpires: FUTURE() });
  const e1 = await newBooking(pro);
  await spendTrial(pro);
  assert.equal(await challenge(pro, e1), false, 'a live Pro that never bought the challenge: shut');
  assert.deepEqual(await branded(e1), [], 'nor the branded booth');
  assert.equal(await unlocked(pro, e1), true, 'the Specialized tools unlock for the other tools is untouched');

  await buy(pro, 'papic_challenge');
  assert.equal(await challenge(pro, e1), true, 'bought + subscribed: the challenge opens');
  assert.deepEqual(await branded(e1), [], 'one widget never opens another');
  await buy(pro, 'plan_3d');
  assert.deepEqual(await branded(e1), [pro], 'bought + subscribed: the booth brands');

  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = $2 WHERE vendor_profile_id = $1`, [pro, PAST()]);
  assert.equal(await challenge(pro, e1), false, 'owned but off-plan: locked ("Works again when you subscribe")');
  assert.deepEqual(await branded(e1), []);

  const verified = await newShop({ tier: 'verified' });
  const e2 = await newBooking(verified);
  await spendTrial(verified);
  await buy(verified, 'papic_challenge');
  await buy(verified, 'plan_3d');
  assert.equal(await challenge(verified, e2), false, 'Verified with both bought: still locked');
  assert.deepEqual(await branded(e2), []);
});

test('3 · the TS mirror agrees with the SQL on every case', async () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise']) {
    for (const verified of [true, false]) {
      for (const tierExpires of [null, PAST(), FUTURE()]) {
        for (const frozen of [false, true]) {
          const vpid = await newShop({ tier, verified, tierExpires });
          if (frozen) await freeze(vpid, { plus: FUTURE(), unlock: FUTURE() });
          const facts = { tier_state: tier, tier_expires_at: tierExpires, verification_state: verified ? 'verified' : 'unverified' };
          assert.equal(proToolsIncludedFrom(facts), await included(vpid, null), JSON.stringify({ tier, verified, tierExpires, frozen }));
        }
      }
    }
  }
});

test('5 · the frozen columns live on a service-role-only table', async () => {
  const r = await db.query<{ grantee: string }>(
    `SELECT DISTINCT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'vendor_specialized_tools_access' AND grantee IN ('anon','authenticated')`,
  );
  assert.deepEqual(r.rows, []);
});

test('6 · a badge-reward window below the paid plans is time-boxed: it opens the tool, then ends — never a permanent grant (controller 20 Nov)', async () => {
  // Decision: badge reward windows stay, time-boxed; the ruling covers bought access only. They write the same
  // papic_challenge_expires_at / booth_addon_expires_at windows the legacy add-ons did. Since 2026-11-22 Plus includes
  // the tools, so the shop below the gate is a Verified one.
  const plus = await newShop({ tier: 'verified' });
  const eventId = await newBooking(plus);
  await spendTrial(plus);
  await db.query(`UPDATE public.vendor_profiles SET papic_challenge_expires_at = $2 WHERE vendor_profile_id = $1`, [plus, FUTURE(28)]);
  assert.equal(await challenge(plus, eventId), true, 'the reward window opens the photo challenge below Pro');
  await db.query(
    `UPDATE public.vendor_profiles SET papic_challenge_expires_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`,
    [plus],
  );
  assert.equal(await challenge(plus, eventId), false, 'once it ends, the Toolkit rule applies');
  assert.equal(await included(plus, eventId), false, 'and the window never became a grandfather');
  // The booth's reward window is read by the same kind of clock, in TS.
  assert.equal(isVendor3dBoothActive(FUTURE(28)), true);
  assert.equal(isVendor3dBoothActive(PAST()), false);
});
