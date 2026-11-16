/**
 * ⏸ A SHOP CAN BE PAUSED OR CLOSED — BY ITS TEAM AND BY SETNAYAN (owner 2026-10-31 *"They can pause and close.
 * Admin can also do that"*; 2026-11-16 "AN ADMIN-HIDDEN SHOP IS PAUSED FOR EVERYTHING NEW"; migration
 * 20271350091032_a_shop_can_be_paused_or_closed.sql).
 *
 * Fails if:
 *   1 · a paused shop (verified OR unverified) is still findable, or can be ASKED or BOOKED;
 *   2 · a booking or an ask that existed before the pause stops working, or its chat stops talking;
 *   3 · reopening does not restore findable + bookable;
 *   4 · a shop's own session can write paused_at / paused_by directly (only the door may);
 *   5 · a shop can lift a pause Setnayan set, or a stranger / a viewer of the team can pause;
 *   6 · a team admin can close, or the owner can close with an open booking, or a closed shop is not archived
 *       (never findable, never bookable), or a closed shop reopens through the door;
 *   7 · anon can read the pause columns.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [`shop-status-${n}@test.local`],
  );
  return u.rows[0]!.id;
}

async function newShop(state: 'verified' | 'unverified' = 'verified'): Promise<{ shop: string; owner: string }> {
  const owner = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Shop Status Shop', 'Manila', ARRAY['photography']::text[], $2::public.vendor_verification_state,
             CASE WHEN $2 = 'verified' THEN NOW() END,
             (CASE WHEN $2 = 'verified' THEN 'verified' ELSE 'hidden' END)::public.vendor_public_visibility)
     RETURNING vendor_profile_id`,
    [owner, state],
  );
  return { shop: v.rows[0]!.vendor_profile_id, owner };
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Shop Status Event', 'birthday') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}

async function attempt(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function as<T>(uid: string | null, fn: () => Promise<T>, role: 'authenticated' | 'anon' = 'authenticated'): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

/** Calls the door as `uid`; returns the new status, or the refusal message. */
async function setStatus(uid: string, shop: string, status: string): Promise<string> {
  return as(uid, async () => {
    try {
      const r = await db.query<{ s: string }>(`SELECT public.set_shop_status($1::uuid, $2) AS s`, [shop, status]);
      return r.rows[0]!.s;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  });
}

async function newAdmin(): Promise<string> {
  const uid = await newUser();
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [uid]);
  const ok = await as(uid, async () => (await db.query<{ a: boolean }>(`SELECT public.is_admin() AS a`)).rows[0]!.a);
  assert.equal(ok, true, 'test setup: could not make an admin');
  return uid;
}

async function addTeam(shop: string, role: 'admin' | 'viewer'): Promise<string> {
  const uid = await newUser();
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, $3)`, [shop, uid, role]);
  return uid;
}

const findable = async (shop: string) =>
  (await db.query<{ f: boolean }>(`SELECT is_findable AS f FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop])).rows[0]!.f;
const book = async (shop: string) =>
  attempt(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2)`,
    [await newEvent(), shop],
  );
const askOnInsert = async (shop: string) =>
  attempt(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, lock_request_state, lock_requested_at)
     VALUES ($1, 'photographer', 'A Shop', 'considering', $2, 'pending', NOW())`,
    [await newEvent(), shop],
  );

test('1 · a paused shop — verified or not — is in no list and takes no new ask or booking', async () => {
  for (const state of ['verified', 'unverified'] as const) {
    const { shop, owner } = await newShop(state);
    assert.equal(await setStatus(owner, shop, 'paused'), 'paused');
    assert.equal(await findable(shop), false, `${state}: a paused shop is still findable`);
    assert.match(String(await book(shop)), /vendor_not_verified: .*reason=paused/, `${state}: a paused shop was booked`);
    assert.match(String(await askOnInsert(shop)), /reason=paused/, `${state}: a paused shop was asked`);
    const by = await db.query<{ paused_by: string }>(`SELECT paused_by FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]);
    assert.equal(by.rows[0]!.paused_by, 'supplier');
  }
});

test('2 · a booking and an ask made BEFORE the pause keep working, and their chat still talks', async () => {
  const { shop, owner } = await newShop('verified');
  const couple = await newUser();
  const ev = await newEvent();
  const booked = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2) RETURNING vendor_id`,
    [ev, shop],
  );
  const asked = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, lock_request_state, lock_requested_at)
     VALUES ($1, 'photographer', 'A Shop', 'considering', $2, 'pending', NOW()) RETURNING vendor_id`,
    [await newEvent(), shop],
  );
  const thread = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [ev, shop, couple],
  );
  assert.equal(await setStatus(owner, shop, 'paused'), 'paused');
  assert.equal(
    await attempt(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [booked.rows[0]!.vendor_id]),
    null,
    'an existing booking stopped advancing',
  );
  assert.equal(
    await attempt(`UPDATE public.event_vendors SET notes = 'still asking' WHERE vendor_id = $1`, [asked.rows[0]!.vendor_id]),
    null,
    'an existing ask stopped being editable',
  );
  assert.equal(
    await attempt(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
       VALUES ($1, $2, $3, $4, 'couple', 'still here?')`,
      [thread.rows[0]!.thread_id, ev, shop, couple],
    ),
    null,
    'the chat of an existing booking stopped talking',
  );
});

