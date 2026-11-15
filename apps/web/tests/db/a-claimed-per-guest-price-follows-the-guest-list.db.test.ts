/**
 * 👥🧾 AFTER THE CLAIM, A PER-GUEST PRICE FOLLOWS THE GUEST LIST — migration 20271343652941 (DECISION_LOG 2026-11-13
 * "AFTER THE CLAIM, THE SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" · 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS
 * BACK — UNLESS THE SUPPLIER LOCKED IT").
 *
 * Against the replayed migrations, a supplier the couple added and priced per guest, once claimed (bonded to a shop):
 *   · its total follows the guest list through the shipped repricer — up, and back down to the total agreed;
 *   · a LOCKED one (booked, or the supplier agreed to the lock) rises and never falls;
 *   · paid stays: a payment is never touched, and the total never falls under it;
 *   · One price ignores the guest list;
 *   · a standing quote that follows the list stays the price (this pass stands aside);
 *   · SQL and the TS mirror (`lib/claimed-per-guest-follow.ts`) agree to the centavo.
 *
 * Run (from apps/web): tsx --test tests/db/a-claimed-per-guest-price-follows-the-guest-list.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { followClaimedPerGuest } from '../../lib/claimed-per-guest-follow';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

let seq = 0;
const uniq = () => `claimed-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type World = { eventId: string; host: string; shop: string; threadId: string };

async function newWorld(): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [supplier, `Kitchen ${uniq()}`],
    )
  ).rows[0]!.vendor_profile_id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2027-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const threadId = (
    await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
      [eventId, shop, host],
    )
  ).rows[0]!.thread_id;
  return { eventId, host, shop, threadId };
}

/** A supplier the couple added (per guest: the total + guests agreed), claimed — bonded to the shop. */
async function claimedBooking(
  w: World,
  opts: { basis?: 'per_pax' | null; total: number; guests?: number; status?: string; claimed?: boolean },
): Promise<string> {
  const basis = opts.basis === undefined ? 'per_pax' : opts.basis;
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, pricing_basis, pax_quote_base, marketplace_vendor_id)
     VALUES ($1, 'catering'::public.vendor_category, 'Rosa''s Kitchen', $2::public.vendor_status, $3, $4, $5, $6) RETURNING vendor_id`,
    [w.eventId, opts.status ?? 'considering', opts.total, basis, basis === 'per_pax' ? (opts.guests ?? 120) : (opts.guests ?? null), opts.claimed === false ? null : w.shop],
  );
  return r.rows[0]!.vendor_id;
}

async function addGuests(w: World, n: number): Promise<string[]> {
  if (n <= 0) return [];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
     SELECT $1, 'Guest ' || i, 'Cruz', 'both', 'friends', 'attending'::public.rsvp_status
       FROM generate_series(1, $2::int) AS i
     RETURNING guest_id`,
    [w.eventId, n],
  );
  return r.rows.map((x) => x.guest_id);
}
const removeGuests = (ids: string[]) => db.query(`DELETE FROM public.guests WHERE guest_id = ANY($1::uuid[])`, [ids]);

const total = async (vendorId: string) =>
  (await db.query<{ t: string | null }>(`SELECT total_cost_php::text AS t FROM public.event_vendors WHERE vendor_id = $1`, [vendorId])).rows[0]!.t;
const follow = async (vendorId: string) =>
  (
    await db.query<{ agreed_total_php: string; agreed_guests: number; billed_guests: number }>(
      `SELECT agreed_total_php::text AS agreed_total_php, agreed_guests, billed_guests FROM public.event_vendor_guest_follow WHERE event_vendor_id = $1`,
      [vendorId],
    )
  ).rows[0] ?? null;
const chatLines = async (w: World) =>
  (
    await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role = 'system' ORDER BY created_at, message_id`,
      [w.threadId],
    )
  ).rows.map((r) => r.body);

test('👥 a claimed per-guest total follows the guest list — up, and back down to the total agreed', async () => {
  const w = await newWorld();
  const v = await claimedBooking(w, { total: 162000, guests: 120 });
  const ids = await addGuests(w, 100);
  assert.equal(await total(v), '162000.00', 'under the guests agreed → the total agreed (the minimum)');

  const more = await addGuests(w, 30); // 130 counted
  assert.equal(await total(v), '175500.00', '₱162,000 ÷ 120 × 130');
  assert.deepEqual(await follow(v), { agreed_total_php: '162000.00', agreed_guests: 120, billed_guests: 130 });

  await removeGuests(more.slice(0, 5)); // 125
  assert.equal(await total(v), '168750.00', 'unlocked: it falls with the list');
  await removeGuests([...more.slice(5), ...ids.slice(0, 10)]); // 90
  assert.equal(await total(v), '162000.00', 'never below the guests agreed — exactly the total agreed again');

  const lines = await chatLines(w);
  assert.ok(lines.some((l) => /^Quote rose to 130 pax · \+/.test(l)), `the supplier's in-app line: ${lines.join(' | ')}`);
  assert.ok(lines.some((l) => /^Quote fell to 120 pax/.test(l)), `the fall-back line: ${lines.join(' | ')}`);
});

