/**
 * ONE FREE FIRST BOOKING PER BUSINESS, NOT PER ACCOUNT. Executed against replayed migrations.
 *
 * ⚖ OWNER, 2026-11-06 (DECISION_LOG "ONE FREE FIRST BOOKING PER BUSINESS, NOT PER
 * ACCOUNT — THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION DESK"): the
 * desk matches the registration/permit number, phone and payout account against
 * other shops, and the second shop gets NO second free booking. Migration
 * 20271319712279.
 *
 *   1 · A SECOND ACCOUNT OF THE SAME BUSINESS IS BILLED — matched by registration
 *       number, by phone (written two different ways) and by payout account.
 *   2 · A GENUINELY NEW BUSINESS STILL GETS ITS FREE FIRST BOOKING.
 *   3 · A DEMO SHOP never matches. (`vendor_profiles.user_id` is UNIQUE, so every
 *       other shop is already another account — there is no same-owner case.)
 *   4 · FAIL CLOSED — when the match cannot run, the booking is BILLED, never free,
 *       and the reason is frozen.
 *   5 · NOTHING ALREADY GIVEN IS TAKEN BACK — a place frozen free stays free.
 *   6 · THE DESK and THE QUOTE read the same match the charge does.
 *
 * SABOTAGE (2026-11-07, each run against the replayed migrations, then reverted):
 *   · `v_is_free := FALSE;` removed from the business arm of
 *     `booking_fee_open_lock_charge` → tests 1a, 1b, 1c, 4 + 5 RED.
 *   · the `EXCEPTION WHEN OTHERS` arm of `booking_fee_business_free_standing`
 *     made to `RETURN 'available'` (fail OPEN) → test 4 RED alone.
 *   · `WHERE NOT COALESCE(vp.is_demo, FALSE)` dropped from the match → test 3 RED alone.
 *   · the business test dropped from `setnayan_gift_quote_applies` → test 6 RED alone.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

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
  // No launch offer, no promotion — the shop's own free booking is the only waiver.
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            launch_offer_booking_cap = 2000,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL
      WHERE id = 1`,
  );
});

let seq = 0;
const uniq = () => `perbiz-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@t.local`],
  );
  return u.rows[0]!.id;
}

type ShopArgs = {
  userId?: string;
  reg?: string | null;
  phone?: string | null;
  account?: string | null;
  demo?: boolean;
};

async function newShop(a: ShopArgs = {}): Promise<string> {
  const userId = a.userId ?? (await newUser());
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at,
        registration_number_raw, contact_phone, is_demo)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW(), $3, $4, $5)
     RETURNING vendor_profile_id`,
    [userId, `Shop ${uniq()}`, a.reg ?? null, a.phone ?? null, a.demo ?? false],
  );
  const vpid = v.rows[0]!.vendor_profile_id;
  if (a.account) {
    await db.query(
      `INSERT INTO public.vendor_payment_methods
         (vendor_profile_id, method_type, label, provider, account_name, account_number)
       VALUES ($1, 'bank', 'GCash', 'GCash', 'Owner', $2)`,
      [vpid, a.account],
    );
  }
  return vpid;
}

async function newBooking(vpid: string, status = 'contracted', sample = false) {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('An event','birthday','2030-08-01') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  // A demo shop can only be paired with a demo (sample) event — the demo_cross_booking trigger
  // (20271316355263_a_real_event_never_books_a_demo_shop) refuses a demo shop on a real event.
  if (sample) await db.query(`UPDATE public.events SET is_sample = TRUE WHERE event_id = $1`, [eventId]);
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','A Shop',$2::vendor_status,$3,50000) RETURNING vendor_id`,
    [eventId, status, vpid],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, 'explore')`,
    [eventId, vpid],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id };
}

type Open = {
  status?: string;
  booking_ordinal?: number | null;
  is_free?: boolean;
  free_withheld?: string | null;
  amount_charged_centavos?: number;
};
async function openCharge(evId: string): Promise<Open> {
  const r = await db.query<{ r: Open }>(`SELECT public.booking_fee_open_lock_charge($1) AS r`, [evId]);
  return r.rows[0]!.r;
}

async function ledgerOf(vpid: string, eventId: string) {
  const r = await db.query<{ is_free_booking: boolean | null; free_booking_withheld_reason: string | null }>(
    `SELECT is_free_booking, free_booking_withheld_reason FROM public.booking_fee_ledger
      WHERE vendor_profile_id = $1 AND event_id = $2`,
    [vpid, eventId],
  );
  return r.rows[0]!;
}

/** First shop takes the free booking; returns it. */
async function firstShopTakesTheFree(a: ShopArgs): Promise<string> {
  const vpid = await newShop(a);
  const first = await openCharge((await newBooking(vpid)).eventVendorId);
  assert.equal(first.status, 'waived_free5', `the first shop's first booking was ${first.status}`);
  return vpid;
}

