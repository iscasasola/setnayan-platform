/**
 * 🧰 THE TOOLKIT — migration 20271360126307, executed against the replayed migrations (owner 23 Nov 2026).
 *
 *   1 · `vendor_store_tool_open` = BOUGHT AND SUBSCRIBED (owner a02673ac, 23 Nov; no trial — "guides only").
 *       A paid or fulfilled order for `vendor_tool_<key>` on a live Plus, Pro or Ultra opens it; a submitted one,
 *       another shop's, another widget's, or a refund does not; the same order on Verified does not either.
 *   3 · GRANDFATHERING (owner 5bfefe76): the migration's own § 7 INSERT, run as written — a shop on a live paid plan
 *       with a saved Papic challenge or a saved 3D plan gets an owned, zero-total 'grandfathered' row for that widget;
 *       Verified, a lapsed plan or no saved work gets none; a re-run writes nothing twice; off-plan it still locks.
 *   2 · ONE WIDGET KEY: the usage log takes `plan_3d` (the Toolkit's key, its SKU `vendor_tool_plan_3d`) and refuses the
 *       old `3d_plan`; the TS list `TOOL_USAGE_KEYS` matches the CHECK (also pinned in specialized-tools-unlock 4f).
 *
 * SABOTAGE (23 Nov, against the replayed migrations, then reverted):
 *   · `o.status IN ('paid', 'fulfilled')` widened to include 'submitted' → 1 RED.
 *   · `AND public.vendor_pro_tools_included(...)` dropped from vendor_store_tool_open → 1 RED.
 *   · the § 7 NOT EXISTS dropped → 3 RED (a second grandfather row).
 *   · the § 6 CHECK swap left out → 2 RED (plan_3d refused).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReplayedDb, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';
import { TOOL_USAGE_KEYS } from '../../lib/specialized-tools-access';

/** The migration's § 7 grandfather INSERT, exactly as it runs. */
const GRANDFATHER_SQL = (() => {
  const sql = readFileSync(join(MIGRATIONS_DIR, '20271360126307_supplier_store_tools_graphs_badges.sql'), 'utf8');
  const from = sql.indexOf('INSERT INTO public.orders\n  (event_id, user_id, vendor_profile_id, service_key, description');
  const end = "AND o.status IN ('paid', 'fulfilled'));";
  const to = sql.indexOf(end, from);
  assert.ok(from > 0 && to > from, 'the grandfather INSERT is in the migration');
  return sql.slice(from, to + end.length);
})();

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
const uniq = () => `toolkit-${++seq}-${Date.now()}`;

async function newShop(tier = 'pro', tierExpires: string | null = null): Promise<{ vpid: string; ownerId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const ownerId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, tier_state, tier_expires_at, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['live_band']::text[], 'verified'::vendor_verification_state, NOW(),
             $3::vendor_tier_state, $4, 'verified'::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [ownerId, `Shop ${uniq()}`, tier, tierExpires],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, ownerId };
}

async function order(vpid: string, userId: string, serviceKey: string, status: string): Promise<string> {
  const r = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, $3, 'Toolkit widget', 1, $4::order_status, $5)
     RETURNING order_id`,
    [userId, vpid, serviceKey, status, `K${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)}`],
  );
  return r.rows[0]!.order_id;
}

async function open(vpid: string, tool: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(`SELECT public.vendor_store_tool_open($1, $2, NULL) AS ok`, [vpid, tool]);
  return r.rows[0]!.ok;
}

test('1 · a paid widget opens only when bought AND subscribed — the plan alone, Verified, a submitted order or a refund open nothing', async () => {
  const a = await newShop();
  const b = await newShop();
  assert.equal(await open(a.vpid, 'song_bank'), false, 'a Pro shop with no order: shut (the plan alone opens nothing; no trial)');

  await order(a.vpid, a.ownerId, 'vendor_tool_song_bank', 'submitted');
  assert.equal(await open(a.vpid, 'song_bank'), false, 'an order in review does not open it');

  await order(a.vpid, a.ownerId, 'vendor_tool_cake_tool', 'paid');
  assert.equal(await open(a.vpid, 'song_bank'), false, 'another widget’s order does not open it');
  assert.equal(await open(a.vpid, 'cake_tool'), true, 'a paid order opens its own widget');

  await order(b.vpid, b.ownerId, 'vendor_tool_song_bank', 'paid');
  assert.equal(await open(a.vpid, 'song_bank'), false, 'another shop’s order does not open it');
  assert.equal(await open(b.vpid, 'song_bank'), true);

  const c = await newShop();
  const paid = await order(c.vpid, c.ownerId, 'vendor_tool_plan_3d', 'fulfilled');
  assert.equal(await open(c.vpid, 'plan_3d'), true, 'fulfilled counts as bought');
  await db.query(`UPDATE public.orders SET status = 'refunded'::order_status WHERE order_id = $1`, [paid]);
  assert.equal(await open(c.vpid, 'plan_3d'), false, 'a refund takes it back with no extra write');

  // Bought on Verified: kept, but locked until the shop subscribes ("Works again when you subscribe").
  const v = await newShop('verified');
  await order(v.vpid, v.ownerId, 'vendor_tool_cake_tool', 'paid');
  assert.equal(await open(v.vpid, 'cake_tool'), false, 'bought on Verified: locked');
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'solo'::vendor_tier_state, tier_expires_at = NOW() + INTERVAL '20 days' WHERE vendor_profile_id = $1`, [v.vpid]);
  assert.equal(await open(v.vpid, 'cake_tool'), true, 'subscribed to Plus: it works again with no new buy');
  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`, [v.vpid]);
  assert.equal(await open(v.vpid, 'cake_tool'), false, 'the plan lapsed: locked again');

  const cols = await db.query<{ c: string }>(
    `SELECT column_name AS c FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'store_trial_ends_at'`,
  );
  assert.equal(cols.rows.length, 0, 'no trial column anywhere');
});

test('2 · one widget key: the usage log takes plan_3d and refuses 3d_plan, matching TOOL_USAGE_KEYS', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'specialized_tool_usage_tool_key_known'`,
  );
  const sqlKeys: string[] = [...(r.rows[0]?.def ?? '').matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!).sort();
  // (Before the deepEqual: its assertion narrows the list to the TS keys, and '3d_plan' is not one.)
  assert.ok(sqlKeys.includes('plan_3d'), 'the Toolkit’s 3D key');
  assert.ok(!sqlKeys.includes('3d_plan'), 'the old key is gone');
  assert.deepEqual(sqlKeys, [...TOOL_USAGE_KEYS].sort());
});

