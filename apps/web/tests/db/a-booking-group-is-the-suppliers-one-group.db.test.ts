/**
 * 🚪 "THEIR EVENT" — the booking group, the one-group read and the cap (migration 20271357741892), asserted against
 * the REPLAYED schema, every read through a real `authenticated` session.
 *
 * Owner 2026-11-21 (DECISION_LOG "'YES TO ALL'" (1)): *"a per-head booking … creates its own group in the hosts' guest
 * list, named for that supplier; the hosts and the coordinator fill it; the supplier sees ONLY that group"*; controller
 * call (3): a supplier never gets Payments or Memories, Budget at most View.
 *
 *   1 · a per-head row becoming BOOKED makes exactly one group named for the supplier, tied to the booking; a fixed-price
 *       booking makes none; booking again makes no second one; a host's own group of that name is never taken over;
 *   2 · the booked supplier reads ONLY their group — names, reply, diet — never another group's guest; a host is
 *       refused (is_host), a stranger is refused (not_booked), a booked supplier with no group gets no_group;
 *   3 · the cap: a supplier's seat holding Payments / Memories / Budget-at-edit resolves to nothing / nothing / view;
 *   4 · WHO ON THE SHOP'S TEAM reads the group (owner 2026-08-27: *"the staff who handles the event will handle the
 *       event fully but the vendor owner also has access to oversight all their business"*; controller ruling 22 Nov
 *       2026): the owner · a LIVE Shop Manager · the LIVE seat that handles this client (`chat_threads`
 *       `covering_member_id`, else `handled_by_member_id` — #8114). Nobody else: a paused seat, a live Helper and a
 *       live Account Manager with another client are each refused (`not_your_client`) and handed no guest.
 *
 * 🛡 Sabotage: answer `no_group` for a row WITH a group / read memberships without `gm.group_id = v_row.group_id` →
 *    test 2 red (another group's guest leaks); drop the cap's first WHEN → test 3 red. Test 4 names its own, case by
 *    case, beside each assert.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const W = { eventId: '', host: '', caterer: '', florist: '', stranger: '', catererShop: '', floristShop: '', catererRow: '', floristRow: '' };
/** Test 4's people on the caterer's team: account ids, and the seats (`vendor_team_member_id`) of the ones routed to. */
const T = { manager: '', pausedManager: '', handler: '', otherAm: '', helper: '', handlerSeat: '', otherAmSeat: '', thread: '' };

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
}
async function asUser<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}
async function newUser(email: string, type: 'customer' | 'vendor'): Promise<string> {
  return one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`, [email, type]);
}
async function shop(uid: string, name: string, services: string[]): Promise<string> {
  // A vendor account already has its profile (the signup trigger); otherwise make one.
  const existing = (await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [uid])).rows[0];
  const id = existing
    ? existing.vendor_profile_id
    : await one<string>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services) VALUES ($1, $2, 'Manila', $3::text[]) RETURNING vendor_profile_id AS v`,
        [uid, name, services],
      );
  await db.query(`UPDATE public.vendor_profiles SET business_name = $2, services = $3::text[] WHERE vendor_profile_id = $1`, [id, name, services]);
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`, [id]);
  return id;
}
async function guest(first: string, last: string, diet: string | null = null): Promise<string> {
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, dietary_restrictions) VALUES ($1, $2, $3, 'both', 'friends', $4) RETURNING guest_id AS v`,
    [W.eventId, first, last, diet],
  );
}
/** A seat on the caterer's team. `vendor_team_duty_rank_trg` derives the rank from the duty. */
async function seat(uid: string, duty: 'shop_manager' | 'account_manager' | 'helper'): Promise<string> {
  return one<string>(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty) VALUES ($1, $2, 'viewer', $3) RETURNING vendor_team_member_id AS v`,
    [W.catererShop, uid, duty],
  );
}
type GroupRead = { status: string; guests?: Array<{ name: string }> };
const readGroupAs = (uid: string) => asUser<GroupRead>(uid, `SELECT public.supplier_booking_group($1) AS v`, [W.eventId]);
/** Refused AND handed nothing: the status, and not one guest's name anywhere in what came back. */
async function assertRefused(uid: string, who: string): Promise<void> {
  const r = await readGroupAs(uid);
  assert.equal(r.status, 'not_your_client', `${who} read the booking's guest group: ${JSON.stringify(r)}`);
  assert.ok(!/Reyes|Marco|Lorna/.test(JSON.stringify(r)), `${who} was handed a guest's name`);
}
async function assertReads(uid: string, who: string): Promise<void> {
  const r = await readGroupAs(uid);
  assert.equal(r.status, 'ok', `${who} does not read the booking's guest group: ${JSON.stringify(r)}`);
  assert.deepEqual((r.guests ?? []).map((g) => g.name).sort(), ['Ana Reyes', 'Marco Go'], `${who} reads the wrong guests`);
}
async function groupsOf(vendorRow: string): Promise<Array<{ label: string }>> {
  return (await db.query<{ label: string }>(`SELECT label FROM public.guest_groups WHERE event_vendor_id = $1`, [vendorRow])).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  W.host = await newUser('beg-host@group.test', 'customer');
  W.caterer = await newUser('beg-caterer@group.test', 'vendor');
  W.florist = await newUser('beg-florist@group.test', 'vendor');
  W.stranger = await newUser('beg-stranger@group.test', 'vendor');
  W.catererShop = await shop(W.caterer, 'Kusina Catering', ['catering']);
  W.floristShop = await shop(W.florist, 'Bloom & Vine', ['florist']);
  W.eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Claire & Indalecio', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [W.eventId, W.host]);
  // The hosts already have a group with the caterer's name — the booking must not take it over.
  await db.query(`INSERT INTO public.guest_groups (event_id, label) VALUES ($1, 'Kusina Catering')`, [W.eventId]);
  W.catererRow = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, pricing_basis, pax_quote_base)
     VALUES ($1, 'catering', 'Kusina Catering', 'considering', $2, 150000, 'per_pax', 120) RETURNING vendor_id AS v`,
    [W.eventId, W.catererShop],
  );
  W.floristRow = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1, 'florist', 'Bloom & Vine', 'considering', $2, 60000) RETURNING vendor_id AS v`,
    [W.eventId, W.floristShop],
  );
});

