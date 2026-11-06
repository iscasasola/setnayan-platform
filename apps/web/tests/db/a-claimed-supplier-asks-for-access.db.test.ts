/**
 * A CLAIMED SUPPLIER ARRIVES BOOKED IF PAID, ASKS FOR ACCESS ON ITS OWN, AND
 * ITS SCHEDULE ITEMS FOLLOW IT — walked in SQL, as each person, under RLS.
 *
 * Owner, 2026-10-20 (DECISION_LOG row of that name): *"if the manual input has
 * payment already, it is technically booked already."* · *"access to the event
 * is automatic but has an approval. it should proceed to that approval giving
 * access once they sync."* · *"Schedule will have booked or shortlisted if there
 * is no booking yet."*
 *
 * The walk (migration 20271280900282):
 *   1. The couple adds a caterer by hand, logs a payment, and gives them a
 *      schedule item.
 *   2. The caterer claims the couple's link → ONE pending ask, NO bond: the
 *      booked-supplier reads (the brief's booked stage, the schedule) refuse.
 *      A supplier cannot raise or answer a claim ask itself; only the couple
 *      answers.
 *   3. The couple approves → booked (the payment), bonded, the brief says
 *      'booked', the schedule item is theirs.
 *   4. Decline grants nothing.
 *   5. A shop that was ALREADY on the event (a save from Find) claims the
 *      couple's hand record → the record merges onto the shop's row, and the
 *      schedule item the couple gave the record now points at the survivor.
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

async function blocksSeenBy(uid: string): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_blocks WHERE event_id = $1`, [F.eventId]);
  await asOwner();
  return r.rows[0]!.n;
}

const F = { host: '', eventId: '', caterer: '', catererShop: '', rowId: '', token: '', ask: '', blockId: '' };

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.host = await signUp('host@ask-e2e.test', 'customer');
  await asOwner();
  F.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date)
       VALUES ('Ice & Claire', 'wedding', 'catholic', 'banquet_hall', DATE '2027-02-14') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.host]);

  const added = await addByHand(F.eventId, 'catering', 'Kusina ni Lola');
  F.rowId = added.rowId;
  F.token = added.token;
  // The couple logs a payment and gives the caterer a schedule item (their own session).
  await asUser(F.host);
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 20000, 'GCash')`,
    [F.eventId, F.rowId],
  );
  F.blockId = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids)
       VALUES ($1, 'Dinner service', TIMESTAMPTZ '2027-02-14 19:00+08', ARRAY[$2]::uuid[]) RETURNING block_id AS b`,
      [F.eventId, F.rowId],
    )
  ).rows[0]!.b;
  await asOwner();
  F.caterer = await signUp('caterer@ask-e2e.test', 'vendor');
});
after(async () => {
  await db?.close();
});

test('1 · before the claim the record is the couple\'s, paid, and filed as they filed it', async () => {
  await asServer();
  const r = await db.query<{ status: string; m: string | null; paid: number }>(
    `SELECT ev.status::text AS status, ev.marketplace_vendor_id AS m,
            (SELECT count(*)::int FROM public.event_vendor_payments p WHERE p.vendor_id = ev.vendor_id) AS paid
       FROM public.event_vendors ev WHERE ev.vendor_id = $1`,
    [F.rowId],
  );
  await asOwner();
  // The STORED status is untouched — the couple's screens read Booked from the
  // payment (lib/booked-by-payment.ts); nothing rewrites the row.
  assert.deepEqual(r.rows[0], { status: 'considering', m: null, paid: 1 });
});

test('2 · the claim raises ONE ask and opens nothing', async () => {
  const c = await claim(F.caterer, F.token);
  F.catererShop = c.shop;
  F.ask = c.ask;
  await asServer();
  const again = (await db.query<{ a: string }>(`SELECT public.claim_ask_for_access($1, $2, $3) AS a`, [F.rowId, F.catererShop, F.caterer])).rows[0]!.a;
  assert.equal(again, F.ask, 'a retried claim raised a second ask');
  const asks = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_access_requests WHERE event_id = $1 AND kind = 'claim' AND status = 'pending'`,
    [F.eventId],
  );
  assert.equal(asks.rows[0]!.n, 1);
  const bond = await db.query<{ m: string | null }>(`SELECT marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`, [F.rowId]);
  assert.equal(bond.rows[0]!.m, null, 'the claim bonded the record before the couple approved');
  await asOwner();

  assert.notEqual(await briefStage(F.caterer), 'booked', 'the supplier holds the booked brief before the approval');
  assert.equal(await blocksSeenBy(F.caterer), 0, 'the supplier reads the schedule before the approval');
});

test('2b · a supplier can neither raise a claim ask nor answer one', async () => {
  await asUser(F.caterer);
  const raised = await db
    .query(
      `INSERT INTO public.event_access_requests (event_id, requester_user_id, vendor_profile_id, requested_areas, kind, event_vendor_id)
       VALUES ($1, $2, $3, ARRAY[]::text[], 'claim', $4)`,
      [F.eventId, F.caterer, F.catererShop, F.rowId],
    )
    .then(() => 'inserted', () => 'refused');
  assert.equal(raised, 'refused', 'a browser raised a claim ask');
  const answered = await db
    .query(`SELECT public.answer_claim_access_request($1, $2, true, '{}'::jsonb)`, [F.ask, F.caterer])
    .then(() => 'answered', () => 'refused');
  assert.equal(answered, 'refused', 'a supplier can call the answer');
  await asOwner();
  // …and on the server, only the couple's id is accepted as the one deciding.
  await assert.rejects(answer(F.ask, F.caterer, true), /only the couple answers/);
});

test('3 · the couple approves → booked by the payment, bonded, and the event opens by category', async () => {
  const r = await answer(F.ask, F.host, true);
  assert.equal(r.granted, true);
  assert.equal(r.booked, true);
  assert.equal(r.coordinator, false, 'a caterer was given a coordinator seat');
  await asServer();
  const row = await db.query<{ status: string; m: string | null }>(
    `SELECT status::text AS status, marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`,
    [F.rowId],
  );
  assert.deepEqual(row.rows[0], { status: 'contracted', m: F.catererShop });
  const ask = await db.query<{ status: string; d: string }>(
    `SELECT status, decisions->>'access' AS d FROM public.event_access_requests WHERE request_id = $1`,
    [F.ask],
  );
  assert.deepEqual(ask.rows[0], { status: 'answered', d: 'granted' });
  const seat = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_moderators WHERE user_id = $1`, [F.caterer]);
  assert.equal(seat.rows[0]!.n, 0);
  await asOwner();

  assert.equal(await briefStage(F.caterer), 'booked');
  assert.equal(await blocksSeenBy(F.caterer), 1, 'the booked caterer cannot read the schedule');
  await asUser(F.caterer);
  const own = await db.query<{ o: boolean }>(`SELECT public.current_vendor_owns_schedule_block($1, $2) AS o`, [F.blockId, F.catererShop]);
  await asOwner();
  assert.equal(own.rows[0]!.o, true, 'the item the couple gave them is not theirs');
  await assert.rejects(answer(F.ask, F.host, true), /already answered/);
});

test('4 · Decline grants nothing', async () => {
  const shooter = await signUp('shooter@ask-e2e.test', 'vendor');
  const added = await addByHand(F.eventId, 'photographer', 'Lente Studio');
  const c = await claim(shooter, added.token);
  const r = await answer(c.ask, F.host, false);
  assert.equal(r.granted, false);
  await asServer();
  const row = await db.query<{ status: string; m: string | null }>(
    `SELECT status::text AS status, marketplace_vendor_id AS m FROM public.event_vendors WHERE vendor_id = $1`,
    [added.rowId],
  );
  assert.deepEqual(row.rows[0], { status: 'considering', m: null });
  const ask = await db.query<{ d: string }>(`SELECT decisions->>'access' AS d FROM public.event_access_requests WHERE request_id = $1`, [c.ask]);
  assert.equal(ask.rows[0]!.d, 'declined');
  await asOwner();
  assert.equal(await blocksSeenBy(shooter), 0);
});

test('5 · a merge on approval carries the schedule item to the surviving row', async () => {
  const florist = await signUp('florist@ask-e2e.test', 'vendor');
  const shop = await shopOf(florist);
  // The shop was already on the event — a save from Find.
  await asServer();
  await db.query(`UPDATE public.vendor_profiles SET business_name = 'Bulaklak Co', services = ARRAY['florist']::text[] WHERE vendor_profile_id = $1`, [shop]);
  const survivor = (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, marketplace_vendor_id, status, created_at)
       VALUES ($1, 'florist', 'Bulaklak Co', $2, 'considering', now() - interval '1 day') RETURNING vendor_id AS v`,
      [F.eventId, shop],
    )
  ).rows[0]!.v;
  await asOwner();
  const added = await addByHand(F.eventId, 'florist', 'Bulaklak (typed)');
  await asUser(F.host);
  const block = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids)
       VALUES ($1, 'Flowers in', TIMESTAMPTZ '2027-02-14 08:00+08', ARRAY[$2]::uuid[]) RETURNING block_id AS b`,
      [F.eventId, added.rowId],
    )
  ).rows[0]!.b;
  await db.query(`INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 5000, 'Cash')`, [
    F.eventId,
    added.rowId,
  ]);
  await asOwner();
  const c = await claim(florist, added.token);
  assert.equal(c.shop, shop);
  const r = await answer(c.ask, F.host, true);
  assert.equal(r.merged, true);
  assert.equal(r.booking_vendor_id, survivor);
  await asServer();
  const tags = await db.query<{ ids: string[] }>(`SELECT responsible_vendor_ids AS ids FROM public.event_schedule_blocks WHERE block_id = $1`, [block]);
  assert.deepEqual(tags.rows[0]!.ids, [survivor], 'the schedule item still points at the archived record');
  const rec = await db.query<{ archived: boolean }>(`SELECT archived_at IS NOT NULL AS archived FROM public.event_vendors WHERE vendor_id = $1`, [added.rowId]);
  assert.equal(rec.rows[0]!.archived, true);
  const pays = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE vendor_id = $1`, [survivor]);
  assert.equal(pays.rows[0]!.n, 1, 'the payment did not follow the booking (booked-if-paid would be lost)');
  const ask = await db.query<{ ev: string }>(`SELECT event_vendor_id AS ev FROM public.event_access_requests WHERE request_id = $1`, [c.ask]);
  assert.equal(ask.rows[0]!.ev, survivor);
  await asOwner();
});
