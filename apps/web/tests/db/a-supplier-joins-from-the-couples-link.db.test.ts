/**
 * A SUPPLIER JOINS FROM THE COUPLE'S OWN LINK — walked end to end, in SQL.
 *
 * Owner, 2026-10-19: "have you tested an account and shop creation step?" →
 * "can't you test it first?". He adds his wedding coordinator by hand
 * (Suppliers → Add your own → Invite → share the link) and the coordinator
 * signs up from that link. Nobody had walked it. This file walks every
 * database step the app takes, in the order it takes them, and asserts what
 * the coordinator can and cannot do afterwards — under RLS, as themselves.
 *
 *   1. Add your own        — the HOST's session inserts the contact card
 *                            (`event_manual_vendors`) and the planning row
 *                            (`event_vendors`, status 'considering',
 *                            source 'host_manual') — `attachManualVendorToCategory`.
 *   2. Invite → link       — the HOST's session inserts the `auto_share_link`
 *                            invite — `ensureAutoShareInvite`.
 *   3. Opening the link    — service role reads it by token and stamps
 *                            `first_opened_at` — `fetchClaimLandingByToken`.
 *   4. Sign up as supplier — an `auth.users` row with account_type 'vendor';
 *                            the triggers make `public.users` and an EMPTY shop.
 *   5. Finalize            — `claim_ready_the_shop` (the fix), then
 *                            `applyClaimAutoLink`'s writes, then
 *                            `seatClaimedCoupleAsCustomer` on the supplier's
 *                            own session.
 *
 * 🔑 THE DEFECT THIS FOUND. Step 4's trigger means the supplier ALWAYS has a
 * shop by step 5, so the finalize page's "copy the couple's record onto a new
 * shop" branch never ran — the coordinator arrived nameless and in no category.
 * `claim_ready_the_shop` fills the blanks; the first test proves the trap is
 * real so this file cannot pass against a world where it is not.
 *
 * ⚖ WHAT THE CLAIM DOES NOT GIVE — asserted, not assumed. Editing ANY schedule
 * item is the coordinator's DELEGATE grant (`moderator_area_level(..,'schedule')
 * = 'edit'`, DECISION_LOG 2026-10-03 "Coordinator (The Day = Edit)"), which the
 * host gives in Event access / the coordinator invite — or which is auto-sent
 * when a booked coordinator's downpayment is marked. Joining from the link
 * makes them the couple's supplier and customer-of-record, not a delegate. The
 * test pins both halves: no edit on the claim alone, full add/edit/delete once
 * the grant exists, and a booked non-coordinator supplier never edits a block
 * that is not theirs.
 *
 * 🤝 SINCE 2026-10-20 the claim does not even link the record to the shop: it
 * raises ONE ask the couple approves (`claim_ask_for_access`), and the couple's
 * Approve (`answer_claim_access_request`) bonds the record and — for a
 * coordinator — gives the host-level seat (owner: "access to the event is
 * automatic but has an approval"). Test 4 walks both halves; the full matrix
 * is `a-claimed-supplier-asks-for-access.db.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
async function asUser(uid: string): Promise<void> {
  await asOwner();
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
/** The admin client: service_role claim, RLS bypassed (table owner). */
async function asServer(): Promise<void> {
  await asOwner();
  await setAuthRole('service_role');
}

async function signUp(email: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function newWedding(hostUid: string, name: string): Promise<string> {
  await asOwner();
  const e = await db.query<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
     VALUES ($1, 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
    [name],
  );
  const eventId = e.rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    eventId,
    hostUid,
  ]);
  return eventId;
}