after(async () => {
  await replay?.db.close();
});

test('1 · a per-head booking makes ONE group named for the supplier; a fixed price makes none', async () => {
  assert.equal((await groupsOf(W.catererRow)).length, 0, 'a group before the booking');
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [W.catererRow]);
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [W.floristRow]);
  const groups = await groupsOf(W.catererRow);
  assert.equal(groups.length, 1, 'the per-head booking made no group (or two)');
  assert.equal(groups[0]!.label, 'Kusina Catering · booking', 'the hosts’ own group of that name was taken over');
  assert.equal((await groupsOf(W.floristRow)).length, 0, 'a fixed-price booking made a group');
  await db.query(`UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`, [W.catererRow]);
  assert.equal((await groupsOf(W.catererRow)).length, 1, 'booking further made a second group');
});

test('2 · the supplier reads ONLY their group; a host, a stranger, a supplier with no group are refused', async () => {
  const groupId = await one<string>(`SELECT group_id AS v FROM public.guest_groups WHERE event_vendor_id = $1`, [W.catererRow]);
  const otherGroup = await one<string>(`SELECT group_id AS v FROM public.guest_groups WHERE event_id = $1 AND event_vendor_id IS NULL`, [W.eventId]);
  const ana = await guest('Ana', 'Reyes', 'no pork');
  const marco = await guest('Marco', 'Go');
  const secret = await guest('Tita', 'Lorna');
  await db.query(`INSERT INTO public.guest_group_memberships (group_id, guest_id) VALUES ($1, $2), ($1, $3), ($4, $5)`, [groupId, ana, marco, otherGroup, secret]);

  const r = await asUser<{ status: string; label: string; booked: number; guests: Array<{ name: string; diet: string | null }> }>(
    W.caterer, `SELECT public.supplier_booking_group($1) AS v`, [W.eventId],
  );
  assert.equal(r.status, 'ok', JSON.stringify(r));
  assert.equal(r.label, 'Kusina Catering · booking');
  assert.equal(r.booked, 120);
  assert.deepEqual(r.guests.map((g) => g.name).sort(), ['Ana Reyes', 'Marco Go']);
  assert.ok(!JSON.stringify(r).includes('Lorna'), 'another group’s guest reached the supplier');
  assert.equal(r.guests.find((g) => g.name === 'Ana Reyes')!.diet, 'no pork');

  assert.equal((await asUser<{ status: string }>(W.host, `SELECT public.supplier_booking_group($1) AS v`, [W.eventId])).status, 'is_host');
  assert.equal((await asUser<{ status: string }>(W.stranger, `SELECT public.supplier_booking_group($1) AS v`, [W.eventId])).status, 'not_booked');
  assert.equal((await asUser<{ status: string }>(W.florist, `SELECT public.supplier_booking_group($1) AS v`, [W.eventId])).status, 'no_group');
});

test('3 · the cap — a supplier’s seat never opens Payments or Memories, Budget at most View', async () => {
  await db.query(
    `INSERT INTO public.event_moderators (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, 'wedding_planner_external', $2::jsonb, $3, $4, now())`,
    [W.eventId, JSON.stringify({ edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { payments: 'view', photos: 'view', budget: 'edit', mood_board: 'edit' } }), W.host, W.florist],
  );
  const lvl = (area: string) => asUser<string | null>(W.florist, `SELECT public.moderator_area_level($1, $2) AS v`, [W.eventId, area]);
  assert.equal(await lvl('payments'), null, 'a supplier opens Payments');
  assert.equal(await lvl('photos'), null, 'a supplier opens Memories');
  assert.equal(await lvl('budget'), 'view', 'a supplier edits the budget');
  assert.equal(await lvl('mood_board'), 'view', 'a supplier writes the Mood Board');
  const of = (area: string) => one<string | null>(`SELECT public.moderator_area_level_of($1, $2, $3) AS v`, [W.eventId, W.florist, area]);
  assert.equal(await of('payments'), null);
  assert.equal(await of('photos'), null);
});

