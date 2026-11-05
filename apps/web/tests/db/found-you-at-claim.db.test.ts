/**
 * 🕵️ FOUND-YOU, WALKED IN SQL — the record of when a couple first saw a shop here, and the check the couple's
 * Approve runs when that shop claims their link. Migration 20271313372071.
 *
 * Owner, 2026-11-05: *"we already had this plan which logs users that has seen or shown in the app as a result.
 * and it saves the date when you first saw that supplier. yes this is important"* — the plan is DECISION_LOG
 * 2026-07-27 "FOUND-YOU — CLAIM-SYNC is the authoritative checkpoint".
 *
 *   1 · a view for an event from a Setnayan surface writes ONE row: first seen, how many times; a view through the
 *       shop's own link, or with no event, writes nothing; counting stops once the shop is on the event;
 *   2 · only the couple reads it — not the shop, not a stranger, not anon — and nobody's session writes it;
 *   3 · THE SATURDAY INVITE: a supplier with NO account claims the couple's link → Approve lets them in, bonded,
 *       NOT found, and the fee rule says import (free) — end to end, statement for statement as the app runs it;
 *   4 · a shop with an account the couple opened from Explore BEFORE typing the record → FOUND at Approve: the
 *       receipt is stamped, My Performance counts it as Setnayan's, and the fee rule (untouched) already says
 *       sourced — the two never disagree;
 *   5 · the same shop seen only AFTER the record was typed → not found (the timing guard), import;
 *   6 · Decline runs no check and stamps nothing.
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
async function asAnon(): Promise<void> {
  await asOwner();
  await setAuthRole('anon');
  await db.exec(`SET ROLE anon`);
}
async function asServer(): Promise<void> {
  await asOwner();
  await setAuthRole('service_role');
}

async function signUp(tag: string, accountType: 'vendor' | 'customer'): Promise<string> {
  await asOwner();
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [`${tag}-${++n}@found-you.test`, accountType],
  );
  return r.rows[0]!.id;
}

/** A shop that has been on Setnayan for a month — an ACTIVE account. */
async function oldShop(name: string): Promise<{ uid: string; shop: string }> {
  const uid = await signUp('shop', 'vendor');
  await asOwner();
  const existing = await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  let shop = existing.rows[0]?.v;
  if (!shop) {
    shop = (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
        [uid, name],
      )
    ).rows[0]!.v;
  }
  await db.query(`UPDATE public.vendor_profiles
        SET created_at = now() - interval '30 days', business_name = $2, verification_state = 'verified', last_verified_at = NOW()
      WHERE vendor_profile_id = $1`,
    [shop, name],);
  return { uid, shop };
}

async function newEvent(host: string): Promise<string> {
  await asOwner();
  const e = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
       VALUES ($1, 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
      [`Found you ${++n}`],
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [e, host]);
  return e;
}

/** The shop's page drawn for the couple — exactly the row `recordVendorProfileView` inserts (service role). */
async function view(eventId: string | null, shop: string, source: string | null, ago: string): Promise<void> {
  await asServer();
  await db.query(
    `INSERT INTO public.vendor_profile_views (vendor_profile_id, event_id, source, viewer_hash, viewed_at)
     VALUES ($1, $2, $3, 'h', now() - $4::interval)`,
    [shop, eventId, source, ago],
  );
  await asOwner();
}

async function found(eventId: string, shop: string) {
  await asOwner();
  const r = await db.query<{ view_count: number; first_source: string; claimed: boolean; first_found_at: string }>(
    `SELECT view_count, first_source, found_at_claim_at IS NOT NULL AS claimed, first_found_at::text AS first_found_at
       FROM public.event_vendor_found WHERE event_id = $1 AND vendor_profile_id = $2`,
    [eventId, shop],
  );
  return r.rows[0] ?? null;
}

