/**
 * A SERVICE ON PLAN HOLD STAYS HELD — against a replayed schema (20271320474333_a_plan_hold_keeps_extra_services.sql).
 *
 * Owner 2026-11-06 (specs-repo DECISION_LOG): 🧭 SERVICES LIFE CYCLE · 📉 A DOWNGRADE PUTS EXTRA SERVICES ON HOLD —
 * THE SUPPLIER PICKS WHICH STAY ON · 🧮 … A PLAN PICKER WITH SWAP. Each case asserts a VALUE both ways:
 *   · every service stays on THROUGH the first booking — a Free pick for "now" is refused until a booking of this
 *     shop is marked delivered (the shipped fact, read by `vendor_first_booking_done`, never counted);
 *   · after it, the pick puts the rest ON HOLD: hidden (a couple cannot read it), never deleted, and the shop can
 *     neither lift the hold nor switch a held card live;
 *   · a held card takes no booking: the yes is refused with service_on_hold, the ask stays open;
 *   · verified AND upgraded → the held cards come back, to the switch they had;
 *   · a downgrade pick schedules the rest; when the lower plan starts they go on hold;
 *   · a browser cannot call the pick or the first-booking read (service_role only).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { shopUser: '', couple: '', shop: '', bandA: '', bandB: '', lights: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function refused(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

type CardState = { is_active: boolean; plan_hold: string | null; plan_hold_starts_on: string | null; plan_hold_returns_on: string | null; plan_hold_was_live: boolean | null };
async function cardState(id: string): Promise<CardState> {
  const r = await db.query<CardState>(
    `SELECT is_active, plan_hold, plan_hold_starts_on::text, plan_hold_returns_on::text, plan_hold_was_live
       FROM public.vendor_services WHERE vendor_service_id = $1`,
    [id],
  );
  assert.equal(r.rows.length, 1, 'the card under test does not exist — the case proved nothing');
  return r.rows[0]!;
}
async function coupleSees(id: string): Promise<boolean> {
  return as(F.couple, async () => (await db.query(`SELECT 1 FROM public.vendor_services WHERE vendor_service_id = $1`, [id])).rows.length === 1);
}
async function pick(plan: string, keep: string[], returnsOn: string): Promise<Record<string, unknown>> {
  return asService(async () => {
    const r = await db.query<{ j: Record<string, unknown> }>(
      `SELECT public.apply_service_plan_pick($1, $2::public.vendor_tier_state, $3::uuid[], $4::public.vendor_tier_state) AS j`,
      [F.shop, plan, keep, returnsOn],
    );
    return r.rows[0]!.j;
  });
}
async function firstBookingDone(): Promise<boolean> {
  return asService(async () => (await db.query<{ v: boolean }>(`SELECT public.vendor_first_booking_done($1) AS v`, [F.shop])).rows[0]!.v);
}
async function newCard(category: string, title: string): Promise<string> {
  const id = (
    await db.query<{ id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active, starting_price_php, primary_photo_r2_key)
       VALUES ($1, $2, $3, false, 30000, 'r2://media/vendors/hold/cover.webp') RETURNING vendor_service_id AS id`,
      [F.shop, category, title],
    )
  ).rows[0]!.id;
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, 'Sound system')`,
    [id, F.shop],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [id]);
  return id;
}
/** One couple's ask for one service — each on its own event (one marketplace pick per shop per event). */
async function newAsk(serviceId: string): Promise<string> {
  const event = (
    await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Hold Event', 'birthday') RETURNING event_id`)
  ).rows[0]!.event_id;
  return (
    await db.query<{ id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, 'photographer', 'Hold Band', 'considering'::public.vendor_status, $2, $3) RETURNING vendor_id AS id`,
      [event, F.shop, serviceId],
    )
  ).rows[0]!.id;
}
async function rowStatus(eventVendorId: string): Promise<string> {
  return (await db.query<{ s: string }>(`SELECT status::text AS s FROM public.event_vendors WHERE vendor_id = $1`, [eventVendorId])).rows[0]!.s;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('hold-couple@hold.test', 'customer');
  F.shopUser = await mkUser('hold-shop@hold.test', 'vendor');
  F.shop = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Hold Studio')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.shopUser],
    )
  ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility, tier_state = 'free'::public.vendor_tier_state
      WHERE vendor_profile_id = $1`,
    [F.shop],
  );
  F.bandA = await newCard('live_band', 'Garden Band');
  F.bandB = await newCard('live_band', 'Acoustic Duo');
  F.lights = await newCard('lights_and_sound', 'Stage Lights');
});
after(async () => {
  await db?.close();
});

