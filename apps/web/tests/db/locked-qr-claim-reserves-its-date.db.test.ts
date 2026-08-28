/**
 * A LOCKED-QR BOOKING HOLDS ITS DATE — and can never be refused for trying.
 *
 * `vendor_claim_locked_qr()` writes `status='deposit_paid'`, one of the three
 * statuses the pool doctrine counts as BOOKED, and until now acquired no
 * schedule pool — the only booking path that did not. So the vendor's own
 * calendar kept offering a day they had already taken a downpayment for.
 *
 * ⚠ DEFENCE-IN-DEPTH, NOT A LIVE BUG. Measured against production 2026-08-27:
 * `vendor_locked_qr_tokens` holds ZERO rows, ever. Nobody was double-sold a date
 * through this path because nobody has used this path.
 *
 * THE ONE RULE THIS SUITE EXISTS TO PIN SHUT
 * ------------------------------------------
 * The reservation may never refuse the claim. The token is SINGLE-USE and the
 * money has ALREADY MOVED, so an abort strands a couple who has paid, holding a
 * QR that can never be scanned again. One stale manual block is enough to reach
 * it. Aborting would read like correctness, which is exactly why it needs a
 * test rather than a comment.
 *
 * WHAT IS ASSERTED
 *   0. META — the shipped body really does acquire, and really does so AFTER the
 *      block that makes the date day-precise. Without this, every case below
 *      could pass against a function that reserves nothing.
 *   1. A clean claim RESERVES the date. (If this fails, cases 2–5 are vacuous:
 *      a suite where the pool never resolves would report "did not abort" while
 *      measuring nothing at all.)
 *   2. THE RULE — a BLOCKED date still completes the claim, and holds no
 *      reservation.
 *   3. A FULL pool still completes the claim.
 *   4. A refused acquire rolls back NOTHING ELSE — the booking, the frozen
 *      payment plan and the recorded downpayment all survive.
 *   5. An UNEXPECTED ERROR inside the acquire still completes the claim. This is
 *      the EXCEPTION block earning its place: without the subtransaction, one
 *      bad calendar row takes the whole booking down with it.
 *   6. NEUTRALISATION — put an abort back into the live function and watch the
 *      blocked claim fail. This is what proves cases 2 and 3 measure the degrade
 *      and not merely a fixture that was never in danger.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const AGREED_DAY = '2027-09-18';

let coupleUid = '';
let vendorUserUid = '';
let vendorProfileId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('locked-qr-reserve-couple@audit.test');
  vendorUserUid = await createUser('locked-qr-reserve-vendor@audit.test');

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Date Holding Studio', 'Manila', ARRAY['photography']::text[],
             'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [vendorUserUid],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;

  // THE FIXTURE LINE THAT DECIDES WHETHER THIS SUITE MEASURES ANYTHING.
  // `resolve_schedule_pool` refuses to create a pool for a non-owner caller
  // unless the vendor genuinely SELLS that category — and it reads
  // `vendor_services`, NOT the `services` text[] on the profile above. Without
  // this row the resolver returns NULL for every case, the acquire never runs,
  // and "the claim was not refused" would be true for the wrong reason.
  await db.query(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, 'photographer', 40000, 'Free extra hour')`,
    [vendorProfileId],
  );
});

after(async () => {
  await db.close();
});

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newHostedEvent(name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1, 'wedding', 'catholic', 'garden') RETURNING event_id`,
    [name],
  );
  const eventId = ev.rows[0]!.event_id;
  // member_type 'couple' is load-bearing: acquire_schedule_pools authorizes on
  // current_couple_event_ids(), so any other membership degrades open and the
  // reservation cases below would silently measure nothing.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  return eventId;
}

async function newToken(): Promise<string> {
  const r = await db.query<{ token: string }>(
    `INSERT INTO public.vendor_locked_qr_tokens (
       vendor_profile_id, created_by_user_id, event_type, category,
       service_description, event_date, total_php, initial_paid_php, schedule_json
     ) VALUES ($1, $2, 'wedding', 'photographer', 'Full-day coverage', $3, 80000, 25000, $4::jsonb)
     RETURNING token`,
    [
      vendorProfileId,
      vendorUserUid,
      AGREED_DAY,
      JSON.stringify([
        { seq: 1, label: 'Downpayment', amount_value: 25000, due_date: '2026-12-01' },
        { seq: 2, label: 'Balance', amount_value: 55000, due_date: '2027-08-01' },
      ]),
    ],
  );
  return r.rows[0]!.token;
}

type Claim = { status: string; event_vendor_id?: string };

async function claim(token: string, eventId: string): Promise<Claim> {
  await setAuthUid(db, coupleUid);
  try {
    const r = await db.query<{ out: Claim }>(
      `SELECT public.vendor_claim_locked_qr($1, $2) AS out`,
      [token, eventId],
    );
    return r.rows[0]!.out;
  } finally {
    await setAuthUid(db, null);
  }
}

/** Live (unreleased) pool reservations held against a booking row. */
async function liveReservations(eventVendorId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings
      WHERE event_vendor_id = $1 AND released_at IS NULL`,
    [eventVendorId],
  );
  return r.rows[0]!.n;
}

async function statusOf(eventVendorId: string): Promise<string> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.event_vendors WHERE vendor_id = $1`,
    [eventVendorId],
  );
  return r.rows[0]!.status;
}

