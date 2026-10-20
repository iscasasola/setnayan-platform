/**
 * A SUPPLIER MOVES ONLY FOR ITS OWN COUPLE — the auth of `moveSupplierToCategory`
 * (owner 2026-10-20, "Move to another category" → "okay").
 *
 * The action is the card's other edits' auth, no more: a session, the write
 * under RLS, and off-platform rows only (`marketplace_vendor_id IS NULL`). These
 * are the action's own statements, run as a real session against the replayed
 * schema, with the values its shared plan (`planSupplierMove`) produces:
 *   1. the couple moves Dunkin' Donuts to Food Truck: ONE row comes back, and
 *      `category_key = 'food_truck'` is accepted by its foreign key (the row is a
 *      real `service_categories` tier-2 id);
 *   2. another couple's identical statement matches NO row and changes nothing —
 *      which is why the action reads the update back (a zero-row update is not
 *      a move);
 *   3. a supplier with a shop of their own (`marketplace_vendor_id` set) is not
 *      moved by the statement, even by their couple;
 *   4. a `category_key` the taxonomy does not have is refused by the database;
 *   5. the pending claim link is kept in step on the service role, and a
 *      stranger cannot touch it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { planSupplierMove, type SupplierMovePlan } from '../../lib/move-supplier-category';
import { coverKeyForTile } from '../../lib/shortlist-taxonomy';

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
const uniq = () => `move-${++seq}-${Date.now()}`;

async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asService() {
  await reset();
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  await db.exec(`SET ROLE service_role`);
}

async function newCouple(): Promise<{ couple: string; eventId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const couple = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1,'wedding','civil','garden') RETURNING event_id`,
    [`Wedding ${uniq()}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    eventId,
    couple,
  ]);
  return { couple, eventId };
}

/** Dunkin' typed in by hand under Everything else, with Food Truck ticked as "also covers". */
async function addDunkin(couple: string, eventId: string): Promise<string> {
  await asUser(couple);
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, vendor_name, category, status, covers_plan_groups, source, total_cost_php)
     VALUES ($1, 'Dunkin'' Donuts', 'misc', 'considering', ARRAY[$2], 'host_manual', 18000) RETURNING vendor_id`,
    [eventId, coverKeyForTile('food_truck')],
  );
  await reset();
  return r.rows[0]!.vendor_id;
}

const toFoodTruck = (): SupplierMovePlan => {
  const p = planSupplierMove({ category: 'misc', category_key: null, covers_plan_groups: [coverKeyForTile('food_truck')] }, 'food_truck');
  assert.ok(!('refused' in p));
  return p as SupplierMovePlan;
};

/** The action's update, statement for statement — returns the rows it read back. */
async function move(uid: string, eventId: string, vendorId: string, p: SupplierMovePlan): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ vendor_id: string }>(
    `UPDATE public.event_vendors
        SET category = $1::public.vendor_category, category_key = $2, covers_plan_groups = $3
      WHERE event_id = $4 AND vendor_id = $5 AND marketplace_vendor_id IS NULL
      RETURNING vendor_id`,
    [p.category, p.category_key, p.covers, eventId, vendorId],
  );
  await reset();
  return r.rows.length;
}

async function rowOf(vendorId: string) {
  await reset();
  return (
    await db.query<{ category: string; category_key: string | null; covers_plan_groups: string[]; total_cost_php: string }>(
      `SELECT category::text AS category, category_key, covers_plan_groups, total_cost_php::text AS total_cost_php
         FROM public.event_vendors WHERE vendor_id = $1`,
      [vendorId],
    )
  ).rows[0]!;
}

test('1 · the couple moves their own supplier — one row back, the key accepted, the price on the same row', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addDunkin(couple, eventId);
  const p = toFoodTruck();
  assert.equal(p.category_key, 'food_truck');
  assert.equal(await move(couple, eventId, v, p), 1, 'the couple’s move matched no row');
  const after = await rowOf(v);
  assert.deepEqual(
    { category: after.category, key: after.category_key, covers: after.covers_plan_groups, price: Number(after.total_cost_php) },
    { category: 'misc', key: 'food_truck', covers: [], price: 18000 },
  );
});

test('2 · another couple’s identical move matches nothing and changes nothing', async () => {
  const a = await newCouple();
  const b = await newCouple();
  const v = await addDunkin(a.couple, a.eventId);
  const before = await rowOf(v);
  assert.equal(await move(b.couple, a.eventId, v, toFoodTruck()), 0, 'a stranger moved another couple’s supplier');
  assert.deepEqual(await rowOf(v), before);
});

test('3 · a supplier with a shop of their own is not moved, even by their couple', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addDunkin(couple, eventId);
  await reset();
  const shopUser = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
      [`${uniq()}@shop.test`],
    )
  ).rows[0]!.id;
  const shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Dunkin'' Donuts PH')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
      [shopUser],
    )
  ).rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $1 WHERE vendor_id = $2`, [shop, v]);
  const before = await rowOf(v);
  assert.equal(await move(couple, eventId, v, toFoodTruck()), 0, 'a supplier with a shop was moved');
  assert.deepEqual(await rowOf(v), before);
});

test('4 · a category_key the taxonomy does not have is refused by the database', async () => {
  const { couple, eventId } = await newCouple();
  const v = await addDunkin(couple, eventId);
  await asUser(couple);
  await assert.rejects(
    db.query(`UPDATE public.event_vendors SET category_key = 'no_such_row' WHERE vendor_id = $1`, [v]),
    /foreign key|violates/i,
  );
  await reset();
});

test('5 · the pending claim link keeps step on the service role; a stranger cannot touch it', async () => {
  const a = await newCouple();
  const b = await newCouple();
  const v = await addDunkin(a.couple, a.eventId);
  await reset();
  const inviteId = (
    await db.query<{ id: string }>(
      `INSERT INTO public.vendor_invites (vendor_id, business_name, service_category, claim_token, source, status, expires_at)
       VALUES ($1, 'Dunkin'' Donuts', 'misc', $2, 'auto_share_link', 'pending', now() + interval '90 days') RETURNING invite_id AS id`,
      [v, `tok-${uniq()}`],
    )
  ).rows[0]!.id;

  // A stranger's session reaches no invite row.
  await asUser(b.couple);
  const stranger = await db.query(`UPDATE public.vendor_invites SET service_category = 'catering' WHERE vendor_id = $1 RETURNING invite_id`, [v]);
  assert.equal(stranger.rows.length, 0, 'a stranger rewrote another couple’s claim link');

  // The action's own statement, after the couple's move: service role, pending only.
  const p = planSupplierMove({ category: 'misc', category_key: null, covers_plan_groups: [] }, 'cake');
  assert.ok(!('refused' in p));
  const plan = p as SupplierMovePlan;
  assert.equal(await move(a.couple, a.eventId, v, plan), 1);
  await asService();
  const synced = await db.query(
    `UPDATE public.vendor_invites SET service_category = $1 WHERE vendor_id = $2 AND status = 'pending' RETURNING invite_id`,
    [plan.category, v],
  );
  assert.equal(synced.rows.length, 1);
  await reset();
  const inv = await db.query<{ service_category: string }>(`SELECT service_category FROM public.vendor_invites WHERE invite_id = $1`, [inviteId]);
  assert.equal(inv.rows[0]!.service_category, plan.category);
  assert.equal(plan.category, 'cake_maker', 'Cake is stored as cake_maker — the claim files the shop as a cake maker');
});