test('3 · reopening restores findable and bookable', async () => {
  const { shop, owner } = await newShop('verified');
  assert.equal(await setStatus(owner, shop, 'paused'), 'paused');
  assert.equal(await setStatus(owner, shop, 'open'), 'open');
  assert.equal(await findable(shop), true);
  assert.equal(await book(shop), null);
});

test('4 · a shop cannot write its own pause columns — only the door can', async () => {
  const { shop, owner } = await newShop('verified');
  const err = await as(owner, () =>
    attempt(`UPDATE public.vendor_profiles SET paused_at = NOW(), paused_by = 'supplier' WHERE vendor_profile_id = $1`, [shop]),
  );
  assert.match(String(err), /set_shop_status|permission denied/, 'a session wrote paused_at directly');
  await setStatus(await newAdmin(), shop, 'paused');
  const lift = await as(owner, () =>
    attempt(`UPDATE public.vendor_profiles SET paused_at = NULL, paused_by = NULL WHERE vendor_profile_id = $1`, [shop]),
  );
  assert.match(String(lift), /set_shop_status|permission denied/, 'a session cleared an admin pause directly');
});

test('5 · only Setnayan lifts its own pause; strangers and team viewers cannot pause', async () => {
  const { shop, owner } = await newShop('unverified');
  const admin = await newAdmin();
  assert.equal(await setStatus(admin, shop, 'paused'), 'paused');
  assert.equal(await findable(shop), false);
  assert.match(String(await book(shop)), /reason=paused/, 'an admin-paused UNVERIFIED shop was booked (the #7828 gap)');
  assert.match(await setStatus(owner, shop, 'open'), /shop_status:paused_by_setnayan/);
  // The shop pressing Pause again does not downgrade Setnayan's pause.
  assert.equal(await setStatus(owner, shop, 'paused'), 'paused');
  const by = await db.query<{ paused_by: string }>(`SELECT paused_by FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]);
  assert.equal(by.rows[0]!.paused_by, 'admin');
  assert.equal(await setStatus(admin, shop, 'open'), 'open');

  const stranger = await newUser();
  assert.match(await setStatus(stranger, shop, 'paused'), /shop_status:not_allowed/);
  const viewer = await addTeam(shop, 'viewer');
  assert.match(await setStatus(viewer, shop, 'paused'), /shop_status:not_allowed/);
  const teamAdmin = await addTeam(shop, 'admin');
  assert.equal(await setStatus(teamAdmin, shop, 'paused'), 'paused', 'a team admin could not pause');
  assert.equal(await setStatus(teamAdmin, shop, 'open'), 'open');
  assert.match(await setStatus(owner, shop, 'sleeping'), /shop_status:bad_status/);
});

test('6 · close: owner only, open bookings first; closed = archived, never found or booked, not reopened here', async () => {
  const { shop, owner } = await newShop('verified');
  const teamAdmin = await addTeam(shop, 'admin');
  assert.match(await setStatus(teamAdmin, shop, 'closed'), /shop_status:owner_only/);

  const booked = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2) RETURNING vendor_id`,
    [await newEvent(), shop],
  );
  assert.match(await setStatus(owner, shop, 'closed'), /shop_status:open_bookings:1/);
  await db.query(`UPDATE public.event_vendors SET status = 'complete' WHERE vendor_id = $1`, [booked.rows[0]!.vendor_id]);

  await setStatus(owner, shop, 'paused');
  assert.equal(await setStatus(owner, shop, 'closed'), 'closed');
  const row = await db.query<{ v: string; paused_at: string | null; f: boolean }>(
    `SELECT public_visibility::text AS v, paused_at, is_findable AS f FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(row.rows[0]!.v, 'archived');
  assert.equal(row.rows[0]!.paused_at, null, 'a close leaves the pause behind');
  assert.equal(row.rows[0]!.f, false);
  assert.match(String(await book(shop)), /reason=not_listed/);
  assert.match(await setStatus(owner, shop, 'open'), /shop_status:closed/);
  assert.match(await setStatus(owner, shop, 'paused'), /shop_status:closed/);

  // Setnayan may close a shop with an open booking (its existing archive does too).
  const other = await newShop('verified');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'A Shop', 'contracted', $2)`,
    [await newEvent(), other.shop],
  );
  assert.equal(await setStatus(await newAdmin(), other.shop, 'closed'), 'closed');
});

test('7 · anon cannot read the pause columns; the door is not anon-callable', async () => {
  const { shop } = await newShop('verified');
  const read = await as(null, () => attempt(`SELECT paused_at FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]), 'anon');
  assert.match(String(read), /permission denied/);
  const call = await as(null, () => attempt(`SELECT public.set_shop_status($1::uuid, 'paused')`, [shop]), 'anon');
  assert.match(String(call), /permission denied/);
});