/** The vendor's photographer pool, created lazily by the first claim. */
async function poolId(): Promise<string | null> {
  const r = await db.query<{ pool_id: string }>(
    `SELECT pool_id FROM public.vendor_schedule_pool_categories
      WHERE vendor_profile_id = $1 AND category_key = 'photographer'`,
    [vendorProfileId],
  );
  return r.rows[0]?.pool_id ?? null;
}

async function functionDef(): Promise<string> {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_claim_locked_qr(text, uuid) must exist exactly once');
  return r.rows[0]!.def;
}

function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/* ── 0. META ───────────────────────────────────────────────────────────────*/

test('META: the shipped claim acquires, and does so AFTER the date becomes day-precise', async () => {
  const def = await functionDef();

  const acquireAt = def.indexOf('acquire_schedule_pools');
  assert.ok(acquireAt > -1, 'the claim must call acquire_schedule_pools — every case below is vacuous without it');

  // Ordering, not mere presence. acquire_schedule_pools degrades OPEN on any
  // event whose date is not day-precise, so an acquire hoisted above the (d0)
  // precision write returns 'no_date' on every claim: a reservation that never
  // happens, reported as success, with this suite still green if it only
  // checked that the call exists.
  const precisionAt = def.indexOf("event_date_precision = 'day'");
  assert.ok(precisionAt > -1, "(d0) must still narrow event_date_precision to 'day'");
  assert.ok(
    precisionAt < acquireAt,
    'the acquire must run AFTER the date is finalized — above it, every reservation degrades to no_date',
  );

  // The degrade-open promise, read out of the body: the acquire's own outcome
  // may only ever WARN. A RAISE EXCEPTION anywhere in that block is the defect
  // this whole suite exists to prevent.
  const tail = def.slice(acquireAt);
  assert.ok(/RAISE WARNING/.test(tail), 'a non-ok acquire must RAISE WARNING');
  assert.ok(
    !/RAISE EXCEPTION/.test(tail),
    'the acquire block must never RAISE EXCEPTION — the token is single-use and the money has moved',
  );

  // The subtransaction, pinned. Case 6 measured how load-bearing this handler
  // is: with it in place, even turning the warning above into a hard abort
  // could not refuse a claim. Case 5 is what fails if it is removed.
  assert.ok(
    /EXCEPTION WHEN OTHERS THEN/.test(tail),
    'the acquire must run inside a subtransaction — without it one bad calendar row takes the whole booking down',
  );
});

/* ── 1. THE POINT ──────────────────────────────────────────────────────────*/