/** Steps 1 + 2, on the HOST's own session (RLS on). Returns the claim token. */
async function hostAddsTheirOwnAndShares(
  hostUid: string,
  eventId: string,
  category: string,
  business: string,
): Promise<{ token: string; rowId: string }> {
  await asUser(hostUid);
  const card = await db.query<{ id: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number)
     VALUES ($1, $2, 'Tita Lorna', '09170000000') RETURNING manual_vendor_id AS id`,
    [eventId, business],
  );
  const row = await db.query<{ id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, manual_vendor_id, status, source)
     VALUES ($1, $2, $3, $4, 'considering', 'host_manual') RETURNING vendor_id AS id`,
    [eventId, category, business, card.rows[0]!.id],
  );
  const rowId = row.rows[0]!.id;
  // ensureAutoShareInvite: read for a live link first, then insert one.
  const live = await db.query(
    `SELECT invite_id FROM public.vendor_invites WHERE vendor_id = $1 AND source = 'auto_share_link' AND status = 'pending'`,
    [rowId],
  );
  assert.equal(live.rows.length, 0);
  const token = `claim-e2e-${++n}-${Math.random().toString(36).slice(2)}`;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
     VALUES ($1, $2, NULL, $3, $4, $5, 'pending', 'auto_share_link', now() + interval '90 days')`,
    [rowId, hostUid, business, category, token],
  );
  await asOwner();
  return { token, rowId };
}

/** Step 5 — the finalize page, statement for statement. */
async function finalize(supplierUid: string, token: string): Promise<string> {
  await asServer();
  // 1. claim_ready_the_shop (the fix) — replaces the find-or-create branch.
  const shop = (
    await db.query<{ s: string }>(`SELECT public.claim_ready_the_shop($1, $2) AS s`, [supplierUid, token])
  ).rows[0]!.s;
  // 2. applyClaimAutoLink
  const inv = (
    await db.query<{ invite_id: string; vendor_id: string; status: string }>(
      `SELECT invite_id, vendor_id, status::text AS status FROM public.vendor_invites WHERE claim_token = $1`,
      [token],
    )
  ).rows[0]!;
  assert.equal(inv.status, 'pending');
  // Since 2026-10-20 the claim ASKS — the bond waits for the couple's Approve.
  await db.query(`SELECT public.claim_ask_for_access($1, $2, $3)`, [inv.vendor_id, shop, supplierUid]);
  await db.query(
    `UPDATE public.vendor_invites
        SET status = 'claimed', claimed_at = now(), claimed_by_user_id = $2, claimed_vendor_profile_id = $3
      WHERE invite_id = $1`,
    [inv.invite_id, supplierUid, shop],
  );
  const ev = (
    await db.query<{ event_id: string }>(`SELECT event_id FROM public.event_vendors WHERE vendor_id = $1`, [
      inv.vendor_id,
    ])
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.vendor_follows (follower_user_id, vendor_profile_id)
     SELECT user_id, $2 FROM public.event_members WHERE event_id = $1 AND member_type = 'couple'
     ON CONFLICT DO NOTHING`,
    [ev, shop],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id)
     VALUES ($1, $2, $3) ON CONFLICT (event_id, vendor_profile_id) DO NOTHING`,
    [ev, shop, supplierUid],
  );
  // (the flat claim burn is best-effort and swallowed by the app — not asserted)
  // 3. seatClaimedCoupleAsCustomer — on the SUPPLIER'S OWN session.
  await asUser(supplierUid);
  await db.query(`SELECT public.unlock_vendor_event_free($1, $2)`, [shop, ev]);
  await db.query(
    `UPDATE public.chat_threads SET inquiry_status = 'accepted', accepted_at = now()
      WHERE event_id = $1 AND vendor_profile_id = $2 AND inquiry_status = 'pending'`,
    [ev, shop],
  );
  await asOwner();
  return shop;
}

const F = {
  host: '',
  eventId: '',
  otherHost: '',
  otherEvent: '',
  coord: '',
  coordShop: '',
  token: '',
  rowId: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.host = await signUp('host@claim-e2e.test', 'customer');
  F.eventId = await newWedding(F.host, 'Ice & Claire');
  F.otherHost = await signUp('other-host@claim-e2e.test', 'customer');
  F.otherEvent = await newWedding(F.otherHost, 'Somebody Else');

  const shared = await hostAddsTheirOwnAndShares(F.host, F.eventId, 'planner_coordinator', 'Tita Lorna Events');
  F.token = shared.token;
  F.rowId = shared.rowId;
});
after(async () => {
  await db?.close();
});

test('1 · the host adds their own supplier and the link is pending, opened by token on the server', async () => {
  await asServer();
  const r = await db.query<{ status: string; source: string; email: string | null; service_category: string }>(
    `SELECT status::text AS status, source::text AS source, email, service_category FROM public.vendor_invites WHERE claim_token = $1`,
    [F.token],
  );
  assert.deepEqual(r.rows[0], {
    status: 'pending',
    source: 'auto_share_link',
    email: null,
    service_category: 'planner_coordinator',
  });
  // fetchClaimLandingByToken stamps the first open, once, on the server path.
  const stamp = await db.query(
    `UPDATE public.vendor_invites SET first_opened_at = now() WHERE claim_token = $1 AND first_opened_at IS NULL RETURNING invite_id`,
    [F.token],
  );
  assert.equal(stamp.rows.length, 1);
  await asOwner();
});

test('2 · THE TRAP: signing up as a supplier already makes an EMPTY shop (why finalize must fill it)', async () => {
  F.coord = await signUp('coordinator@claim-e2e.test', 'vendor');
  const u = await db.query<{ account_type: string }>(`SELECT account_type::text FROM public.users WHERE user_id = $1`, [
    F.coord,
  ]);
  assert.equal(u.rows[0]!.account_type, 'vendor');
  const s = await db.query<{ business_name: string | null; services: string[] }>(
    `SELECT business_name, services FROM public.vendor_profiles WHERE user_id = $1`,
    [F.coord],
  );
  assert.equal(s.rows.length, 1, 'the sign-up trigger no longer opens a shop — re-read finalize before trusting this test');
  assert.equal((s.rows[0]!.business_name ?? '').trim(), '', 'the sign-up shop already has a name');
  assert.deepEqual(s.rows[0]!.services, [], 'the sign-up shop already has a service');
});

test('3 · finalize: the shop carries the couple\'s record — name and category', async () => {
  F.coordShop = await finalize(F.coord, F.token);
  await asUser(F.coord);
  const s = await db.query<{ vendor_profile_id: string; business_name: string | null; services: string[] }>(
    `SELECT vendor_profile_id, business_name, services FROM public.vendor_profiles WHERE user_id = $1`,
    [F.coord],
  );
  await asOwner();
  assert.equal(s.rows.length, 1, 'the supplier cannot read their own shop');
  assert.equal(s.rows[0]!.vendor_profile_id, F.coordShop, 'a second shop was opened instead of filling the first');
  assert.equal(s.rows[0]!.business_name, 'Tita Lorna Events', 'the claimed shop has no name');
  assert.ok(s.rows[0]!.services.includes('planner_coordinator'), `the claimed shop is in no category: ${JSON.stringify(s.rows[0]!.services)}`);
});

/** The coordinator grant every coordinator seat is created with (`answerClaimAccess` passes the same). */
const COORDINATOR_PERMISSIONS = JSON.stringify({
  edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false,
  areas: { guest_list: 'edit', seat_plan: 'edit', schedule: 'edit', vendors: 'edit', invitations: 'edit', mood_board: 'view', budget: null, photos: null },
});

test('4 · the link is claimed, the couple is ASKED, and nothing opens until they approve', async () => {
  await asServer();
  const before = await db.query<{ m: string | null }>(`SELECT marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`, [F.rowId]);
  assert.equal(before.rows[0]!.m, null, 'the claim bonded the record to the shop before the couple approved');
  const asks = await db.query<{ request_id: string; status: string }>(
    `SELECT request_id, status FROM public.event_access_requests WHERE event_vendor_id = $1 AND kind = 'claim'`,
    [F.rowId],
  );
  assert.equal(asks.rows.length, 1, 'the claim did not raise exactly one ask');
  assert.equal(asks.rows[0]!.status, 'pending');

  // Before the approval the claim alone grants no schedule edit.
  await asUser(F.host);
  const block = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'Rehearsal', TIMESTAMPTZ '2027-02-13 17:00+08') RETURNING block_id AS b`,
      [F.eventId],
    )
  ).rows[0]!.b;
  await asUser(F.coord);
  const pre = await db.query(`UPDATE public.event_schedule_blocks SET label = 'Moved' WHERE block_id = $1 RETURNING block_id`, [block]);
  assert.equal(pre.rows.length, 0, 'joining from the link alone now edits the schedule — the access model changed; re-read the docblock');

  // The couple approves — the coordinator gets the same access as the couple.
  await asServer();
  const ans = await db.query<{ r: { granted: boolean; coordinator: boolean } }>(
    `SELECT public.answer_claim_access_request($1, $2, true, $3::jsonb) AS r`,
    [asks.rows[0]!.request_id, F.host, COORDINATOR_PERMISSIONS],
  );
  assert.equal(ans.rows[0]!.r.granted, true);
  assert.equal(ans.rows[0]!.r.coordinator, true);
  const ev = await db.query<{ m: string | null }>(`SELECT marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`, [F.rowId]);
  assert.equal(ev.rows[0]!.m, F.coordShop);
  const inv = await db.query<{ status: string; by: string | null }>(
    `SELECT status::text AS status, claimed_by_user_id AS by FROM public.vendor_invites WHERE claim_token = $1`,
    [F.token],
  );
  assert.deepEqual(inv.rows[0], { status: 'claimed', by: F.coord });
  await asOwner();
});