test('1 · sign-up: every service is on, a couple can read all three, and nothing is on hold (the case can fail)', async () => {
  for (const id of [F.bandA, F.bandB, F.lights]) {
    const c = await cardState(id);
    assert.equal(c.is_active, true);
    assert.equal(c.plan_hold, null);
    assert.equal(await coupleSees(id), true);
  }
});

test('2 · the shop cannot put a card on hold, or start one on hold — the plan does that', async () => {
  const upd = await refused(() =>
    as(F.shopUser, () => db.query(`UPDATE public.vendor_services SET plan_hold = 'scheduled', plan_hold_starts_on = 'free' WHERE vendor_service_id = $1`, [F.bandB])),
  );
  assert.match(String(upd), /plan_hold_is_the_plans/);
  const ins = await refused(() =>
    as(F.shopUser, () =>
      db.query(
        `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active, plan_hold, plan_hold_was_live, plan_held_at)
         VALUES ($1, 'live_band', 'Sneaky', false, 'held', true, NOW())`,
        [F.shop],
      ),
    ),
  );
  assert.match(String(ins), /plan_hold_is_the_plans/);
});

test('3 · a browser cannot call the pick or the first-booking read', async () => {
  const p = await refused(() =>
    as(F.shopUser, () => db.query(`SELECT public.apply_service_plan_pick($1, 'free', ARRAY[$2]::uuid[], 'solo')`, [F.shop, F.bandA])),
  );
  assert.match(String(p), /permission denied/);
  const r = await refused(() => as(F.shopUser, () => db.query(`SELECT public.vendor_first_booking_done($1)`, [F.shop])));
  assert.match(String(r), /permission denied/);
});

test('4 · THROUGH the first booking everything stays on: a Free pick for now is refused until a booking is delivered', async () => {
  assert.equal(await firstBookingDone(), false);
  const j = await pick('free', [F.bandA], 'solo');
  assert.equal(j.status, 'first_booking_not_done');
  for (const id of [F.bandB, F.lights]) assert.equal((await cardState(id)).plan_hold, null, 'nothing went on hold');
  // A booking that is only contracted is not "done".
  const contracted = await newAsk(F.bandA);
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [contracted]);
  assert.equal(await firstBookingDone(), false, 'contracted is not delivered');
  await db.query(`UPDATE public.event_vendors SET status = 'delivered' WHERE vendor_id = $1`, [contracted]);
  assert.equal(await firstBookingDone(), true, 'the delivered booking is the first booking');
});