test('a Locked-QR booking reserves the date on the vendor schedule', async () => {
  const eventId = await newHostedEvent('Reserves Its Date');
  const res = await claim(await newToken(), eventId);

  assert.equal(res.status, 'ok');
  const evId = res.event_vendor_id!;
  assert.equal(await statusOf(evId), 'deposit_paid');

  assert.equal(
    await liveReservations(evId),
    1,
    'the claim must hold one live pool reservation — if this is 0 the pool never resolved and cases 2-5 measure nothing',
  );

  const r = await db.query<{ booked_date: string }>(
    `SELECT to_char(booked_date,'YYYY-MM-DD') AS booked_date
       FROM public.vendor_schedule_pool_bookings WHERE event_vendor_id = $1`,
    [evId],
  );
  assert.equal(r.rows[0]!.booked_date, AGREED_DAY, 'the reservation must land on the contracted day');
});

/* ── 2. THE RULE ───────────────────────────────────────────────────────────*/

test('a BLOCKED date still completes the claim — the couple has already paid', async () => {
  const pool = await poolId();
  assert.ok(pool, 'case 1 must have created the photographer pool');

  // A stale manual block over the contracted day. acquire_schedule_pools returns
  // 'blocked' for this, and 'blocked' must not become a refusal.
  await db.query(
    `INSERT INTO public.vendor_calendar_blocks
       (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source)
     VALUES ($1, $2, ($3::date)::timestamptz, ($3::date + 1)::timestamptz, 'Stale hold', 'manual')`,
    [vendorProfileId, pool, AGREED_DAY],
  );

  const eventId = await newHostedEvent('Blocked But Paid');
  const res = await claim(await newToken(), eventId);

  assert.equal(res.status, 'ok', 'a blocked date must NEVER refuse a claim — the token is single-use and the money has moved');
  const evId = res.event_vendor_id!;
  assert.equal(await statusOf(evId), 'deposit_paid', 'the booking must be locked in regardless');
  assert.equal(await liveReservations(evId), 0, 'a blocked date holds no reservation — it degrades open, it does not force one');

  await db.query(`DELETE FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`, [vendorProfileId]);
});

/* ── 3. FULL ───────────────────────────────────────────────────────────────*/

test('a FULL pool still completes the claim', async () => {
  const pool = await poolId();
  // Capacity is 1 by default and case 1 already consumed it for AGREED_DAY, so
  // this second claim on the same day meets 'full'.
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings
      WHERE pool_id = $1 AND booked_date = $2::date AND released_at IS NULL`,
    [pool, AGREED_DAY],
  );
  assert.equal(r.rows[0]!.n, 1, 'case 1 must still hold the only slot');

  const eventId = await newHostedEvent('Full But Paid');
  const res = await claim(await newToken(), eventId);

  assert.equal(res.status, 'ok', 'a full pool must never refuse a claim');
  assert.equal(await liveReservations(res.event_vendor_id!), 0);
});

/* ── 4. NOTHING ELSE ROLLS BACK ────────────────────────────────────────────*/

test('a refused acquire rolls back nothing else — plan and downpayment survive', async () => {
  // Reuse the full-pool refusal: same day, capacity already consumed.
  const eventId = await newHostedEvent('Refused Acquire Keeps Everything');
  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');
  const evId = res.event_vendor_id!;
  assert.equal(await liveReservations(evId), 0, 'the acquire must genuinely have been refused for this case to mean anything');

  const plan = await db.query<{ n: number }>(
    `SELECT jsonb_array_length(instances_json)::int AS n
       FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [evId],
  );
  assert.equal(plan.rows[0]!.n, 2, 'the frozen payment plan must survive a refused reservation');

  const pay = await db.query<{ amount: string }>(
    `SELECT amount_php::text AS amount FROM public.event_vendor_payments WHERE vendor_id = $1`,
    [evId],
  );
  assert.equal(pay.rows.length, 1, 'the recorded downpayment must survive a refused reservation');
  assert.equal(Number(pay.rows[0]!.amount), 25000);
});

/* ── 5. THE SUBTRANSACTION ─────────────────────────────────────────────────*/

