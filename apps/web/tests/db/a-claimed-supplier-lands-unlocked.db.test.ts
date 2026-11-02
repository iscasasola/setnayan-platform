/**
 * 🔗 THE FOUNDERS' EVENT, WALKED IN THE DATABASE (supplier gate audit G4, 2026-11-02): a couple adds their own
 * caterer by hand and logs a payment, the caterer joins from the couple's link, the couple approves — and with the
 * booking fee unlocking the event ON (`platform_settings.fee_unlocks_event_enforced`), the caterer must land with
 * their day REACHABLE, not locked behind a fee nobody owes.
 *
 *   1 · the lockout was real: right after the approval, with no charge, the caterer's brief is `booked_fee_due`;
 *   2 · the approval's fee (`claim_approved` door → `booking_fee_open_lock_charge`) is `waived_import` — the couple
 *       brought them, nothing is owed — and the same brief now reads `unlocked`;
 *   3 · the claim ask is answered, granted, and stamped with the booking the catch-up sweep re-mints from.
 * The app half (the approval calls the mint and tells the supplier) is `lib/a-claimed-supplier-is-told-and-let-in.test.ts`.
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

async function shopOf(uid: string): Promise<string> {
  await asServer();
  const r = await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]);
  return r.rows[0]!.v;
}

/** The couple adds their own supplier and shares the link (host session, RLS on). */
async function addByHand(eventId: string, category: string, business: string): Promise<{ token: string; rowId: string }> {
  await asUser(F.host);
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
  const token = `ask-${++n}-${Math.random().toString(36).slice(2)}`;
  await db.query(
    `INSERT INTO public.vendor_invites
       (vendor_id, invited_by_user_id, email, business_name, service_category, claim_token, status, source, expires_at)
     VALUES ($1, $2, NULL, $3, $4, $5, 'pending', 'auto_share_link', now() + interval '90 days')`,
    [row.rows[0]!.id, F.host, business, category, token],
  );
  await asOwner();
  return { token, rowId: row.rows[0]!.id };
}

/** The finalize page + `applyClaimAutoLink`, statement for statement (no bond). Returns the ask id. */
async function claim(supplierUid: string, token: string): Promise<{ shop: string; ask: string }> {
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
    [F.eventId, shop, supplierUid],
  );
  await asOwner();
  return { shop, ask };
}

async function answer(ask: string, by: string, approve: boolean) {
  await asServer();
  const r = await db.query<{ r: Record<string, unknown> }>(`SELECT public.answer_claim_access_request($1, $2, $3, '{}'::jsonb) AS r`, [
    ask,
    by,
    approve,
  ]);
  await asOwner();
  return r.rows[0]!.r;
}

async function briefStage(uid: string): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ s: string }>(`SELECT public.get_vendor_event_brief($1)->>'stage' AS s`, [F.eventId]).then(
    (x) => x.rows[0]!.s,
    (e: Error) => `refused: ${e.message}`,
  );
  await asOwner();
  return r;
}

/** The fee gate the brief, the RSVP list and the seat plan all ask (`vendor_event_fee_gate_stage`), as this supplier. */
async function feeStage(uid: string): Promise<string> {
  await asOwner();
  await setAuthUid(db, uid);
  const r = await db.query<{ s: string }>(`SELECT public.vendor_event_fee_gate_stage($1, TRUE) AS s`, [F.eventId]);
  await asOwner();
  return r.rows[0]!.s;
}

/** Does the caterer's brief come back narrowed (`withheld` present)? */
async function briefWithheld(uid: string): Promise<boolean> {
  await asUser(uid);
  const r = await db.query<{ w: boolean }>(`SELECT (public.get_vendor_event_brief($1) ? 'withheld') AS w`, [F.eventId]);
  await asOwner();
  return r.rows[0]!.w;
}

const F = { host: '', eventId: '', caterer: '', catererShop: '', rowId: '', token: '', ask: '', booking: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('host@founders-walk.test', 'customer');
  await asOwner();
  F.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
       VALUES ('Founders Walk', 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.host]);
  const added = await addByHand(F.eventId, 'catering', 'Kusina ni Lola');
  F.rowId = added.rowId;
  F.token = added.token;
  await asUser(F.host);
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 20000, 'GCash')`,
    [F.eventId, F.rowId],
  );
  await asOwner();
  // The fee unlocks the event — the state the founders' event runs in.
  await db.query(`UPDATE public.platform_settings SET booking_fee_minting_live = TRUE, fee_unlocks_event_enforced = TRUE WHERE id = 1`);
  F.caterer = await signUp('caterer@founders-walk.test', 'vendor');
  const c = await claim(F.caterer, F.token);
  F.catererShop = c.shop;
  F.ask = c.ask;
});
after(async () => {
  await db?.close();
});

test('1 · the approval books the caterer — and with no charge their day is LOCKED (the lockout was real)', async () => {
  const r = await answer(F.ask, F.host, true);
  assert.equal(r.granted, true);
  assert.equal(r.booked, true, 'a hand-added row with a payment is booked by the approval');
  F.booking = String(r.booking_vendor_id);
  assert.equal(await briefStage(F.caterer), 'booked', 'the caterer is booked on the event');
  assert.equal(await feeStage(F.caterer), 'booked_fee_due', 'before the claim_approved door, the caterer was locked out');
  assert.equal(await briefWithheld(F.caterer), true, 'and their brief came back narrowed');
});

test('2 · the claim_approved fee is waived_import — and the caterer\'s day opens', async () => {
  await asServer();
  const fee = (
    await db.query<{ r: Record<string, unknown> }>(`SELECT public.booking_fee_open_lock_charge($1) AS r`, [F.booking])
  ).rows[0]!.r;
  await asOwner();
  assert.equal(fee.status, 'waived_import', `the couple brought this caterer — nothing is owed (got ${JSON.stringify(fee)})`);
  assert.equal(await feeStage(F.caterer), 'unlocked', 'with the waived charge the caterer lands on an open event');
  assert.equal(await briefWithheld(F.caterer), false, 'and their brief is whole — their day is reachable');
});

test('3 · the ask is answered, granted and stamped with the booking the catch-up sweep reads', async () => {
  await asServer();
  const r = await db.query<{ status: string; access: string; ev: string; vp: string }>(
    `SELECT status, decisions->>'access' AS access, event_vendor_id::text AS ev, vendor_profile_id::text AS vp
       FROM public.event_access_requests WHERE request_id = $1`,
    [F.ask],
  );
  await asOwner();
  assert.deepEqual(r.rows[0], { status: 'answered', access: 'granted', ev: F.booking, vp: F.catererShop });
});