/** The couple adds their own supplier by hand and the link is made (host session, RLS on) — as the add walk does. */
async function addByHand(host: string, eventId: string, business: string): Promise<{ token: string; rowId: string }> {
  await asUser(host);
  const card = await db.query<{ id: string }>(
    `INSERT INTO public.event_manual_vendors (event_id, business_name, contact_person, contact_number)
     VALUES ($1, $2, 'Tita Lorna', '09170000000') RETURNING manual_vendor_id AS id`,
    [eventId, business],
  );
  const row = await db.query<{ id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, manual_vendor_id, status, source)
     VALUES ($1, 'catering', $2, $3, 'considering', 'host_manual') RETURNING vendor_id AS id`,
    [eventId, business, card.rows[0]!.id],
  );
  const token = `found-${++n}-${Math.random().toString(36).slice(2)}`;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
     VALUES ($1, $2, NULL, $3, 'catering', $4, 'pending', 'auto_share_link', now() + interval '90 days')`,
    [row.rows[0]!.id, host, business, token],
  );
  await asOwner();
  return { token, rowId: row.rows[0]!.id };
}

/** /vendor/claim/[token]/finalize + `applyClaimAutoLink`, statement for statement. Returns the shop and the ask. */
async function claim(eventId: string, supplierUid: string, token: string): Promise<{ shop: string; ask: string }> {
  await asServer();
  const shop = (await db.query<{ s: string }>(`SELECT public.claim_ready_the_shop($1, $2) AS s`, [supplierUid, token])).rows[0]!.s;
  const inv = (
    await db.query<{ invite_id: string; vendor_id: string }>(`SELECT invite_id, vendor_id FROM public.vendor_invites WHERE claim_token = $1`, [token])
  ).rows[0]!;
  const ask = (
    await db.query<{ a: string }>(`SELECT public.claim_ask_for_access($1, $2, $3) AS a`, [inv.vendor_id, shop, supplierUid])
  ).rows[0]!.a;
  await db.query(
    `UPDATE public.vendor_invites SET status = 'claimed', claimed_at = now(), claimed_by_user_id = $2, claimed_vendor_profile_id = $3
      WHERE invite_id = $1`,
    [inv.invite_id, supplierUid, shop],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id)
     VALUES ($1, $2, $3) ON CONFLICT (event_id, vendor_profile_id) DO NOTHING`,
    [eventId, shop, supplierUid],
  );
  await asOwner();
  return { shop, ask };
}

/** The couple's Approve / Decline — `answerClaimAccess` → `answer_claim_access_request` (service role). */
async function answer(ask: string, by: string, approve: boolean): Promise<Record<string, unknown>> {
  await asServer();
  const r = await db.query<{ r: Record<string, unknown> }>(`SELECT public.answer_claim_access_request($1, $2, $3, '{}'::jsonb) AS r`, [
    ask,
    by,
    approve,
  ]);
  await asOwner();
  return r.rows[0]!.r;
}

async function feeAttribution(shop: string, eventId: string): Promise<string> {
  await asOwner();
  return (await db.query<{ a: string }>(`SELECT public.booking_fee_attribution_for($1, $2) AS a`, [shop, eventId])).rows[0]!.a;
}

/** What the supplier's My Performance reads — as the supplier, under its own ownership gate. */
async function performance(uid: string, shop: string): Promise<Record<string, number>> {
  await asOwner();
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE marketplace_vendor_id = $1`, [shop]);
  await asUser(uid);
  const r = await db.query<{ attribution: string; booking_count: number }>(
    `SELECT attribution, booking_count FROM public.vendor_source_attribution($1)`,
    [shop],
  );
  await asOwner();
  return Object.fromEntries(r.rows.map((x) => [x.attribution, x.booking_count]));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