test('an UNEXPECTED error inside the acquire still completes the claim', async () => {
  const original = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='acquire_schedule_pools'`,
  );
  const originalDef = original.rows[0]!.def;

  // Not a status the caller knows how to read — a hard throw, the case a bare
  // call could not survive.
  await db.query(`
    CREATE OR REPLACE FUNCTION public.acquire_schedule_pools(p_event_id UUID, p_event_vendor_id UUID, p_pool_ids UUID[])
    RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    AS $$ BEGIN RAISE EXCEPTION 'simulated acquire failure'; END; $$;`);

  try {
    const eventId = await newHostedEvent('Acquire Exploded But Paid');
    const res = await claim(await newToken(), eventId);
    assert.equal(
      res.status,
      'ok',
      'an error inside the acquire must roll back the reservation ALONE — remove the EXCEPTION block and this goes red',
    );
    assert.equal(await statusOf(res.event_vendor_id!), 'deposit_paid');
  } finally {
    await db.query(originalDef);
  }
});

/* ── 6. NEUTRALISATION ─────────────────────────────────────────────────────*/

test('NEUTRALISATION: strip the degrade-open and the blocked claim starts failing', async () => {
  const shipped = await functionDef();

  // TWO replacements, because ONE IS NOT ENOUGH — and finding that out is the
  // reason this case is written the way it is. The first draft only turned the
  // WARNING into an EXCEPTION and the claim still succeeded: the `EXCEPTION WHEN
  // OTHERS` handler four lines below caught the abort and degraded it back open.
  // A sabotage neutralised by the very mechanism under test proves nothing, so
  // the regression has to be reproduced in full — the refusal AND the missing
  // handler that would let it escape.
  const withAbort = shipped.replace(
    "RAISE WARNING '[locked-qr] schedule NOT reserved",
    "RAISE EXCEPTION '[locked-qr] schedule NOT reserved",
  );
  assert.equal(
    countOf(withAbort, 'RAISE EXCEPTION'),
    1,
    'sabotage 1 must land: RAISE EXCEPTION occurrences 0 -> 1',
  );
  assert.equal(countOf(shipped, 'RAISE EXCEPTION'), 0, 'the shipped body must contain no RAISE EXCEPTION');

  const handlerAt = withAbort.indexOf('EXCEPTION WHEN OTHERS THEN');
  assert.ok(handlerAt > -1, 'the degrade-open handler must exist in the shipped body');
  const endAt = withAbort.indexOf('END;', handlerAt);
  const sabotaged = withAbort.slice(0, handlerAt) + withAbort.slice(endAt);
  assert.equal(
    countOf(sabotaged, 'EXCEPTION WHEN OTHERS THEN'),
    0,
    'sabotage 2 must land: EXCEPTION WHEN OTHERS occurrences 1 -> 0',
  );

  await db.query(sabotaged);
  try {
    const pool = await poolId();
    await db.query(
      `INSERT INTO public.vendor_calendar_blocks
         (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source)
       VALUES ($1, $2, ($3::date)::timestamptz, ($3::date + 1)::timestamptz, 'Sabotage hold', 'manual')`,
      [vendorProfileId, pool, AGREED_DAY],
    );

    const eventId = await newHostedEvent('Sabotaged Abort');
    const token = await newToken();
    await assert.rejects(
      () => claim(token, eventId),
      /schedule NOT reserved/,
      'with the degrade-open stripped, a blocked date refuses the claim — that is exactly what cases 2 and 3 prevent',
    );
  } finally {
    await db.query(`DELETE FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1`, [vendorProfileId]);
    await db.query(shipped);
  }

  // The restore must be real, not assumed: every later suite in this replay
  // would otherwise run against a sabotaged function.
  const restored = await functionDef();
  assert.equal(countOf(restored, 'RAISE EXCEPTION'), 0, 'the shipped body must be restored');
  assert.equal(countOf(restored, 'EXCEPTION WHEN OTHERS THEN'), 1, 'the degrade-open handler must be restored');
});
