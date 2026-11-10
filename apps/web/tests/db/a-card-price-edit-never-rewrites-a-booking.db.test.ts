/**
 * 🔒 A CARD PRICE EDIT NEVER REWRITES A BOOKING — proved against the replayed database (Build 5 Lane C, "THE BOOKED
 * PRICE STAYS"; DECISION_LOG 2026-11-10 "WHAT YOU BOOK IS YOUR PRICE — AND THE APP SAYS SO ON BOTH SIDES").
 *
 * The Card Maker now tells a supplier "Couples who already booked keep their price. New bookings use the new price."
 * and the couple's Booked row says "Your price is set at booking. It changes only if you accept a change."
 * (`lib/booked-price-words.ts`). Both lines are promises about the DATABASE, so this holds the database to them:
 *
 *   ① a save of the card through the one write path (`save_vendor_service`) at a new starting price, and
 *   ② a direct edit of every other price column the card carries (per guest · per hour · extra hour),
 *
 * leave a couple's booking of THAT card exactly as agreed — its headline (`event_vendors.total_cost_php`), its lines
 * (no change line appears: a change reaches a booking only as a proposal the couple accepts), its payment plan, and the
 * thread's locked price (`chat_threads.agreed_price_centavos`). And ③ the edit really landed (the card's own price
 * history logged it), so ① and ② are not passing over an update that silently did nothing.
 *
 * Landings are measured as the owner, never from `RETURNING`.
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let vendorProfileId: string;
let cardId: string;
let threadId: string;
let bookingId: string;

const PLAN = [
  { seq: 0, label: 'Payment 1', amount_php: 50_000, due_date: '2027-01-15', amount_kind: 'fixed', percent_bps: null },
  { seq: 1, label: 'Payment 2', amount_php: 50_000, due_date: '2027-02-15', amount_kind: 'fixed', percent_bps: null },
];

async function save(serviceId: string | null, fields: Record<string, unknown>): Promise<string> {
  const r = await db.query<{ save_vendor_service: string }>(
    `SELECT public.save_vendor_service(
       $1::uuid, $2::uuid, $3::jsonb,
       '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, false)`,
    [vendorProfileId, serviceId, JSON.stringify(fields)],
  );
  return r.rows[0]!.save_vendor_service;
}

/** Everything the couple agreed to, read as the owner so nothing is hidden by RLS. */
async function theBooking() {
  const h = await db.query<{ total_cost_php: string | null; service_id: string | null }>(
    `SELECT total_cost_php::text, service_id FROM public.event_vendors WHERE vendor_id = $1`,
    [bookingId],
  );
  const lines = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.event_vendor_line_items WHERE vendor_id = $1`,
    [bookingId],
  );
  const plan = await db.query<{ instances_json: unknown }>(
    `SELECT instances_json FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [bookingId],
  );
  const t = await db.query<{ agreed_price_centavos: string | null }>(
    `SELECT agreed_price_centavos::text FROM public.chat_threads WHERE thread_id = $1`,
    [threadId],
  );
  return {
    headline: h.rows[0]?.total_cost_php == null ? null : Number(h.rows[0].total_cost_php),
    serviceId: h.rows[0]?.service_id ?? null,
    lines: Number(lines.rows[0]?.n ?? 0),
    plan: plan.rows[0]?.instances_json ?? null,
    locked: t.rows[0]?.agreed_price_centavos == null ? null : Number(t.rows[0].agreed_price_centavos),
  };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const shop = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('shop@bookedpricestays.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Price Stays Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [shop.rows[0]!.id],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
  cardId = await save(null, { category: 'photography', title: 'Wedding coverage', starting_price_php: 100_000 });

  const couple = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('couple@bookedpricestays.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('price-stays', 'birthday') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    eventId,
    couple.rows[0]!.id,
  ]);
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source, agreed_price_centavos, locked_at)
     VALUES ($1, $2, 'explore', 10000000, NOW()) RETURNING thread_id`,
    [eventId, vendorProfileId],
  );
  threadId = th.rows[0]!.thread_id;
  // Booked on THIS card at the price the card said then: ₱100,000.
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, service_id)
     VALUES ($1, 'photographer', 'Price Stays Studio', 'contracted', 100000, $2, $3) RETURNING vendor_id`,
    [eventId, vendorProfileId, cardId],
  );
  bookingId = ev.rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json, is_default_seeded)
     VALUES ($1, $2, $3::jsonb, false)`,
    [eventId, bookingId, JSON.stringify(PLAN)],
  );
});

after(async () => {
  await db?.close();
});

test('the booking starts as agreed: ₱100,000 on this card, no change lines, the plan, the locked ₱100,000', async () => {
  const b = await theBooking();
  assert.equal(b.serviceId, cardId);
  assert.equal(b.headline, 100_000);
  assert.equal(b.lines, 0);
  assert.deepEqual(b.plan, PLAN);
  assert.equal(b.locked, 10_000_000);
});

test('① a save of the card at a new price leaves the booking exactly as agreed', async () => {
  const before = await theBooking();
  await save(cardId, { category: 'photography', title: 'Wedding coverage', starting_price_php: 150_000 });
  assert.deepEqual(await theBooking(), before, 'a card price edit reached a booked couple — it may only arrive as a change they accept');
});

test('② editing every other price column on the card leaves the booking exactly as agreed', async () => {
  const before = await theBooking();
  await db.query(
    `UPDATE public.vendor_services
        SET starting_price_php = 80000, per_pax_price_php = 1200, hour_base_php = 30000, extra_hour_php = 5000
      WHERE vendor_service_id = $1`,
    [cardId],
  );
  assert.deepEqual(await theBooking(), before, 'a card price column reached a booked couple');
});

test('③ the edits really landed on the card (its price history logged both)', async () => {
  const card = await db.query<{ starting_price_php: number }>(
    `SELECT starting_price_php FROM public.vendor_services WHERE vendor_service_id = $1`,
    [cardId],
  );
  assert.equal(card.rows[0]!.starting_price_php, 80_000);
  const log = await db.query<{ old_price_php: number | null; new_price_php: number | null }>(
    `SELECT old_price_php, new_price_php FROM public.vendor_service_price_history
      WHERE vendor_service_id = $1 ORDER BY id`,
    [cardId],
  );
  assert.deepEqual(
    log.rows.map((r) => [r.old_price_php, r.new_price_php]),
    [
      [100_000, 150_000],
      [150_000, 80_000],
    ],
  );
});
