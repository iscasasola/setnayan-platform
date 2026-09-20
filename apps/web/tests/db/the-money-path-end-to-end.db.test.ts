/**
 * THE MONEY PATH — the whole revenue path, once, as one continuous run.
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 * Owner, 2026-09-20, having just driven it by hand as the supplier Saysay:
 * **"this is the most important part for us. because this is where we get
 * money."** That run — marketplace inquiry → priced quote → accept → ask to
 * lock → agree → first payment → confirm → the fee opens → the supplier pays →
 * Setnayan approves — is the ONLY time the path has ever been proven, and it was
 * proven by a person clicking. This file makes it provable on every PR.
 *
 * ── WHAT WAS ALREADY COVERED, AND IS NOT RE-DRAWN HERE ───────────────────────
 * RULE 0. The fee's own machinery is already asserted, well, next door, and this
 * file deliberately does not reproduce it:
 *   • `booking-fee-lock.db.test.ts` — the 5%/1% taper table, the free-5
 *     boundary, idempotent re-lock, off-platform/not-contracted skips, the
 *     settle bridge, SQL↔TS sourced-set parity.
 *   • `booking-fee-order-postconditions.db.test.ts` — the REAL
 *     `collectBookingFeeAtLock`: payer resolution, order shape, payment link,
 *     the compensating delete, `already_billed`.
 *   • `booking-fee-rederive.db.test.ts` — re-pricing on an amendment.
 *   • `apps/web/lib/accepted-quote-terms.test.ts` — the quote-terms reader.
 *
 * 🔑 WHAT NOBODY COVERED IS THE CONTINUITY. Every file above starts from a row
 * it minted itself: a `contracted` booking with a `total_cost_php` typed into a
 * fixture, a `chat_threads` row stamped 'explore' by hand. So each JOINT of the
 * path was tested and the CHAIN never was — and a chain of ten green links is
 * exactly how "₱0 committed" and "Paid ₱0" shipped. Here the number a step
 * asserts is the number the PREVIOUS step wrote: the fee is 5% of the figure
 * `respond_vendor_proposal` derived from the quote the supplier sent, the
 * deposit minimum is read back out of that same quote's frozen schedule, and
 * the ledger total is the amount the charge opened at.
 *
 * ── EVERY ASSERTION IS A ROW WITH A VALUE ────────────────────────────────────
 * Never "the call returned without an error". Nine of these ten transitions
 * have a success-shaped failure mode — an RPC that returns `{skipped: …}`, a
 * zero-row UPDATE, a charge that opens at ₱0 — so a test that only checked for
 * absence of a throw would pass against a body that had been deleted.
 *
 * ── A RED TEST HERE IS A MONEY DEFECT ────────────────────────────────────────
 * The booking fee is ARMED in production and has collected real pesos. If
 * anything in this file goes red, the first hypothesis is that THE MONEY PATH IS
 * WRONG. Do not adjust a number to make the suite green: reproduce the step,
 * read what the database actually holds, and report it.
 *
 * ── WHAT THIS FILE CANNOT DRIVE, said plainly ────────────────────────────────
 * Two steps have no headless entry point and are NOT claimed as proven:
 *   • Step 6 records the payment through `recordDeposit`, and step 10 approves
 *     it through `approvePaymentCore` — both Next.js server actions that open
 *     with `cookies()`/`auth.getUser()` and end in `revalidatePath`. What is
 *     executed here instead is (a) the pure decision each one delegates its
 *     money rule to — `decideDepositAmount`, and `settleBookingFeeCharge`,
 *     which is literally the call `sku-activation.ts` makes on approval — and
 *     (b) the row states those actions leave behind. The ORCHESTRATION around
 *     them (who may call it, what it revalidates, what it emails) is not
 *     covered here; `activation-ownership-gate.test.ts` pins that the
 *     activation hook's first effect is `settleBookingFeeCharge(`.
 *   • No pixel is asserted. This file proves the money, not that a screen
 *     prints it — the disease the 2026-08-20 sweep named. The render side is
 *     held by the `reads-are-honest` family.
 *
 * COST: one migration replay (~10 s, the same replay every other `*.db.test.ts`
 * pays) plus ~0.3 s of assertions. It runs in `test:db:ci`, which is a required
 * check, so the path is re-proven on every PR.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp, BOOKING_FEE } from '../../lib/booking-fee';
import {
  bookingFeeLockServiceKey,
  chargeIdFromBookingFeeLockServiceKey,
} from '../../lib/booking-fee-lock';
import { resolveSchedule } from '../../lib/proposal-payment-schedule';
import { acceptedQuoteTerms, decideDepositAmount } from '../../lib/accepted-quote-terms';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
/* The `server-only` shim rides along with this import (module scope), which is
 * what lets the dynamic import() in before() reach the production module. */
import { makeAdminClient } from './supabase-over-pglite';

let collectBookingFeeAtLock: typeof import('../../lib/booking-fee-lock.server').collectBookingFeeAtLock;
let settleBookingFeeCharge: typeof import('../../lib/booking-fee-charge').settleBookingFeeCharge;

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;

/* ════════════════════════════════════════════════════════════════════════════
 * THE NUMBERS FROM THE LIVE RUN (2026-09-19/20), in centavos.
 *
 * ⚠ These are the ONLY hard-coded pesos in the file. Everything downstream is
 * DERIVED from what the previous step actually wrote, so a step that quietly
 * loses a figure is caught rather than re-asserted.
 * ══════════════════════════════════════════════════════════════════════════ */
/** The photography service line. */
const SERVICE_C = 15_000_00;
/** The crew-meal line the supplier added. */
const CREW_MEAL_C = 1_750_00;
/** ₱16,750 — the quote total the couple accepted. */
const QUOTE_TOTAL_C = SERVICE_C + CREW_MEAL_C;
/** 20% on lock = ₱3,350. */
const DOWNPAYMENT_PCT = 20;
const DOWNPAYMENT_C = 3_350_00;
/** The balance, 14 days before the event = ₱13,400. */
const BALANCE_C = 13_400_00;
const BALANCE_OFFSET_DAYS = 14;
/** 5% of ₱16,750 = ₱837.50 — the fee the owner was actually billed. */
const FEE_C = 837_50;
/** Saysay's 6th booked customer: past the free five. */
const EXPECTED_ORDINAL = 6;
/** The marketplace surface the couple arrived through. */
const INQUIRY_SOURCE = 'shortlist';

