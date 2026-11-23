/**
 * 🧰 THE TOOLKIT — migration 20271360126307, executed against the replayed migrations (owner 23 Nov 2026).
 *
 *   1 · `vendor_store_tool_open` = BOUGHT ONCE, nothing else (owner via the controller: "Yes, guides only" — no trial).
 *       A paid or fulfilled order for `vendor_tool_<key>` opens it; a submitted one, another shop's, another widget's,
 *       or a refund does not. Verified alone opens nothing.
 *   2 · ONE WIDGET KEY: the usage log takes `plan_3d` (the Toolkit's key, its SKU `vendor_tool_plan_3d`) and refuses the
 *       old `3d_plan`; the TS list `TOOL_USAGE_KEYS` matches the CHECK (also pinned in specialized-tools-unlock 4f).
 *
 * SABOTAGE (23 Nov, against the replayed migrations, then reverted):
 *   · `o.status IN ('paid', 'fulfilled')` widened to include 'submitted' → 1 RED.
 *   · the § 6 CHECK swap left out → 2 RED (plan_3d refused).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { TOOL_USAGE_KEYS } from '../../lib/specialized-tools-access';

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

async function newShop(): Promise<{ vpid: string; ownerId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  const ownerId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, tier_state, public_visibility)
     VALUES ($1, $2, 'Manila', ARRAY['live_band']::text[], 'verified'::vendor_verification_state, NOW(),
             'verified'::vendor_tier_state, 'verified'::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [ownerId, `Shop ${uniq()}`],
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

test('1 · a paid widget opens only when bought once — Verified alone, a submitted order or a refund open nothing', async () => {
  const a = await newShop();
  const b = await newShop();
  assert.equal(await open(a.vpid, 'song_bank'), false, 'a Verified shop with no order: shut (no trial)');

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