test('5 · under RLS the coordinator sees THIS event among their customers — and not another couple\'s', async () => {
  // Another shop with a thread on the OTHER event, so "sees only their own" is a real filter.
  const otherSupplier = await signUp('other-supplier@claim-e2e.test', 'vendor');
  await asServer();
  const otherShop = (
    await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [otherSupplier])
  ).rows[0]!.v;
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [
    F.otherEvent,
    otherShop,
    otherSupplier,
  ]);

  await asUser(F.coord);
  const threads = await db.query<{ event_id: string; inquiry_status: string }>(
    `SELECT event_id, inquiry_status::text AS inquiry_status FROM public.chat_threads`,
  );
  const unlocks = await db.query<{ event_id: string }>(`SELECT event_id FROM public.vendor_event_unlocks`);
  await asOwner();
  assert.deepEqual(
    threads.rows.map((t) => t.event_id),
    [F.eventId],
    'the coordinator sees a thread that is not theirs, or not their own',
  );
  assert.equal(threads.rows[0]!.inquiry_status, 'accepted', 'the couple who invited them reads as a new inquiry');
  assert.deepEqual(unlocks.rows.map((u) => u.event_id), [F.eventId]);
});

test('6 · the same link cannot be used again — a second person is refused at every step', async () => {
  const second = await signUp('second-person@claim-e2e.test', 'vendor');
  await asServer();
  // The claim page reads the status and draws "already claimed".
  const st = await db.query<{ s: string }>(`SELECT status::text AS s FROM public.vendor_invites WHERE claim_token = $1`, [F.token]);
  assert.equal(st.rows[0]!.s, 'claimed');
  // Finalize step 1 refuses a non-pending link…
  await assert.rejects(
    db.query(`SELECT public.claim_ready_the_shop($1, $2)`, [second, F.token]),
    /this link is claimed/,
  );
  // …and even a forced re-link of the couple's row to the second person's shop is refused.
  const secondShop = (
    await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [second])
  ).rows[0]!.v;
  await assert.rejects(
    db.query(`SELECT public.claim_link_record_to_shop($1, $2)`, [F.rowId, secondShop]),
    /already linked to another shop/,
  );
  const still = await db.query<{ m: string }>(`SELECT marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`, [F.rowId]);
  assert.equal(still.rows[0]!.m, F.coordShop);
  await asOwner();
});

