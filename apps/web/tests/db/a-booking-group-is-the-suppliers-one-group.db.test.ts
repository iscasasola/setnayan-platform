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
 *   3 · the cap: a supplier's seat holding Payments / Memories / Budget-at-edit resolves to nothing / nothing / view.
 *
 * 🛡 Sabotage: drop the `JOIN public.guest_groups g ON g.event_vendor_id = ev.vendor_id` → test 2 red (another group's
 *    guest leaks); drop the cap's first WHEN → test 3 red.
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