test('4 · on the shop’s team, ONLY the owner, a live Shop Manager and the live seat that handles this client read the group', async () => {
  for (const k of ['manager', 'pausedManager', 'handler', 'otherAm', 'helper'] as const) T[k] = await newUser(`beg-${k.toLowerCase()}@group.test`, 'vendor');
  await seat(T.manager, 'shop_manager');
  const pausedManagerSeat = await seat(T.pausedManager, 'shop_manager');
  T.handlerSeat = await seat(T.handler, 'account_manager');
  T.otherAmSeat = await seat(T.otherAm, 'account_manager');
  await seat(T.helper, 'helper');
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [pausedManagerSeat]);
  // The client = the (event, shop) conversation; #8114 routed it to ONE Account Manager.
  T.thread = await one<string>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3) RETURNING thread_id AS v`,
    [W.eventId, W.catererShop, W.host],
  );
  await db.query(`UPDATE public.chat_threads SET handled_by_member_id = $2, handled_by_set_at = now() WHERE thread_id = $1`, [T.thread, T.handlerSeat]);

  // (a) THE OWNER reads it AS THE OWNER (`vendor_profiles.user_id`), not through a seat. The sign-up hands a founder a
  //     Shop Manager seat as well, so that seat is paused for this one read — branch (b) cannot be what answers.
  //     🛡 drop `vp.user_id = v_uid` from the reader rule → red.
  const founderSeats = await db.query(
    `UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_profile_id = $1 AND user_id = $2 RETURNING vendor_team_member_id`,
    [W.catererShop, W.caterer],
  );
  await assertReads(W.caterer, 'the shop’s owner (their own seat paused)');
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NULL WHERE vendor_profile_id = $1 AND user_id = $2`, [W.catererShop, W.caterer]);
  assert.ok(founderSeats.rows.length <= 1, 'the founder holds more than one seat on their own shop');
  await assertReads(W.caterer, 'the shop’s owner');
  // (b) A LIVE SHOP MANAGER reads it. 🛡 drop the `current_vendor_duty_ids('shop_manager')` line → red.
  await assertReads(T.manager, 'a live Shop Manager');
  // (c) THE HANDLER reads it. 🛡 drop the `chat_threads` EXISTS (branch c) → red.
  await assertReads(T.handler, 'the Account Manager who handles this client');

  // A LIVE member who is neither: a Helper, and an Account Manager with another client.
  // 🛡 put back the old `OR EXISTS (SELECT 1 FROM vendor_team_members tm WHERE tm.vendor_profile_id = vp.vendor_profile_id
  //    AND tm.user_id = v_uid)` (every team member reads) → both red.
  await assertRefused(T.helper, 'a live Helper');
  await assertRefused(T.otherAm, 'a live Account Manager who does not handle this client');

  // A PAUSED Shop Manager. 🛡 replace the helper line with a bare `tm.duty = 'shop_manager'` EXISTS that forgets
  //    `deactivated_at IS NULL` → red.
  await assertRefused(T.pausedManager, 'a paused Shop Manager');

  // THE HANDLER'S SEAT IS PAUSED, and nobody covers yet: the paused seat does not read it.
  // 🛡 drop `AND tm.deactivated_at IS NULL` from the chat_threads EXISTS → red.
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [T.handlerSeat]);
  await assertRefused(T.handler, 'the handler, while their seat is paused');

  // …and the COVER reads it while the handler is away (#8013 (g)). 🛡 read `t.handled_by_member_id` alone instead of
  //    `COALESCE(t.covering_member_id, t.handled_by_member_id)` → the cover's read turns red.
  await db.query(`UPDATE public.chat_threads SET covering_member_id = $2 WHERE thread_id = $1`, [T.thread, T.otherAmSeat]);
  await assertReads(T.otherAm, 'the Account Manager covering while the handler is paused');
  await assertRefused(T.handler, 'the paused handler, while somebody covers');

  // The handler returns: the cover is cleared (lib/seat-pause.server.ts) and reads no more; the handler reads again.
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NULL WHERE vendor_team_member_id = $1`, [T.handlerSeat]);
  await db.query(`UPDATE public.chat_threads SET covering_member_id = NULL WHERE thread_id = $1`, [T.thread]);
  await assertReads(T.handler, 'the handler, back from a pause');
  await assertRefused(T.otherAm, 'the cover, after the handler is back');

  // The client moves to the other Account Manager (Handled by ▾): the read moves with it.
  await db.query(`UPDATE public.chat_threads SET handled_by_member_id = $2 WHERE thread_id = $1`, [T.thread, T.otherAmSeat]);
  await assertReads(T.otherAm, 'the client’s new Account Manager');
  await assertRefused(T.handler, 'the Account Manager the client was moved away from');

  // Nobody outside the shop gained anything: a stranger is still not booked, a host is still a host.
  assert.equal((await readGroupAs(W.stranger)).status, 'not_booked');
  assert.equal((await readGroupAs(W.host)).status, 'is_host');
});