test('7 · schedule: the couple\'s Approve (test 4) gives the coordinator add/edit/delete on ANY item', async () => {
  await asUser(F.host);
  const couples = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'Ceremony', TIMESTAMPTZ '2027-02-14 14:00+08') RETURNING block_id AS b`,
      [F.eventId],
    )
  ).rows[0]!.b;
  // (Before the approval the claim alone granted no edit — asserted in test 4.)
  await asServer();
  const seat = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_moderators WHERE event_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL AND removed_at IS NULL`,
    [F.eventId, F.coord],
  );
  assert.equal(seat.rows[0]!.n, 1, 'the approval did not seat the coordinator');

  await asUser(F.coord);
  const edited = await db.query(`UPDATE public.event_schedule_blocks SET label = 'Ceremony (moved)' WHERE block_id = $1 RETURNING block_id`, [couples]);
  assert.equal(edited.rows.length, 1, 'the coordinator cannot edit the couple\'s item');
  const added = await db.query<{ b: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'Grand entrance', TIMESTAMPTZ '2027-02-14 18:00+08') RETURNING block_id AS b`,
    [F.eventId],
  );
  assert.equal(added.rows.length, 1, 'the coordinator cannot add an item');
  const removed = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [couples]);
  assert.equal(removed.rows.length, 1, 'the coordinator cannot delete the couple\'s item');
  // …and still nothing on the other couple's event.
  const foreign = await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'Nope', now()) RETURNING block_id`,
    [F.otherEvent],
  ).then(
    () => 'inserted',
    () => 'refused',
  );
  assert.equal(foreign, 'refused', 'the coordinator wrote onto another couple\'s schedule');
  await asOwner();
});