/** Centavos → "₱837.50", for assertion messages only. */
const php = (c: number) => `₱${(c / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

/* ── State threaded through the run. A step that finds a hole here says so
 *    rather than asserting against undefined and blaming the wrong thing. ────*/
const run: {
  coupleUserId?: string;
  vendorUserId?: string;
  vendorProfileId?: string;
  eventId?: string;
  threadId?: string;
  proposalId?: string;
  eventVendorId?: string;
  paymentId?: string;
  chargeId?: string;
  orderId?: string;
} = {};

function need<K extends keyof typeof run>(k: K): NonNullable<(typeof run)[K]> {
  const v = run[k];
  if (v === undefined || v === null) {
    throw new Error(
      `the money path broke UPSTREAM of this step: \`${k}\` was never set, so an earlier ` +
        `transition did not complete. Read the first failure in this file, not this one.`,
    );
  }
  return v as NonNullable<(typeof run)[K]>;
}

/** One scalar out of the database. */
async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  if (r.rows.length !== 1) {
    throw new Error(`expected exactly 1 row, got ${r.rows.length}: ${sql}`);
  }
  return r.rows[0]!.v;
}

async function count(sql: string, params: unknown[] = []): Promise<number> {
  return Number(await one<number>(sql, params));
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  // The fee is ARMED in production; this file exercises the armed path.
  process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED = 'true';
  ({ collectBookingFeeAtLock } = await import('../../lib/booking-fee-lock.server'));
  ({ settleBookingFeeCharge } = await import('../../lib/booking-fee-charge'));
});