/** A booked event for this shop: returns the booking's vendor_id (event_vendors). */
async function booking(vpid: string): Promise<{ eventId: string; bookingId: string }> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('An event','birthday','2030-08-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  const host = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host.rows[0]!.id]);
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','A Shop','contracted',$2,50000) RETURNING vendor_id`,
    [eventId, vpid],
  );
  return { eventId, bookingId: ev.rows[0]!.vendor_id };
}

async function saveChallenge(vpid: string) {
  const b = await booking(vpid);
  await db.query(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, vendor_id, prompt) VALUES ($1, 'vendor_booth', 'vendor', $2, 'Show us the pour')`,
    [b.eventId, b.bookingId],
  );
}

async function save3dPlan(vpid: string) {
  const b = await booking(vpid);
  await db.query(`INSERT INTO public.event_vendor_booth_posters (event_id, vendor_profile_id, poster_ref) VALUES ($1, $2, 'r2://setnayan-media/p.png')`, [b.eventId, vpid]);
}

async function grandfathered(vpid: string): Promise<Array<{ service_key: string; requested_total_php: number; status: string; payment_method_key: string | null }>> {
  const r = await db.query<{ service_key: string; requested_total_php: number; status: string; payment_method_key: string | null }>(
    `SELECT service_key, requested_total_php::float AS requested_total_php, status::text AS status, payment_method_key
       FROM public.orders WHERE vendor_profile_id = $1 AND payment_method_key = 'grandfathered' ORDER BY service_key`,
    [vpid],
  );
  return r.rows;
}

test('3 · grandfathering (5bfefe76): saved work on a live paid plan becomes an owned, zero-total widget — once, and still plan-gated', async () => {
  const later = new Date(Date.now() + 20 * 864e5).toISOString();
  const pro = await newShop('pro', later);
  await saveChallenge(pro.vpid);
  await save3dPlan(pro.vpid);
  const plus3d = await newShop('solo', null);
  await save3dPlan(plus3d.vpid);
  const verified = await newShop('verified');
  await saveChallenge(verified.vpid);
  const lapsed = await newShop('pro', new Date(Date.now() - 864e5).toISOString());
  await save3dPlan(lapsed.vpid);
  const nothingSaved = await newShop('enterprise');
  const bought = await newShop('pro');
  await saveChallenge(bought.vpid);
  await order(bought.vpid, bought.ownerId, 'vendor_tool_papic_challenge', 'paid');

  assert.equal(await open(pro.vpid, 'papic_challenge'), false, 'before the grandfather rows, the plan alone opens nothing');
  await db.exec(GRANDFATHER_SQL);

  assert.deepEqual(
    (await grandfathered(pro.vpid)).map((o) => [o.service_key, o.requested_total_php, o.status]),
    [['vendor_tool_papic_challenge', 0, 'paid'], ['vendor_tool_plan_3d', 0, 'paid']],
    'a Pro shop with both saved: one zero-total owned row each',
  );
  assert.equal(await open(pro.vpid, 'papic_challenge'), true);
  assert.equal(await open(pro.vpid, 'plan_3d'), true);
  assert.deepEqual((await grandfathered(plus3d.vpid)).map((o) => o.service_key), ['vendor_tool_plan_3d'], 'an open-ended Plus with a saved 3D plan');
  assert.deepEqual(await grandfathered(verified.vpid), [], 'Verified is not on a paid plan: nothing');
  assert.deepEqual(await grandfathered(lapsed.vpid), [], 'a lapsed plan: nothing');
  assert.deepEqual(await grandfathered(nothingSaved.vpid), [], 'no saved work: nothing');
  assert.deepEqual(await grandfathered(bought.vpid), [], 'already bought: nothing new');

  await db.exec(GRANDFATHER_SQL);
  assert.equal((await grandfathered(pro.vpid)).length, 2, 'a re-run writes nothing twice');

  await db.query(`UPDATE public.vendor_profiles SET tier_expires_at = NOW() - INTERVAL '1 minute' WHERE vendor_profile_id = $1`, [pro.vpid]);
  assert.equal(await open(pro.vpid, 'papic_challenge'), false, 'a grandfathered widget still locks off-plan (the plan lapsed)');
});