test('8 · a BOOKED non-coordinator supplier never edits or deletes an item that is not theirs', async () => {
  const caterer = await signUp('caterer@claim-e2e.test', 'vendor');
  await asServer();
  const shop = (
    await db.query<{ v: string }>(
      `UPDATE public.vendor_profiles SET business_name = 'Kusina', services = ARRAY['catering']::text[],
              verification_state = 'verified', last_verified_at = NOW()
        WHERE user_id = $1 RETURNING vendor_profile_id AS v`,
      [caterer],
    )
  ).rows[0]!.v;
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'catering', 'Kusina', 'contracted', 100000, $2)`,
    [F.eventId, shop],
  );
  await asUser(F.host);
  const block = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'First dance', TIMESTAMPTZ '2027-02-14 20:00+08') RETURNING block_id AS b`,
      [F.eventId],
    )
  ).rows[0]!.b;

  await asUser(caterer);
  const upd = await db.query(`UPDATE public.event_schedule_blocks SET label = 'Dinner' WHERE block_id = $1 RETURNING block_id`, [block]);
  const del = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [block]);
  await asOwner();
  assert.equal(upd.rows.length, 0, 'a booked caterer edited the couple\'s item');
  assert.equal(del.rows.length, 0, 'a booked caterer deleted the couple\'s item');
  const still = await db.query<{ label: string }>(`SELECT label FROM public.event_schedule_blocks WHERE block_id = $1`, [block]);
  assert.equal(still.rows[0]!.label, 'First dance');
});

test('8b · booking the claimed coordinator waits for their verification — seeing the event does not', async () => {
  // Test 5 already proved they see and talk to the couple unverified. Moving
  // the couple's row to a BOOKED status is where verification is asked
  // (vendor_not_verified) — and the auto coordinator invite rides on that
  // booking. So for a brand-new coordinator the host's Event access grant
  // (test 7) is the path to schedule edit, not the booking.
  await asServer();
  await assert.rejects(
    db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [F.rowId]),
    /vendor_not_verified/,
  );
  await asOwner();
});