async function assertBilledAsBusinessUsed(vpid: string, label: string) {
  const b = await newBooking(vpid);
  const res = await openCharge(b.eventVendorId);
  assert.equal(res.booking_ordinal, 1, `${label}: the shop's own ordinal moved`);
  assert.equal(res.status, 'pending', `${label}: a second account of the same business got ${res.status}`);
  assert.ok((res.amount_charged_centavos ?? 0) > 0, `${label}: the second account carried no fee`);
  assert.equal(res.is_free, false);
  assert.equal(res.free_withheld, 'business_already_used');
  const led = await ledgerOf(vpid, b.eventId);
  assert.equal(led.is_free_booking, false, `${label}: the ledger froze a second free place`);
  assert.equal(led.free_booking_withheld_reason, 'business_already_used');
}

test('0 · the migration replayed', async () => {
  assert.ok(
    !replay.skipped.some((s) => s.file.includes('one_free_first_booking_per_business')),
    'migration 20271319712279 was skipped',
  );
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc WHERE proname IN
       ('booking_fee_business_matches','booking_fee_business_free_standing')`,
  );
  assert.equal(r.rows[0]!.n, 2, 'the business functions are missing');
});

test('1a · same registration number on a NEW account → no second free booking', async () => {
  await firstShopTakesTheFree({ reg: 'DTI-1234-5678' });
  // The second shop typed the same papers differently, on a brand-new account.
  const second = await newShop({ reg: 'dti 1234 5678' });
  await assertBilledAsBusinessUsed(second, 'registration number');
});

test('1b · same phone (written another way) on a NEW account → no second free booking', async () => {
  await firstShopTakesTheFree({ phone: '+63 917 555 0101' });
  const second = await newShop({ phone: '0917-555-0101' });
  await assertBilledAsBusinessUsed(second, 'phone');
});

test('1c · same payout account on a NEW account → no second free booking', async () => {
  await firstShopTakesTheFree({ account: '0917 555 0202' });
  const second = await newShop({ account: '+639175550202' });
  await assertBilledAsBusinessUsed(second, 'payout account');
});

test('2 · a genuinely new business still gets its free first booking', async () => {
  await firstShopTakesTheFree({ reg: 'SEC-9999-0001', phone: '09175550303', account: '1234567890' });
  const stranger = await newShop({ reg: 'SEC-7777-0002', phone: '09175550404', account: '0987654321' });
  const b = await newBooking(stranger);
  const res = await openCharge(b.eventVendorId);
  assert.equal(res.status, 'waived_free5', `a new business lost its free booking: ${res.status}`);
  assert.equal(res.free_withheld ?? null, null);
  const s = await db.query<{ s: string }>(`SELECT public.booking_fee_business_free_standing($1) AS s`, [stranger]);
  assert.equal(s.rows[0]!.s, 'available');
  // ...and its SECOND booking is billed by its own ordinal, as before.
  const again = await openCharge((await newBooking(stranger)).eventVendorId);
  assert.equal(again.status, 'pending');
  assert.equal(again.booking_ordinal, 2);
});

test('3 · a demo shop never matches — it neither spends nor blocks a real business\u2019s free booking', async () => {
  // A demo shop holding the same papers took a "free" place and blocks nothing.
  const demo = await newShop({ reg: 'MP-5555-6666', phone: '09175550505', demo: true });
  await openCharge((await newBooking(demo, 'contracted', true)).eventVendorId);
  const real = await newShop({ reg: 'MP-5555-6666', phone: '09175550505' });
  const r = await openCharge((await newBooking(real)).eventVendorId);
  assert.equal(r.status, 'waived_free5', `a demo shop spent a real business's free booking: ${r.status}`);
  const m = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.booking_fee_business_matches(ARRAY[$1]::uuid[])`,
    [real],
  );
  assert.equal(m.rows[0]!.n, 0, 'the desk listed a demo shop as the same business');
});

test('4 · FAIL CLOSED — a match that cannot run bills the normal fee, never free', async () => {
  const shop = await newShop({ reg: 'FC-0000-1111' });
  const b = await newBooking(shop);
  await db.query('BEGIN');
  try {
    // Break the read the match depends on, for this transaction only.
    await db.query('ALTER TABLE public.vendor_payment_methods RENAME COLUMN account_number TO account_number_gone');
    const s = await db.query<{ s: string }>(`SELECT public.booking_fee_business_free_standing($1) AS s`, [shop]);
    assert.equal(s.rows[0]!.s, 'unreadable', 'a failed match did not say unreadable');
    const res = await openCharge(b.eventVendorId);
    assert.equal(res.status, 'pending', `a failed match granted ${res.status}`);
    assert.ok((res.amount_charged_centavos ?? 0) > 0, 'a failed match charged nothing');
    assert.equal(res.free_withheld, 'business_check_unreadable');
    const led = await ledgerOf(shop, b.eventId);
    assert.equal(led.is_free_booking, false);
    assert.equal(led.free_booking_withheld_reason, 'business_check_unreadable');
  } finally {
    await db.query('ROLLBACK');
  }
  const n = await db.query<{ s: string }>(`SELECT public.booking_fee_business_free_standing(NULL) AS s`);
  assert.equal(n.rows[0]!.s, 'unreadable', 'no shop at all must not read as available');
});

test('5 · a place frozen free stays free; the withheld one stays withheld', async () => {
  const first = await newShop({ reg: 'FZ-2222-3333' });
  const fb = await newBooking(first);
  assert.equal((await openCharge(fb.eventVendorId)).status, 'waived_free5');
  const second = await newShop({ reg: 'FZ-2222-3333' });
  const sb = await newBooking(second);
  assert.equal((await openCharge(sb.eventVendorId)).status, 'pending');
  // Re-asked (a re-lock): neither answer moves.
  const fAgain = await openCharge(fb.eventVendorId);
  assert.equal(fAgain.status, 'waived_free5', 'the first shop lost a free place it already held');
  const sAgain = await openCharge(sb.eventVendorId);
  assert.equal(sAgain.status, 'pending');
  assert.equal(sAgain.free_withheld, 'business_already_used', 'the frozen reason was not handed back');
});

test('6 · the desk and the quote read the same match the charge does', async () => {
  const first = await firstShopTakesTheFree({ reg: 'DK-4444-5555', phone: '09175550606' });
  const second = await newShop({ reg: 'DK 4444 5555', phone: '+63 917 555 0606' });
  const m = await db.query<{ vendor_profile_id: string; other_vendor_profile_id: string; matched_on: string[]; other_took_free: boolean }>(
    `SELECT * FROM public.booking_fee_business_matches(ARRAY[$1]::uuid[])`,
    [second],
  );
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0]!.other_vendor_profile_id, first);
  assert.deepEqual(m.rows[0]!.matched_on, ['phone', 'registration_number']);
  assert.equal(m.rows[0]!.other_took_free, true);

  // The quote, before the second shop's first booking exists, already says "not free".
  const ask = await newBooking(second, 'considering');
  const q = await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS a`, [ask.eventId, second]);
  assert.notEqual(q.rows[0]!.a, 'free_booking', 'the quote promised a second free booking to the same business');

  for (const fn of ['booking_fee_open_lock_charge', 'setnayan_gift_quote_applies']) {
    const d = await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.match(d.rows[0]!.def, /booking_fee_business_free_standing\(/, `${fn} does not ask the business`);
  }
});