test('1 · a Setnayan view writes one row and counts; the shop\'s own link and event-less views write nothing; counting stops once the shop is on the event', async () => {
  const host = await signUp('host', 'customer');
  const eventId = await newEvent(host);
  const { shop } = await oldShop('Casa Amara');

  await view(eventId, shop, 'profile_direct', '5 days');
  await view(null, shop, 'explore', '5 days');
  await view(eventId, shop, null, '5 days');
  assert.equal(await found(eventId, shop), null, 'own link / no event / no source is the shop showing the couple, not Setnayan');

  await view(eventId, shop, 'explore', '4 days');
  await view(eventId, shop, 'search', '3 days');
  await view(eventId, shop, 'favorites', '2 days');
  const r = await found(eventId, shop);
  assert.equal(r?.view_count, 3);
  assert.equal(r?.first_source, 'explore', 'first seen keeps where it was first seen');

  // A save from Find puts the shop on the event → frozen.
  await asOwner();
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status, source)
     VALUES ($1, 'catering', 'Casa Amara', $2, 'shortlisted', 'host_marketplace_search')`,
    [eventId, shop],
  );
  await view(eventId, shop, 'explore', '1 day');
  assert.equal((await found(eventId, shop))?.view_count, 3, 'counted UNTIL added, frozen after (§10)');
});

test('2 · only the couple reads it; the shop, a stranger and anon read nothing; no session writes it', async () => {
  const host = await signUp('host', 'customer');
  const stranger = await signUp('stranger', 'customer');
  const eventId = await newEvent(host);
  const { uid: shopUid, shop } = await oldShop('Lights by Lito');
  await view(eventId, shop, 'explore', '2 days');

  const count = async () =>
    (await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM public.event_vendor_found WHERE event_id = $1`, [eventId])).rows[0]!.c;

  await asUser(host);
  assert.equal(await count(), 1, 'the couple sees their own record');
  await asUser(shopUid);
  assert.equal(await count(), 0, 'the shop never reads the couple\'s browsing');
  await asUser(stranger);
  assert.equal(await count(), 0);
  await asAnon();
  await assert.rejects(count(), /permission denied/, 'anon has no grant at all');

  await asUser(host);
  await assert.rejects(
    db.query(`UPDATE public.event_vendor_found SET view_count = 99 WHERE event_id = $1`, [eventId]),
    /permission denied/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_vendor_found (event_id, vendor_profile_id, first_found_at, first_source, last_viewed_at)
       VALUES ($1, $2, now(), 'explore', now())`,
      [eventId, shop],
    ),
    /permission denied/,
  );
  await assert.rejects(db.query(`DELETE FROM public.event_vendor_found WHERE event_id = $1`, [eventId]), /permission denied/);
  await asOwner();
});

test('3 · THE SATURDAY INVITE: a supplier with NO account claims the couple\'s link FREE — let in, bonded, not found, import', async () => {
  const host = await signUp('host', 'customer');
  const eventId = await newEvent(host);
  const { token, rowId } = await addByHand(host, eventId, 'Kusina ni Lola');

  // The supplier signs up from the QR — no shop existed before this moment.
  const newcomer = await signUp('newcomer', 'vendor');
  const { shop, ask } = await claim(eventId, newcomer, token);

  const res = await answer(ask, host, true);
  assert.equal(res.granted, true, 'Approve still lets them in');
  assert.equal(res.booking_vendor_id, rowId);
  assert.deepEqual(res.found_you, { found: false, why: 'new_account' });

  await asOwner();
  const bonded = await db.query<{ m: string | null; source: string }>(
    `SELECT marketplace_vendor_id AS m, source FROM public.event_vendors WHERE vendor_id = $1`,
    [rowId],
  );
  assert.equal(bonded.rows[0]!.m, shop, 'the couple\'s record is linked to the new shop');
  assert.equal(bonded.rows[0]!.source, 'host_manual', 'how they met is never rewritten');
  assert.equal(await found(eventId, shop), null, 'no record, nothing stamped');
  assert.equal(await feeAttribution(shop, eventId), 'import', 'a supplier with no account claims FREE, always');
  const inv = await db.query<{ status: string }>(`SELECT status::text AS status FROM public.vendor_invites WHERE claim_token = $1`, [token]);
  assert.equal(inv.rows[0]!.status, 'claimed');
});

test('4 · an active shop the couple opened from Explore BEFORE typing the record is FOUND at Approve — and the fee rule already agrees', async () => {
  const host = await signUp('host', 'customer');
  const eventId = await newEvent(host);
  const { uid: shopUid, shop } = await oldShop('Casa Amara Catering');
  await view(eventId, shop, 'explore', '10 days');
  await view(eventId, shop, 'explore', '9 days');

  // The couple types them in under another name (the rename dodge) — the claim is still exact identity.
  const { token } = await addByHand(host, eventId, 'CA Catering');
  const c = await claim(eventId, shopUid, token);
  assert.equal(c.shop, shop, 'the claim reuses the account that already existed');
  assert.equal(await feeAttribution(shop, eventId), 'import', 'before Approve nothing is bonded, so nothing is attributed');

  const res = await answer(c.ask, host, true);
  assert.equal(res.granted, true);
  const fy = res.found_you as { found: boolean; view_count: number; first_found_at: string };
  assert.equal(fy.found, true);
  assert.equal(fy.view_count, 2);
  assert.ok(new Date(fy.first_found_at).getTime() < Date.now() - 8 * 86_400_000, 'the date they were first found');

  assert.equal((await found(eventId, shop))?.claimed, true, 'the receipt is stamped');
  assert.equal(await feeAttribution(shop, eventId), 'sourced', 'FOUND ⇒ the shipped fee rule says sourced (no money logic changed)');
  assert.deepEqual(await performance(shopUid, shop), { setnayan: 1 }, 'My Performance counts it as Setnayan\'s');
});

test('5 · the same kind of shop seen only AFTER the record was typed is NOT found — the timing guard — and stays import', async () => {
  const host = await signUp('host', 'customer');
  const eventId = await newEvent(host);
  const { uid: shopUid, shop } = await oldShop('Late Find Lights');
  const { token } = await addByHand(host, eventId, 'Late Find Lights');
  await view(eventId, shop, 'explore', '0 seconds');

  const c = await claim(eventId, shopUid, token);
  const res = await answer(c.ask, host, true);
  assert.equal(res.granted, true);
  assert.deepEqual(res.found_you, { found: false, why: 'not_seen_first' });
  assert.equal((await found(eventId, shop))?.claimed, false);
  assert.equal(await feeAttribution(shop, eventId), 'import');
  assert.deepEqual(await performance(shopUid, shop), { off_platform: 1 });
});

test('6 · Decline runs no check and stamps nothing', async () => {
  const host = await signUp('host', 'customer');
  const eventId = await newEvent(host);
  const { uid: shopUid, shop } = await oldShop('Declined Sounds');
  await view(eventId, shop, 'search', '3 days');
  const { token } = await addByHand(host, eventId, 'Declined Sounds');
  const c = await claim(eventId, shopUid, token);
  const res = await answer(c.ask, host, false);
  assert.deepEqual(res, { granted: false });
  assert.equal((await found(eventId, shop))?.claimed, false);
});

test('7 · the check is service-role only, and the Approve function really calls it', async () => {
  await asOwner();
  const g = await db.query<{ anon: boolean; auth: boolean }>(
    `SELECT has_function_privilege('anon', 'public.found_you_check_at_claim(uuid,uuid)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.found_you_check_at_claim(uuid,uuid)', 'EXECUTE') AS auth`,
  );
  assert.deepEqual(g.rows[0], { anon: false, auth: false });
  const def = await db.query<{ d: string }>(
    `SELECT pg_get_functiondef('public.answer_claim_access_request(uuid,uuid,boolean,jsonb)'::regprocedure) AS d`,
  );
  assert.match(def.rows[0]!.d, /found_you_check_at_claim/);
  const t = await db.query<{ ok: boolean }>(
    `SELECT 'found_you_lead' = ANY (enum_range(NULL::public.notification_type)::text[]) AS ok`,
  );
  assert.equal(t.rows[0]!.ok, true);
});