test('8c · once booked, the coordinator who joined from the link IS the coordinator to every day-of gate', async () => {
  // services = ['planner_coordinator'] — the couple's own category, the only
  // thing a claimed shop carries. Every day-of gate used to ask for the bare
  // tile 'coordinator', which no shop carries (services_make_a_coordinator).
  await asServer();
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW() WHERE vendor_profile_id = $1`,
    [F.coordShop],
  );
  await db.query(`UPDATE public.event_vendors SET status = 'contracted', total_cost_php = 50000 WHERE vendor_id = $1`, [F.rowId]);
  await asUser(F.coord);
  const ids = await db.query<{ e: string }>(`SELECT public.current_coordinator_booked_event_ids() AS e`);
  await asOwner();
  assert.deepEqual(ids.rows.map((r) => r.e), [F.eventId], 'a booked planner_coordinator is not the coordinator on the day');
  await asServer();
  const t = await db.query<{ a: boolean; b: boolean; c: boolean }>(
    `SELECT public.services_make_a_coordinator(ARRAY['planner_coordinator']) AS a,
            public.services_make_a_coordinator(ARRAY['planner_coordinator','wedding_coordination']) AS b,
            public.services_make_a_coordinator(ARRAY['catering']) AS c`,
  );
  assert.deepEqual(t.rows[0], { a: true, b: true, c: false });
  await asOwner();
});

test('9 · an existing supplier connecting a new couple keeps their own name and services', async () => {
  const pro = await signUp('pro-coord@claim-e2e.test', 'vendor');
  await asServer();
  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Pro Events', services = ARRAY['planner_coordinator','wedding_coordination']::text[] WHERE user_id = $1`,
    [pro],
  );
  const shared = await hostAddsTheirOwnAndShares(F.host, F.eventId, 'planner_coordinator', 'What the couple typed');
  await asServer();
  await db.query(`SELECT public.claim_ready_the_shop($1, $2)`, [pro, shared.token]);
  const s = await db.query<{ business_name: string; services: string[] }>(
    `SELECT business_name, services FROM public.vendor_profiles WHERE user_id = $1`,
    [pro],
  );
  assert.equal(s.rows[0]!.business_name, 'Pro Events', 'the couple\'s typing overwrote a real shop name');
  assert.deepEqual(s.rows[0]!.services, ['planner_coordinator', 'wedding_coordination']);
  await asOwner();
});

test('10 · a sign-up that arrives as a customer (Google, or an existing couple account) gets a shop WITH its admin seat', async () => {
  const g = await signUp('google-coord@claim-e2e.test', 'customer');
  const shared = await hostAddsTheirOwnAndShares(F.host, F.eventId, 'photographer', 'Lens & Light');
  await asServer();
  const shop = (await db.query<{ s: string }>(`SELECT public.claim_ready_the_shop($1, $2) AS s`, [g, shared.token])).rows[0]!.s;
  const seat = await db.query<{ role: string }>(
    `SELECT role::text FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND user_id = $2`,
    [shop, g],
  );
  assert.equal(seat.rows[0]?.role, 'admin', 'a shop opened at finalize has no seat — the free unlock would refuse its owner');
  const s = await db.query<{ business_name: string; services: string[] }>(
    `SELECT business_name, services FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.deepEqual(s.rows[0], { business_name: 'Lens & Light', services: ['photographer'] });
  await asOwner();
});

test('only the server may ready a shop', async () => {
  const r = await db.query<{ anon: boolean; auth: boolean; svc: boolean }>(
    `SELECT has_function_privilege('anon', 'public.claim_ready_the_shop(uuid, text)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.claim_ready_the_shop(uuid, text)', 'EXECUTE') AS auth,
            has_function_privilege('service_role', 'public.claim_ready_the_shop(uuid, text)', 'EXECUTE') AS svc`,
  );
  assert.deepEqual(r.rows[0], { anon: false, auth: false, svc: true });
});