after(async () => {
  delete process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  await setAuthUid(db, null);
  await db?.close();
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 0 · The cast. A verified supplier with FIVE bookings already behind
 *          them, so the run's booking is the SIXTH and therefore billable.
 *
 * The free-five warm-up is deliberately NOT driven through the handshake: those
 * five are other couples' bookings, not this path, and minting them through the
 * lock RPC would assert the same transition six times over. What matters is that
 * they occupy ordinals 1–5 on the LEDGER, which is the state the frozen ordinal
 * is computed against.
 * ══════════════════════════════════════════════════════════════════════════ */
test('0 · a verified supplier, five bookings already behind them, and a couple', async () => {
  const supplier = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('saysay@money-path.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  run.vendorUserId = supplier.rows[0]!.id;

  // VERIFIED: event_vendors_require_verified_before_lock refuses the lock
  // otherwise, so a billable booking presupposes a verified identity.
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Saysay Studios', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [run.vendorUserId],
  );
  run.vendorProfileId = vp.rows[0]!.vendor_profile_id;

  const couple = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('rosa@money-path.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  run.coupleUserId = couple.rows[0]!.id;

  // Burn ordinals 1–5. No event_date on these: vendor_agree_to_lock's
  // "resolve the others first" rule keys on a shared event_date, and a stray
  // collision here would make the run's own agree return resolve_others_first.
  for (let i = 1; i <= 5; i++) {
    const e = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday')
       RETURNING event_id`,
      [`earlier-customer-${i}`],
    );
    const eid = e.rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eid, run.vendorProfileId],
    );
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1, 'photographer', 'Saysay Studios', 'contracted', 40000, $2)`,
      [eid, run.vendorProfileId],
    );
    const evId = await one<string>(
      `SELECT vendor_id AS v FROM public.event_vendors WHERE event_id = $1`,
      [eid],
    );
    const res = await one<{ status?: string; booking_ordinal?: number }>(
      `SELECT public.booking_fee_open_lock_charge($1) AS v`,
      [evId],
    );
    assert.equal(res.status, 'waived_free5', `warm-up booking ${i} must be one of the free five`);
    assert.equal(res.booking_ordinal, i, `warm-up booking ${i} took ordinal ${res.booking_ordinal}`);
  }

  const ordinals = await count(
    `SELECT count(*) AS v FROM public.booking_fee_ledger
      WHERE vendor_profile_id = $1 AND source = 'lock'`,
    [run.vendorProfileId],
  );
  assert.equal(ordinals, 5, 'the supplier must stand at exactly five booked customers');

  // Nothing has been billed yet: five free bookings must leave ZERO money.
  const billed = await count(
    `SELECT COALESCE(sum(amount_charged_centavos), 0) AS v FROM public.booking_fee_charges
      WHERE vendor_profile_id = $1`,
    [run.vendorProfileId],
  );
  assert.equal(billed, 0, `the first five bookings billed ${php(billed)} — they must bill ₱0`);
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 1 · THE COUPLE INQUIRES THROUGH THE MARKETPLACE.
 *
 * This is the step the whole fee rests on. Attribution is not a field anybody
 * sets at billing time — it is DERIVED from the thread stamped at first contact,
 * and it fails SAFE to `import` (free). So a thread that never records where the
 * couple came from is a fee Setnayan silently never collects, and a thread
 * mis-stamped the other way bills a supplier for a client they brought
 * themselves — the one outcome the model exists to prevent.
 * ══════════════════════════════════════════════════════════════════════════ */
test('1 · the couple inquires from the marketplace → the pair is SOURCED', async () => {
  const e = await db.query<{ event_id: string }>(
    // 'birthday' so the fixture needn't satisfy the wedding-field checks; a
    // real date because the quote's balance is due 14 days BEFORE the event.
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Rosa & Ben', 'birthday', (NOW() + INTERVAL '120 days')::date, 'day')
     RETURNING event_id`,
  );
  run.eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [run.eventId, need('coupleUserId')],
  );

  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, $3) RETURNING thread_id`,
    [run.eventId, need('vendorProfileId'), INQUIRY_SOURCE],
  );
  run.threadId = t.rows[0]!.thread_id;

  // The surface must be one the model calls marketplace discovery…
  assert.equal(
    await one<boolean>(`SELECT public.booking_fee_is_sourced_surface($1) AS v`, [INQUIRY_SOURCE]),
    true,
    `'${INQUIRY_SOURCE}' is no longer a billable discovery surface — the couple came through ` +
      `Setnayan and the supplier would be billed nothing`,
  );
  // …and the (vendor, event) pair must resolve to 'sourced' from that thread
  // ALONE. Nothing else in this file ever writes attribution.
  assert.equal(
    await one<string>(`SELECT public.booking_fee_attribution_for($1, $2) AS v`, [
      need('vendorProfileId'),
      need('eventId'),
    ]),
    'sourced',
    'the marketplace inquiry did not make this pair billable',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 2 · THE SUPPLIER SENDS A PRICED QUOTE — ₱16,750 with a schedule.
 *
 * The schedule is resolved by the PRODUCTION resolver, not typed as a literal:
 * `payment_schedule` is what step 6's minimum is read back out of, so if the
 * resolver stops paying to ₱0 the minimum it hands the couple is wrong too.
 * ══════════════════════════════════════════════════════════════════════════ */
test('2 · the supplier sends a priced quote — ₱16,750, 20% on lock, balance at −14 days', async () => {
  const lineItems = [
    { label: 'Wedding photography coverage', amount_centavos: SERVICE_C },
    { label: 'Crew meal', amount_centavos: CREW_MEAL_C },
  ];
  const lineTotal = lineItems.reduce((s, l) => s + l.amount_centavos, 0);
  assert.equal(
    lineTotal,
    QUOTE_TOTAL_C,
    `the quote's own lines sum to ${php(lineTotal)}, not ${php(QUOTE_TOTAL_C)}`,
  );

  const schedule = resolveSchedule({
    manual: [
      {
        label: 'Downpayment',
        kind: 'percent',
        amountPhp: null,
        percent: DOWNPAYMENT_PCT,
        due: 'on_lock',
        offsetDays: 0,
      },
    ],
    autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: BALANCE_OFFSET_DAYS },
    baseCentavos: QUOTE_TOTAL_C,
    // No crew-meal CREDIT here: on this quote the crew meal is a billed LINE,
    // which is why the couple's 20% is 20% of ₱16,750 and not of ₱15,000.
    creditCentavos: 0,
  });

  assert.equal(schedule.balances, true, 'the payment schedule does not pay the quote to ₱0');
  assert.equal(
    schedule.total_centavos,
    QUOTE_TOTAL_C,
    `the schedule collects ${php(schedule.total_centavos)} against a ${php(QUOTE_TOTAL_C)} quote`,
  );
  assert.equal(schedule.installments.length, 2, 'the owner sent two installments, not more');

  const [first, balance] = schedule.installments;
  assert.equal(first!.is_downpayment, true, 'seq 0 must be the downpayment — the lock amount');
  assert.equal(first!.due, 'on_lock');
  assert.equal(
    first!.amount_centavos,
    DOWNPAYMENT_C,
    `${DOWNPAYMENT_PCT}% of ${php(QUOTE_TOTAL_C)} came out as ${php(first!.amount_centavos)}, ` +
      `not ${php(DOWNPAYMENT_C)}`,
  );
  assert.equal(
    balance!.amount_centavos,
    BALANCE_C,
    `the balance came out as ${php(balance!.amount_centavos)}, not ${php(BALANCE_C)}`,
  );
  assert.equal(balance!.due, 'before_event');
  assert.equal(balance!.offset_days, BALANCE_OFFSET_DAYS);

  const p = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals
       (event_id, vendor_profile_id, title, status, sent_at, total_centavos,
        line_items, payment_schedule)
     VALUES ($1, $2, 'Photography — Rosa & Ben', 'sent', NOW(), $3, $4::jsonb, $5::jsonb)
     RETURNING proposal_id`,
    [
      need('eventId'),
      need('vendorProfileId'),
      QUOTE_TOTAL_C,
      JSON.stringify(lineItems),
      JSON.stringify(schedule),
    ],
  );
  run.proposalId = p.rows[0]!.proposal_id;
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 3 · THE COUPLE ACCEPTS — and the accepted total becomes the fee base.
 *
 * 🔑 THIS IS THE JOINT THAT CARRIES THE MONEY FORWARD. `respond_vendor_proposal`
 * writes `event_vendors.total_cost_php` from the quote's `total_centavos`, and
 * `booking_fee_open_lock_charge` takes 5% of THAT column. So the fee is 5% of
 * the quote only because this one division by 100 is right; nothing downstream
 * ever re-reads the quote.
 * ══════════════════════════════════════════════════════════════════════════ */
test('3 · the couple accepts → the booking carries the quote total, to the centavo', async () => {
  await setAuthUid(db, need('coupleUserId'));
  await db.query(`SELECT public.respond_vendor_proposal($1, 'accepted', 'photographer')`, [
    need('proposalId'),
  ]);

  assert.equal(
    await one<string>(`SELECT status AS v FROM public.vendor_proposals WHERE proposal_id = $1`, [
      need('proposalId'),
    ]),
    'accepted',
    'the accept did not stick',
  );

  const ev = await db.query<{ vendor_id: string; total_cost_php: string; status: string }>(
    `SELECT vendor_id, total_cost_php, status::text AS status FROM public.event_vendors
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [need('eventId'), need('vendorProfileId')],
  );
  assert.equal(ev.rows.length, 1, 'accepting one quote must leave exactly one booking row');
  run.eventVendorId = ev.rows[0]!.vendor_id;

  const carried = Math.round(Number(ev.rows[0]!.total_cost_php) * 100);
  assert.equal(
    carried,
    QUOTE_TOTAL_C,
    `the accept carried ${php(carried)} onto the booking from a ${php(QUOTE_TOTAL_C)} quote — ` +
      `the booking fee is a percentage of THIS number`,
  );

  // Accepting is not booking. Nothing is contracted and nothing is billable yet.
  assert.equal(ev.rows[0]!.status, 'shortlisted', 'accepting a quote must not book the supplier');
  const early = await one<{ skipped?: string }>(`SELECT public.booking_fee_open_lock_charge($1) AS v`, [
    run.eventVendorId,
  ]);
  assert.equal(
    early.skipped,
    'not_contracted',
    'a fee opened before the supplier ever agreed — the couple accepted, nobody booked',
  );
  assert.equal(
    await count(`SELECT count(*) AS v FROM public.booking_fee_charges WHERE event_vendor_id = $1`, [
      run.eventVendorId,
    ]),
    0,
    'the refused open still left a charge row behind',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 4 · THE COUPLE ASKS TO LOCK. An ask, not a booking (owner 2026-07-27).
 * ══════════════════════════════════════════════════════════════════════════ */
test('4 · the couple asks to lock → pending, and still nothing is billable', async () => {
  // The couple's own write path — their FOR ALL policy permits these columns;
  // the ANSWER (step 5) is DEFINER-only and is refused to them by a guard.
  await db.query(
    `UPDATE public.event_vendors
        SET lock_request_state = 'pending',
            lock_requested_at = NOW(),
            lock_requested_by_user_id = $2
      WHERE vendor_id = $1`,
    [need('eventVendorId'), need('coupleUserId')],
  );

  const row = await db.query<{ state: string; expires_at: string | null; status: string }>(
    `SELECT lock_request_state AS state, lock_request_expires_at AS expires_at,
            status::text AS status
       FROM public.event_vendors WHERE vendor_id = $1`,
    [need('eventVendorId')],
  );
  assert.equal(row.rows[0]!.state, 'pending', 'the ask did not land');
  assert.ok(
    row.rows[0]!.expires_at,
    'the guard trigger did not materialise the request deadline, so the ask can never lapse',
  );
  assert.equal(row.rows[0]!.status, 'shortlisted', 'asking must not book the supplier either');
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 5 · THE SUPPLIER AGREES → CONTRACTED. The booking becomes real.
 * ══════════════════════════════════════════════════════════════════════════ */
test('5 · the supplier agrees → the booking is contracted and linked', async () => {
  await setAuthUid(db, need('vendorUserId'));
  const res = await one<{ status?: string }>(`SELECT public.vendor_agree_to_lock($1) AS v`, [
    need('eventVendorId'),
  ]);
  assert.equal(
    res.status,
    'ok',
    `the supplier's Agree returned "${res.status}" instead of booking the couple`,
  );

  const row = await db.query<{
    state: string;
    status: string;
    agreed_at: string | null;
    linked: string | null;
  }>(
    `SELECT lock_request_state AS state, status::text AS status, lock_agreed_at AS agreed_at,
            linked_vendor_profile_id AS linked
       FROM public.event_vendors WHERE vendor_id = $1`,
    [need('eventVendorId')],
  );
  assert.equal(row.rows[0]!.state, 'agreed');
  assert.equal(row.rows[0]!.status, 'contracted', 'the agree did not contract the booking');
  assert.ok(row.rows[0]!.agreed_at, 'agreed with no receipt — the handshake has no date');
  assert.equal(
    row.rows[0]!.linked,
    need('vendorProfileId'),
    'the agree left linked_vendor_profile_id unset, so the booking is invisible to every ' +
      'feature that keys off it',
  );

  // Agreeing a second time is a no-op, not a second booking.
  const again = await one<{ status?: string }>(`SELECT public.vendor_agree_to_lock($1) AS v`, [
    need('eventVendorId'),
  ]);
  assert.equal(again.status, 'already', 'a second Agree did something');
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 6 · THE COUPLE RECORDS THE FIRST PAYMENT — ₱3,350.
 *
 * Owner, 2026-09-19: *"they will follow the amount requested and that means
 * that is the minimum."* The minimum is not a constant: it is read back out of
 * the schedule frozen on the quote in step 2, through the same two production
 * functions `recordDeposit` uses — `acceptedQuoteTerms` then
 * `decideDepositAmount`. So this step proves the quote and the deposit form are
 * talking about the same ₱3,350.
 * ══════════════════════════════════════════════════════════════════════════ */
test('6 · the first payment is ₱3,350, and a smaller one is refused by the quote', async () => {
  const quotes = await db.query<{
    status: string;
    total_centavos: string;
    line_items: unknown;
    payment_schedule: unknown;
  }>(
    `SELECT status, total_centavos, line_items, payment_schedule
       FROM public.vendor_proposals WHERE event_id = $1`,
    [need('eventId')],
  );
  const terms = acceptedQuoteTerms(quotes.rows, null);
  assert.ok(terms, 'the accepted quote is unreadable, so no minimum reaches the couple at all');
  assert.equal(
    terms.firstPaymentCentavos,
    DOWNPAYMENT_C,
    `the quote asks for ${php(terms.firstPaymentCentavos ?? 0)} as its first payment, ` +
      `not ${php(DOWNPAYMENT_C)}`,
  );

  // THE REFUSAL. ₱1 under the requested downpayment must not be recordable.
  const short = decideDepositAmount({
    amountPhp: (DOWNPAYMENT_C - 100) / 100,
    minimumCentavos: terms.firstPaymentCentavos,
    vendorName: 'Saysay Studios',
  });
  assert.equal(
    short.ok,
    false,
    `a ${php(DOWNPAYMENT_C - 100)} deposit was accepted against a ${php(DOWNPAYMENT_C)} request — ` +
      `the supplier's schedule is not being enforced`,
  );
  assert.match(
    short.ok === false ? short.message : '',
    /₱3,350/,
    'the refusal does not tell the couple the amount that WOULD be accepted',
  );

  // And ₱0 / a negative is refused by the ledger itself, not only by the form.
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php)
       VALUES ($1, $2, 0)`,
      [need('eventId'), need('eventVendorId')],
    ),
    'a ₱0 payment reached the supplier ledger',
  );

  // THE REAL PAYMENT.
  const ok = decideDepositAmount({
    amountPhp: DOWNPAYMENT_C / 100,
    minimumCentavos: terms.firstPaymentCentavos,
    vendorName: 'Saysay Studios',
  });
  assert.equal(ok.ok, true, 'the exact amount the supplier asked for was refused');
  assert.equal(ok.ok === true ? ok.amountCentavos : 0, DOWNPAYMENT_C);

  const pay = await db.query<{ payment_id: string }>(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, reference)
     VALUES ($1, $2, $3, 'gcash', 'MONEY-PATH-1') RETURNING payment_id`,
    [need('eventId'), need('eventVendorId'), DOWNPAYMENT_C / 100],
  );
  run.paymentId = pay.rows[0]!.payment_id;
  await db.query(
    `UPDATE public.event_vendors SET deposit_recorded_at = NOW() WHERE vendor_id = $1`,
    [need('eventVendorId')],
  );

  const recorded = await count(
    `SELECT COALESCE(sum(amount_php * 100), 0) AS v FROM public.event_vendor_payments
      WHERE vendor_id = $1`,
    [need('eventVendorId')],
  );
  assert.equal(
    recorded,
    DOWNPAYMENT_C,
    `the booking's ledger holds ${php(recorded)} after one ${php(DOWNPAYMENT_C)} payment`,
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 7 · THE SUPPLIER CONFIRMS IT ARRIVED → the deposit is acknowledged.
 *
 * ⚠ TWO DOORS LEAD HERE and they must not both count. `confirm_vendor_payment`
 * settles the LEDGER ROW; `acknowledge_vendor_deposit` settles the BOOKING. A
 * second trip through either is a no-op — asserted, because a second
 * acknowledged deposit is a second reason to open a fee.
 * ══════════════════════════════════════════════════════════════════════════ */
test('7 · the supplier confirms receipt → acknowledged once, however many doors', async () => {
  await setAuthUid(db, need('vendorUserId'));

  // Door 1 — the ledger row. The stamp is read as TEXT, not as a Date: two
  // Date objects holding the same instant are not `strictEqual`, and an
  // idempotence assertion that can never hold is worse than none.
  const confirmStamp = () =>
    one<string | null>(
      `SELECT vendor_confirmed_at::text AS v FROM public.event_vendor_payments
        WHERE payment_id = $1`,
      [need('paymentId')],
    );
  await db.query(`SELECT public.confirm_vendor_payment($1)`, [need('paymentId')]);
  const confirmedAt = await confirmStamp();
  assert.ok(confirmedAt, 'the supplier confirmed and the payment row still reads unconfirmed');

  // Idempotent: the same confirmation twice does not move the stamp.
  await db.query(`SELECT public.confirm_vendor_payment($1)`, [need('paymentId')]);
  assert.equal(await confirmStamp(), confirmedAt, 'a second confirm re-stamped the payment');

  // Door 2 — the booking.
  const ack = await one<{ status?: string }>(`SELECT public.acknowledge_vendor_deposit($1) AS v`, [
    need('eventVendorId'),
  ]);
  assert.equal(ack.status, 'ok', `the deposit acknowledge returned "${ack.status}"`);
  assert.ok(
    await one<string | null>(
      `SELECT deposit_acknowledged_at AS v FROM public.event_vendors WHERE vendor_id = $1`,
      [need('eventVendorId')],
    ),
    'acknowledged with no receipt on the booking',
  );

  const ackAgain = await one<{ status?: string }>(
    `SELECT public.acknowledge_vendor_deposit($1) AS v`,
    [need('eventVendorId')],
  );
  assert.equal(ackAgain.status, 'already', 'the deposit was acknowledged twice');

  // One payment, one deposit. Not two.
  assert.equal(
    await count(
      `SELECT count(*) AS v FROM public.event_vendor_payments WHERE vendor_id = $1`,
      [need('eventVendorId')],
    ),
    1,
    'the confirmation minted a second payment row',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 8 · THE BOOKING FEE OPENS — ₱837.50, ordinal 6, pending, 7-day expiry.
 *
 * The expected fee is computed TWO independent ways and both must agree with the
 * charge: from the LIVE admin-editable schedule (so an owner reprice moves the
 * expectation with the bill), and against the absolute ₱837.50 the owner was
 * actually billed (so a reprice of the DEFAULTS is caught too). A single
 * measurement is a hypothesis.
 * ══════════════════════════════════════════════════════════════════════════ */
test('8 · the fee opens at ₱837.50 — 5% of the accepted total, the 6th booking', async () => {
  // The schedule as an admin can currently set it.
  const settings = await db.query<{
    rate: string | null;
    tail: string | null;
    band: string | null;
  }>(
    `SELECT booking_fee_rate_pct AS rate, booking_fee_tail_rate_pct AS tail,
            booking_fee_tier1_limit_php AS band
       FROM public.platform_settings LIMIT 1`,
  );
  const live =
    settings.rows.length === 1
      ? {
          rate: Number(settings.rows[0]!.rate) / 100,
          tailRate: Number(settings.rows[0]!.tail) / 100,
          tier1LimitPhp: Number(settings.rows[0]!.band),
          minPhp: BOOKING_FEE.minPhp,
        }
      : BOOKING_FEE;

  // The three numbers the owner-locked model names, as they stand right now.
  assert.equal(live.rate, 0.05, 'the headline booking-fee rate is no longer 5%');
  assert.equal(live.tailRate, 0.01, 'the tail rate above the band is no longer 1%');
  assert.equal(live.tier1LimitPhp, 100_000, 'the 5% band no longer ends at ₱100,000');
  assert.equal(live.minPhp, 50, 'the ₱50 floor moved');

  // The SQL fee function must agree with the TS one AT the live settings — and
  // the floor and the band edge are the two places they historically drift.
  for (const php_ of [500, 1_000, 16_750, 100_000, 100_001, 300_000, 1_000_000]) {
    const sql = Number(
      await one<number>(`SELECT public.booking_fee_centavos($1)::bigint AS v`, [php_ * 100]),
    );
    assert.equal(
      sql,
      Math.round(bookingFeePhp(php_, live) * 100),
      `SQL and TS disagree on the fee for ₱${php_.toLocaleString('en-PH')} — the bill and the ` +
        `screen would quote different money`,
    );
  }
  assert.equal(
    Number(await one<number>(`SELECT public.booking_fee_centavos($1)::bigint AS v`, [500_00])),
    50_00,
    'the ₱50 floor no longer binds below ₱1,000',
  );
  assert.equal(
    Number(await one<number>(`SELECT public.booking_fee_centavos(0)::bigint AS v`)),
    0,
    'a ₱0 / barter booking is no longer free',
  );

  // THE CHARGE. Driven through the production module, not the RPC, because the
  // env gate and the schedule version are part of what has to be right.
  const collected = await collectBookingFeeAtLock(admin, { eventVendorId: need('eventVendorId') });
  assert.equal(
    collected.status,
    'ordered',
    `the fee did not open a bill: "${collected.status}"` +
      ('reason' in collected && collected.reason ? ` (${collected.reason})` : ''),
  );
  run.chargeId = 'chargeId' in collected ? collected.chargeId : undefined;
  run.orderId = 'orderId' in collected ? (collected.orderId ?? undefined) : undefined;
  assert.ok(need('chargeId'), 'ordered with no charge id');

  const charge = await db.query<{
    status: string;
    amount: string;
    fee: string;
    basis: string;
    ordinal: number | null;
    free: boolean | null;
    attribution: string;
    days: string | null;
    version: string;
  }>(
    `SELECT c.status, c.amount_charged_centavos AS amount, c.computed_fee_centavos AS fee,
            c.proposal_amount_centavos AS basis, l.booking_ordinal AS ordinal,
            l.is_free_booking AS free, l.attribution,
            round(EXTRACT(EPOCH FROM (c.expires_at - NOW())) / 86400)::text AS days,
            c.schedule_version AS version
       FROM public.booking_fee_charges c
       JOIN public.booking_fee_ledger l ON l.ledger_id = c.ledger_id
      WHERE c.charge_id = $1`,
    [need('chargeId')],
  );
  const c = charge.rows[0]!;

  assert.equal(
    Number(c.basis),
    QUOTE_TOTAL_C,
    `the fee was computed against ${php(Number(c.basis))}, not the ${php(QUOTE_TOTAL_C)} the ` +
      `couple accepted`,
  );
  assert.equal(
    Number(c.fee),
    FEE_C,
    `the fee came out as ${php(Number(c.fee))}, not ${php(FEE_C)}`,
  );
  assert.equal(
    Number(c.fee),
    Math.round(bookingFeePhp(QUOTE_TOTAL_C / 100, live) * 100),
    'the charge disagrees with the LIVE fee schedule an admin can read at /admin/pricing',
  );
  assert.equal(Number(c.amount), FEE_C, 'the amount billed differs from the fee computed');
  assert.equal(c.status, 'pending', `the charge opened '${c.status}' rather than awaiting payment`);
  assert.equal(c.attribution, 'sourced', 'the billed charge does not say Setnayan sourced it');
  assert.equal(
    c.ordinal,
    EXPECTED_ORDINAL,
    `this booking took ordinal ${c.ordinal}; it is the supplier's ${EXPECTED_ORDINAL}th customer`,
  );
  assert.equal(c.free, false, 'the 6th booking was treated as one of the free five');
  assert.equal(Number(c.days), 7, `the charge is due in ${c.days} days, not 7`);
  assert.equal(
    c.version,
    '2026-07-25-taper5-1-over-100k',
    'the charge was stamped with an unexpected schedule version, so history stops being readable',
  );

  // EXACTLY ONE charge for this booking — no second deposit, no second bill.
  assert.equal(
    await count(
      `SELECT count(*) AS v FROM public.booking_fee_charges WHERE event_vendor_id = $1`,
      [need('eventVendorId')],
    ),
    1,
    'the booking carries more than one booking-fee charge',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 9 · THE SUPPLIER IS BILLED — an order on the manual QR rail + a payment
 *          row, which is what puts it in /admin/payments.
 * ══════════════════════════════════════════════════════════════════════════ */
test('9 · the bill exists, names the supplier as payer, and points back at the charge', async () => {
  const serviceKey = bookingFeeLockServiceKey(need('chargeId'));
  const order = await db.query<{
    order_id: string;
    user_id: string | null;
    vendor_profile_id: string | null;
    event_id: string | null;
    status: string;
    total: string;
    service_key: string;
    reference_code: string | null;
  }>(
    `SELECT order_id, user_id, vendor_profile_id, event_id, status::text AS status,
            requested_total_php AS total, service_key, reference_code
       FROM public.orders WHERE service_key = $1`,
    [serviceKey],
  );
  assert.equal(order.rows.length, 1, `expected exactly one bill for ${serviceKey}`);
  const o = order.rows[0]!;
  assert.equal(o.order_id, need('orderId'), 'the returned order id is not the row that exists');

  // 🔑 THE KEY IS THE CHARGE. This round trip is the ENTIRE mechanism by which
  // an approved payment finds the charge to settle; break the prefix and the
  // money is collected and never credited.
  assert.equal(
    chargeIdFromBookingFeeLockServiceKey(o.service_key),
    need('chargeId'),
    'the bill cannot be traced back to its charge',
  );

  assert.equal(
    o.user_id,
    need('vendorUserId'),
    'the bill is not addressed to the SUPPLIER — the fee is never the couple’s to pay',
  );
  assert.equal(o.vendor_profile_id, need('vendorProfileId'));
  assert.equal(o.event_id, need('eventId'), 'the bill lost the celebration it is for');
  assert.equal(o.status, 'submitted', `the bill opened '${o.status}'`);
  assert.ok(o.reference_code, 'the bill has no reference code, so a QR transfer cannot be matched');

  // The billed peso amount is the fee plus whatever Setnayan gift the charge
  // sized — never less than the fee, and never a different fee.
  const gift = await db.query<{ credits: string | null; centavos: string | null }>(
    `SELECT gift_credits AS credits, gift_centavos AS centavos
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [need('chargeId')],
  );
  const giftCredits = Math.max(0, Math.trunc(Number(gift.rows[0]?.credits) || 0));
  const giftC = giftCredits > 0 ? Math.max(0, Math.round(Number(gift.rows[0]?.centavos) || 0)) : 0;
  assert.equal(
    Math.round(Number(o.total) * 100),
    FEE_C + giftC,
    `the supplier is billed ${php(Math.round(Number(o.total) * 100))} against a ${php(FEE_C)} ` +
      `fee + ${php(giftC)} gift`,
  );

  // One payment row, for the same money, addressed to the same payer.
  const pays = await db.query<{ amount: string; user_id: string | null; channel: string }>(
    `SELECT amount_php AS amount, user_id, channel FROM public.payments WHERE order_id = $1`,
    [need('orderId')],
  );
  assert.equal(pays.rows.length, 1, 'the bill has no single pending payment to reconcile');
  assert.equal(
    Math.round(Number(pays.rows[0]!.amount) * 100),
    Math.round(Number(o.total) * 100),
    'the payment asks for a different amount than the order',
  );
  assert.equal(pays.rows[0]!.user_id, need('vendorUserId'));
  assert.equal(pays.rows[0]!.channel, 'manual', 'the fee left the manual GCash/BDO rail');

  /* ── PAYING THROUGH TWO DOORS MUST NEVER BILL TWICE ────────────────────────*/
  // Door A · the TS mint again (a re-acknowledge, a retry).
  const again = await collectBookingFeeAtLock(admin, { eventVendorId: need('eventVendorId') });
  assert.equal(
    again.status,
    'order_exists',
    `a second collect returned '${again.status}' instead of finding the bill it already made`,
  );
  // Door B · the SQL amendment writer, which mints the same key from a trigger.
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [need('chargeId')]);
  // Door C · the database itself, asked point blank for a duplicate.
  // ⚠ EVERY OTHER NOT-NULL COLUMN IS FILLED IN, and the rejection is matched on
  // its SQLSTATE meaning, not merely on "it threw". The first two drafts of this
  // INSERT omitted `description` and then `reference_code` — both rejected, and
  // both would have "proved" a uniqueness guard that was not the thing refusing.
  // The regex is what caught that; a bare assert.rejects would have shipped a
  // guard that passes with the index dropped.
  await assert.rejects(
    db.query(
      `INSERT INTO public.orders
         (event_id, user_id, service_key, description, requested_total_php, status,
          reference_code)
       VALUES ($1, $2, $3, 'a second bill for one charge', 1, 'submitted',
               'MONEY-PATH-DUPLICATE')`,
      [need('eventId'), need('vendorUserId'), serviceKey],
    ),
    (err: unknown) =>
      /duplicate key|unique/i.test(String((err as { message?: string })?.message ?? err)),
    'the database accepted a SECOND bill for one booking-fee charge',
  );

  assert.equal(
    await count(`SELECT count(*) AS v FROM public.orders WHERE service_key = $1`, [serviceKey]),
    1,
    'three doors and more than one bill came out',
  );
  assert.equal(
    await count(`SELECT count(*) AS v FROM public.payments WHERE order_id = $1`, [need('orderId')]),
    1,
    'the supplier can be asked for the fee twice',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * STEP 10 · SETNAYAN APPROVES THE FEE PAYMENT → the charge settles and the
 *           ledger records the first money this platform has ever earned.
 *
 * `settleBookingFeeCharge` below is not a stand-in: it is the exact call
 * `sku-activation.ts` makes when an approved order carries a
 * `vendor_booking_fee__{charge_id}` key. What is NOT executed here is
 * `approvePaymentCore`'s surrounding server action (see the file header).
 * ══════════════════════════════════════════════════════════════════════════ */
test('10 · Setnayan approves → charge paid, order paid, payment matched, ledger ₱837.50', async () => {
  const ledgerBefore = await count(
    `SELECT fee_paid_total_centavos AS v FROM public.booking_fee_ledger
      WHERE vendor_profile_id = $1 AND event_id = $2`,
    [need('vendorProfileId'), need('eventId')],
  );
  assert.equal(ledgerBefore, 0, 'the ledger already held money before anybody approved anything');

  // The admin's two reconciliation writes (approvePaymentCore), then the
  // activation hook's settle.
  await db.query(
    `UPDATE public.payments SET status = 'matched' WHERE order_id = $1 AND status <> 'matched'`,
    [need('orderId')],
  );
  await db.query(`UPDATE public.orders SET status = 'paid' WHERE order_id = $1`, [need('orderId')]);

  const settled = await settleBookingFeeCharge(
    admin,
    need('chargeId'),
    'manual',
    need('orderId'),
  );
  assert.equal(
    settled?.settled,
    true,
    'the approval did not settle the charge — the money arrived and was never credited',
  );

  const charge = await db.query<{
    status: string;
    paid_at: string | null;
    gateway: string | null;
    ref: string | null;
  }>(
    `SELECT status, paid_at, gateway, payment_ref AS ref FROM public.booking_fee_charges
      WHERE charge_id = $1`,
    [need('chargeId')],
  );
  assert.equal(charge.rows[0]!.status, 'paid', 'the charge is still pending after approval');
  assert.ok(charge.rows[0]!.paid_at, 'paid with no paid_at — the receipt has no date');
  assert.equal(charge.rows[0]!.gateway, 'manual');
  assert.equal(
    charge.rows[0]!.ref,
    need('orderId'),
    'the settled charge does not name the order that paid it',
  );

  assert.equal(
    await one<string>(`SELECT status::text AS v FROM public.orders WHERE order_id = $1`, [
      need('orderId'),
    ]),
    'paid',
    'the order did not reach paid',
  );
  assert.equal(
    await one<string>(`SELECT status::text AS v FROM public.payments WHERE order_id = $1`, [
      need('orderId'),
    ]),
    'matched',
    'the payment was never matched, so /admin/payments still shows it outstanding',
  );

  const earned = await count(
    `SELECT fee_paid_total_centavos AS v FROM public.booking_fee_ledger
      WHERE vendor_profile_id = $1 AND event_id = $2`,
    [need('vendorProfileId'), need('eventId')],
  );
  assert.equal(
    earned,
    FEE_C,
    `the ledger recorded ${php(earned)} for a ${php(FEE_C)} fee`,
  );

  /* ── APPROVING TWICE MUST NOT EARN TWICE ───────────────────────────────────*/
  const twice = await settleBookingFeeCharge(admin, need('chargeId'), 'manual', need('orderId'));
  assert.equal(twice?.settled, false, 'a second approval settled the charge again');
  assert.equal(
    await count(
      `SELECT fee_paid_total_centavos AS v FROM public.booking_fee_ledger
        WHERE vendor_profile_id = $1 AND event_id = $2`,
      [need('vendorProfileId'), need('eventId')],
    ),
    FEE_C,
    'a second approval rolled the fee into the ledger a second time',
  );

  // The whole run, in one sentence of arithmetic: one booking, one charge, one
  // bill, one payment, and ₱837.50 earned against a ₱16,750 wedding.
  const totals = await db.query<{ charges: string; billed: string; earned: string }>(
    `SELECT (SELECT count(*) FROM public.booking_fee_charges WHERE event_vendor_id = $1) AS charges,
            (SELECT count(*) FROM public.orders WHERE service_key = $2) AS billed,
            (SELECT sum(fee_paid_total_centavos) FROM public.booking_fee_ledger
              WHERE vendor_profile_id = $3) AS earned`,
    [need('eventVendorId'), bookingFeeLockServiceKey(need('chargeId')), need('vendorProfileId')],
  );
  assert.deepEqual(
    {
      charges: Number(totals.rows[0]!.charges),
      billed: Number(totals.rows[0]!.billed),
      earned: Number(totals.rows[0]!.earned),
    },
    { charges: 1, billed: 1, earned: FEE_C },
    'the run did not end at exactly one charge, one bill and ₱837.50 earned',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * THE WAIVED CASE · a booking inside the first five bills nothing and STILL
 * unlocks. The two halves are equally load-bearing: a waiver that blocked the
 * booking would punish the supplier for the courtesy, and a waiver that minted a
 * bill would charge them for it.
 * ══════════════════════════════════════════════════════════════════════════ */
test('waived · a booking inside the first five bills ₱0, mints no bill, and still books', async () => {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('newshop@money-path.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const shopUserId = u.rows[0]!.id;
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Brand New Shop', 'Cebu', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [shopUserId],
  );
  const vpid = vp.rows[0]!.vendor_profile_id;

  const coupleU = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('firstcouple@money-path.test', jsonb_build_object('account_type','customer'))
     RETURNING id`,
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('First Customer', 'birthday')
     RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleU.rows[0]!.id],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, $3)`,
    [eventId, vpid, INQUIRY_SOURCE],
  );
  const evRow = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id,
        lock_request_state, lock_requested_at, lock_requested_by_user_id)
     VALUES ($1, 'photographer', 'Brand New Shop', 'shortlisted', $2, $3,
             'pending', NOW(), $4)
     RETURNING vendor_id`,
    [eventId, QUOTE_TOTAL_C / 100, vpid, coupleU.rows[0]!.id],
  );
  const evId = evRow.rows[0]!.vendor_id;

  // The shop agrees — the same transition step 5 drove.
  await setAuthUid(db, shopUserId);
  const agreed = await one<{ status?: string }>(`SELECT public.vendor_agree_to_lock($1) AS v`, [
    evId,
  ]);
  assert.equal(agreed.status, 'ok', `a first-five booking could not be agreed: ${agreed.status}`);
  assert.equal(
    await one<string>(`SELECT status::text AS v FROM public.event_vendors WHERE vendor_id = $1`, [
      evId,
    ]),
    'contracted',
    'THE WAIVER BLOCKED THE BOOKING — a free booking must still book',
  );

  const collected = await collectBookingFeeAtLock(admin, { eventVendorId: evId });
  assert.equal(
    collected.status,
    'free',
    `a first-five booking came back '${collected.status}' instead of free`,
  );
  const chargeId = 'chargeId' in collected ? collected.chargeId! : '';

  const c = await db.query<{ status: string; amount: string; fee: string; ordinal: number | null }>(
    `SELECT c.status, c.amount_charged_centavos AS amount, c.computed_fee_centavos AS fee,
            l.booking_ordinal AS ordinal
       FROM public.booking_fee_charges c
       JOIN public.booking_fee_ledger l ON l.ledger_id = c.ledger_id
      WHERE c.charge_id = $1`,
    [chargeId],
  );
  assert.equal(c.rows[0]!.status, 'waived_free5', 'the waiver does not say WHY it was free');
  assert.equal(
    Number(c.rows[0]!.amount),
    0,
    `a free booking was billed ${php(Number(c.rows[0]!.amount))}`,
  );
  assert.equal(c.rows[0]!.ordinal, 1, 'the shop’s first customer did not take ordinal 1');

  // The receipt exists and the BILL does not.
  assert.equal(
    await count(`SELECT count(*) AS v FROM public.orders WHERE service_key = $1`, [
      bookingFeeLockServiceKey(chargeId),
    ]),
    0,
    'a WAIVED booking minted a payable bill',
  );
  assert.equal(
    await count(
      `SELECT fee_paid_total_centavos AS v FROM public.booking_fee_ledger
        WHERE vendor_profile_id = $1`,
      [vpid],
    ),
    0,
    'a waived booking moved money into the ledger',
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * THE SKIPS · a failed existence check must bill NOTHING rather than bill twice.
 *
 * Every arm below returns a NON-ERROR status and writes no money row, which is
 * why they are asserted positively (no charge, no order) and not merely "it did
 * not throw". These are the shapes that made `collectBookingFeeAtLock` succeed
 * while doing nothing in the first place.
 * ══════════════════════════════════════════════════════════════════════════ */
test('skips · a booking that cannot be billed is skipped, never billed twice', async () => {
  const before = await count(`SELECT count(*) AS v FROM public.booking_fee_charges`);

  // A booking that does not exist.
  const gone = await collectBookingFeeAtLock(admin, {
    eventVendorId: '00000000-0000-4000-8000-000000000000',
  });
  assert.equal(gone.status, 'skipped', `a missing booking returned '${gone.status}'`);

  // An off-platform supplier: no marketplace identity, so no fee, ever.
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('off-platform', 'birthday')
     RETURNING event_id`,
  );
  const off = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, 'photographer', 'Tita’s Cousin', 'contracted', 50000) RETURNING vendor_id`,
    [e.rows[0]!.event_id],
  );
  const offRes = await collectBookingFeeAtLock(admin, { eventVendorId: off.rows[0]!.vendor_id });
  assert.equal(offRes.status, 'skipped');

  // A client the SUPPLIER brought: no marketplace thread → waived, never billed.
  const byoUser = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ('byo@money-path.test', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const byoVp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Own Audience Studio', 'Davao', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [byoUser.rows[0]!.id],
  );
  const byoEvent = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('BYO couple', 'birthday')
     RETURNING event_id`,
  );
  // Arrived through the shop's OWN link — an import, closed by the owner 2026-07-26.
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
     VALUES ($1, $2, 'website')`,
    [byoEvent.rows[0]!.event_id, byoVp.rows[0]!.vendor_profile_id],
  );
  const byoEv = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Own Audience Studio', 'contracted', 200000, $2)
     RETURNING vendor_id`,
    [byoEvent.rows[0]!.event_id, byoVp.rows[0]!.vendor_profile_id],
  );
  const byo = await collectBookingFeeAtLock(admin, { eventVendorId: byoEv.rows[0]!.vendor_id });
  assert.equal(
    byo.status,
    'zero_fee',
    `a client the shop brought came back '${byo.status}' — it must cost them ₱0`,
  );
  const byoCharge = await db.query<{ status: string; amount: string }>(
    `SELECT status, amount_charged_centavos AS amount FROM public.booking_fee_charges
      WHERE event_vendor_id = $1`,
    [byoEv.rows[0]!.vendor_id],
  );
  assert.equal(byoCharge.rows[0]!.status, 'waived_import');
  assert.equal(Number(byoCharge.rows[0]!.amount), 0);

  // The two genuinely unbillable bookings left no charge behind at all; the BYO
  // one left an auditable ₱0 waiver and nothing payable.
  assert.equal(
    await count(`SELECT count(*) AS v FROM public.booking_fee_charges`),
    before + 1,
    'a skipped booking minted a charge',
  );
  assert.equal(
    await count(
      `SELECT count(*) AS v FROM public.orders WHERE service_key LIKE 'vendor\\_booking\\_fee\\_\\_%'`,
    ),
    1,
    'the only payable bill in this database must still be the one the owner was billed',
  );
});