test('🔒 a locked total holds — booked (or agreed to the lock) rises with the list and never falls', async () => {
  const w = await newWorld();
  const booked = await claimedBooking(w, { total: 162000, guests: 120, status: 'contracted' });
  const ids = await addGuests(w, 130);
  assert.equal(await total(booked), '175500.00', 'a locked price still rises with the list');
  await removeGuests(ids.slice(0, 40)); // 90
  assert.equal(await total(booked), '175500.00', 'and never falls');

  const w2 = await newWorld();
  const agreed = await claimedBooking(w2, { total: 162000, guests: 120 });
  await db.query(`ALTER TABLE public.event_vendors DISABLE TRIGGER USER`);
  await db.query(`UPDATE public.event_vendors SET lock_agreed_at = now() WHERE vendor_id = $1`, [agreed]);
  await db.query(`ALTER TABLE public.event_vendors ENABLE TRIGGER USER`);
  const ids2 = await addGuests(w2, 125);
  assert.equal(await total(agreed), '168750.00');
  await removeGuests(ids2.slice(0, 20));
  assert.equal(await total(agreed), '168750.00', 'the supplier agreed to the lock → the price holds when guests leave');
});

test('💸 paid stays — the payment is never touched and the total never falls under it', async () => {
  const w = await newWorld();
  const v = await claimedBooking(w, { total: 162000, guests: 120 });
  const ids = await addGuests(w, 130);
  assert.equal(await total(v), '175500.00');
  const pay = await db.query<{ payment_id: string }>(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1, $2, 170000, 'GCash') RETURNING payment_id`,
    [w.eventId, v],
  );
  await removeGuests(ids.slice(0, 40)); // 90 counted → would be ₱162,000, under the ₱170,000 paid
  // It falls only as far as whole guests fit over what is paid: ₱162,000 ÷ 120 × 126 = ₱170,100.
  assert.equal(await total(v), '170100.00');
  assert.equal((await follow(v))!.billed_guests, 126);
  const paid = await db.query<{ a: string }>(`SELECT amount_php::text AS a FROM public.event_vendor_payments WHERE payment_id = $1`, [
    pay.rows[0]!.payment_id,
  ]);
  assert.equal(paid.rows[0]!.a, '170000.00', 'the paid amount never changes');
});

test('🧾 One price ignores guest changes — and an unclaimed per-guest record stays as typed', async () => {
  const w = await newWorld();
  // A One-price booking may still carry a guest count (the shipped `pax_quote_base`) — it counts nobody all the same.
  const band = await claimedBooking(w, { basis: null, total: 60000, guests: 100 });
  const own = await claimedBooking(w, { total: 162000, guests: 120, claimed: false });
  const ids = await addGuests(w, 150);
  await removeGuests(ids.slice(0, 100));
  assert.equal(await total(band), '60000.00', 'One price: one payment for the whole day');
  assert.equal(await total(own), '162000.00', 'before the claim the couple’s numbers stay as typed');
  assert.equal(await follow(band), null);
  assert.equal(await follow(own), null);
});

test('🤝 a standing quote that follows the list stays the price — the claimed pass stands aside', async () => {
  const w = await newWorld();
  const v = await claimedBooking(w, { total: 162000, guests: 120 });
  await db.query(
    `INSERT INTO public.vendor_proposals (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until)
     VALUES ($1, $2, 'Quote', 'sent', 16200000, now(), $3::jsonb, '{"min_pax":120,"billed_pax":120}'::jsonb, now() + interval '30 days')`,
    [w.eventId, w.shop, JSON.stringify([{ label: 'Buffet', detail: '120 pax', amount_centavos: 16200000, basis: 'per_pax', rate_centavos: 135000 }])],
  );
  await addGuests(w, 130);
  assert.equal(await total(v), '162000.00', 'the booking total is left to the quote');
  assert.equal(await follow(v), null);
});

test('🪞 SQL and the TS mirror agree to the centavo', async () => {
  const w = await newWorld();
  const v = await claimedBooking(w, { total: 100000, guests: 120 }); // ₱833.33… a guest — rounding is the test
  let billedNow = 120;
  let now = 100000;
  for (const n of [121, 7, 30, 3]) {
    const before = { billedNow, now };
    await addGuests(w, n);
    const count = (await db.query<{ c: number }>(`SELECT public.quote_guest_count($1, $2) AS c`, [w.eventId, v])).rows[0]!.c;
    const ts = followClaimedPerGuest({
      agreedTotalPhp: 100000, agreedGuests: 120, billedNow: before.billedNow, totalNowPhp: before.now,
      count, locked: false, paidPhp: 0, changesPhp: 0,
    });
    assert.ok(ts, `count ${count} moves it`);
    assert.equal(Number(await total(v)), ts!.totalPhp, `count ${count}`);
    billedNow = ts!.billed;
    now = ts!.totalPhp;
  }
});