test('5 · after it, the pick keeps one on and puts the rest on hold — hidden, never deleted, not switchable by the shop', async () => {
  const j = await pick('free', [F.bandA], 'solo');
  assert.equal(j.status, 'ok');
  assert.equal(j.mode, 'now');
  assert.equal(j.held, 2);
  assert.equal((await cardState(F.bandA)).is_active, true);
  for (const id of [F.bandB, F.lights]) {
    const c = await cardState(id);
    assert.equal(c.plan_hold, 'held');
    assert.equal(c.is_active, false);
    assert.equal(c.plan_hold_was_live, true, 'the switch it had is remembered');
    assert.equal(c.plan_hold_returns_on, 'solo');
    assert.equal(await coupleSees(id), false, 'a couple cannot read a held card');
  }
  assert.equal(await coupleSees(F.bandA), true);
  const live = await refused(() => as(F.shopUser, () => db.query(`UPDATE public.vendor_services SET is_active = true WHERE vendor_service_id = $1`, [F.bandB])));
  assert.match(String(live), /service_on_hold/);
  const lift = await refused(() =>
    as(F.shopUser, () =>
      db.query(
        `UPDATE public.vendor_services SET plan_hold = NULL, plan_hold_returns_on = NULL, plan_hold_was_live = NULL, plan_held_at = NULL WHERE vendor_service_id = $1`,
        [F.bandB],
      ),
    ),
  );
  assert.match(String(lift), /plan_hold_is_the_plans/);
  assert.equal((await cardState(F.bandB)).plan_hold, 'held');
});

test('6 · a held service takes no booking: the yes is refused, the ask stays open; a kept service books', async () => {
  const held = await newAsk(F.bandB);
  const err = await refused(() => db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [held]));
  assert.match(String(err), /service_on_hold/);
  assert.equal(await rowStatus(held), 'considering', 'the couple still waits on the supplier');
  const kept = await newAsk(F.bandA);
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [kept]);
  assert.equal(await rowStatus(kept), 'contracted');
});

test('7 · verified AND upgraded: every held card comes back, to the switch it had', async () => {
  for (const id of [F.bandB, F.lights]) assert.equal((await cardState(id)).plan_hold, 'held', 'precondition: case 5 held them');
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'solo' WHERE vendor_profile_id = $1`, [F.shop]);
  for (const id of [F.bandB, F.lights]) {
    const c = await cardState(id);
    assert.equal(c.plan_hold, null);
    assert.equal(c.is_active, true);
    assert.equal(await coupleSees(id), true);
  }
});

test('8 · a downgrade pick schedules the rest; when the lower plan starts they go on hold', async () => {
  await db.query(`UPDATE public.vendor_profiles SET pending_tier = 'free' WHERE vendor_profile_id = $1`, [F.shop]);
  const j = await pick('free', [F.lights], 'solo');
  assert.equal(j.status, 'ok');
  assert.equal(j.mode, 'at_plan_change');
  for (const id of [F.bandA, F.bandB]) {
    const c = await cardState(id);
    assert.equal(c.plan_hold, 'scheduled');
    assert.equal(c.plan_hold_starts_on, 'free');
    assert.equal(c.is_active, true, 'still on until the lower plan starts');
  }
  await db.exec(`
    BEGIN;
    SET LOCAL setnayan.allow_tier_downgrade = 'on';
    UPDATE public.vendor_profiles SET tier_state = 'free', pending_tier = NULL WHERE vendor_profile_id = '${F.shop}';
    COMMIT;
  `);
  for (const id of [F.bandA, F.bandB]) {
    const c = await cardState(id);
    assert.equal(c.plan_hold, 'held');
    assert.equal(c.is_active, false);
  }
  assert.equal((await cardState(F.lights)).is_active, true, 'the picked one stayed on');
});

test('9 · a pick may not name another shop’s card, nor a plan the shop is not moving to', async () => {
  const other = await db.query<{ id: string }>(`SELECT vendor_service_id AS id FROM public.vendor_services WHERE vendor_profile_id <> $1 LIMIT 1`, [F.shop]);
  if (other.rows[0]) assert.equal((await pick('free', [other.rows[0].id], 'solo')).status, 'not_your_card');
  const fake = '00000000-0000-4000-8000-0000000000ff';
  assert.equal((await pick('free', [fake], 'solo')).status, 'not_your_card');
  // Solo → Free is not a change this shop has scheduled: refused, nothing written.
  await db.query(`UPDATE public.vendor_profiles SET tier_state = 'solo' WHERE vendor_profile_id = $1`, [F.shop]);
  assert.equal((await pick('free', [F.lights], 'solo')).status, 'no_such_change');
});
