/**
 * REGRESSION GUARD — a Locked-QR claim must not erase HOW THE COUPLE FOUND THE
 * VENDOR.
 *
 * THE OWNER RULE THIS PINS SHUT (2026-08-09), verbatim: "we have a rule. to check
 * the user first if they found each other first on the website or not."
 *
 * That answer lives in `event_vendors.source`, and it is the axis the entire
 * free-vs-billable model turns on — a client the VENDOR brought is free forever,
 * a client SETNAYAN sourced is billable.
 *
 * THE DEFECT
 * ----------
 * `vendor_claim_locked_qr()` upserts the couple↔vendor row. On INSERT (no prior
 * relationship) stamping 'vendor_locked_qr' is correct — the vendor brought them.
 * On UPDATE it stamped the SAME value over a row that ALREADY EXISTED, which is
 * exactly the case where the couple had already found the vendor on Setnayan and
 * shortlisted them. One scan turned 'host_marketplace_search' into
 * 'vendor_locked_qr'.
 *
 * WHAT THAT COST, measured against the live classifier `vendor_source_attribution()`:
 * it buckets 'host_marketplace_search' + 'auto_cascade_from_finalize' as
 * **setnayan**, 'host_manual' + 'admin' as **off_platform**, and everything else
 * — including 'vendor_locked_qr' — as **unattributed**. So a booking Setnayan
 * genuinely sourced silently left the "Setnayan sourced" column on the vendor's
 * own My Performance page. Case 3 asserts that end-to-end rather than trusting
 * the column value alone, because the column is only interesting for what the
 * classifier does with it.
 *
 * ⚠ THIS IS NOT A BILLING TEST AND MUST NOT BE READ AS ONE. The booking fee reads
 * a THREAD's `inquiry_source` (`booking_fee_is_sourced_surface`), not this
 * column, and `bookingFeeSendGate` has no live caller. The harm today is
 * attribution. The harm later is that the fee is scoped to "sourced clients
 * only" and this is the column whose NAME answers that question — so it is the
 * value a future wiring reaches for, and it must still be there when it does.
 *
 * WHAT THIS SUITE ASSERTS
 *   0. META — the shipped body actually COALESCEs rather than overwrites,
 *      so no case below can pass for the wrong reason.
 *   1. A pre-existing marketplace-sourced row keeps its source through a claim.
 *   2. A row with NO prior relationship is stamped 'vendor_locked_qr' — the
 *      vendor really did bring them, and the column must never go NULL.
 *   3. A legacy row carrying no source at all still gets stamped.
 *   4. The classifier still calls the preserved booking 'setnayan'.
 *   5. The rest of the claim is undisturbed — status, total and the frozen plan.
 *   6. NEUTRALISATION — put the overwrite back into the live function, re-run
 *      case 1, and watch the source get erased. Without this the suite could be
 *      measuring a fixture that never had a source to lose.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const AGREED_DAY = '2027-05-22';

let coupleUid = '';
let vendorUserUid = '';
let vendorProfileId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('locked-qr-source-couple@audit.test');
  vendorUserUid = await createUser('locked-qr-source-vendor@audit.test');

  // Verified + stamped: enforce_booking_requires_verified_vendor rejects the
  // event_vendors write otherwise (and vendor_profiles_verified_requires_stamp
  // requires last_verified_at alongside the state).
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Source Attribution Studio', 'Manila', ARRAY['photography']::text[],
             'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [vendorUserUid],
  );
  vendorProfileId = vp.rows[0]!.vendor_profile_id;
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
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  return eventId;
}

/**
 * The couple finds the vendor on Setnayan and shortlists them — the row the
 * claim will later UPDATE rather than INSERT. `source` is the whole point.
 */
async function shortlistFromMarketplace(eventId: string, source: string | null): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, marketplace_vendor_id, category, vendor_name, status, source)
     VALUES ($1, $2, 'photographer'::public.vendor_category, 'Source Attribution Studio',
             'considering', $3)`,
    [eventId, vendorProfileId, source],
  );
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
        { seq: 2, label: 'Balance', amount_value: 55000, due_date: '2027-05-01' },
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

async function sourceOf(eventId: string): Promise<string | null> {
  const r = await db.query<{ source: string | null }>(
    `SELECT source FROM public.event_vendors
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!.source;
}

/* ── 0. META ───────────────────────────────────────────────────────────────*/

test('META: the shipped claim COALESCEs source instead of overwriting it', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_claim_locked_qr(text, uuid) must exist exactly once');
  const def = r.rows[0]!.def;
  // Matching the ARITHMETIC, not a substring: `source = 'vendor_locked_qr'`
  // still appears in the INSERT branch, where it is correct. What must be gone
  // is that same assignment inside the UPDATE.
  assert.ok(
    /source\s*=\s*COALESCE\(\s*source\s*,\s*'vendor_locked_qr'\s*\)/.test(def),
    'the UPDATE branch must COALESCE — otherwise every case below measures the old behaviour',
  );
});

/* ── 1. THE RULE ───────────────────────────────────────────────────────────*/

test('a couple who found the vendor on Setnayan keeps that on record through a lock', async () => {
  const eventId = await newHostedEvent('Found On Setnayan First');
  await shortlistFromMarketplace(eventId, 'host_marketplace_search');

  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');

  assert.equal(
    await sourceOf(eventId),
    'host_marketplace_search',
    'the lock rewrote how they found each other — the owner rule is broken',
  );
});

/* ── 2. THE OTHER SIDE OF THE LINE ─────────────────────────────────────────*/

test('a customer the vendor genuinely brought is stamped as theirs', async () => {
  const eventId = await newHostedEvent('Vendor Brought Them');
  // No prior row at all — the QR really is how they met.
  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');
  assert.equal(await sourceOf(eventId), 'vendor_locked_qr');
});

test('a legacy row carrying no source at all is still stamped, never left NULL', async () => {
  const eventId = await newHostedEvent('Legacy Sourceless Row');
  await shortlistFromMarketplace(eventId, null);
  await claim(await newToken(), eventId);
  assert.equal(
    await sourceOf(eventId),
    'vendor_locked_qr',
    'COALESCE must fill an empty source — preserving NULL would lose the answer too',
  );
});

/* ── 3. WHAT THE COLUMN IS ACTUALLY FOR ────────────────────────────────────*/

test('the preserved booking still reads as Setnayan-sourced to the classifier', async () => {
  const eventId = await newHostedEvent('Attribution End To End');
  await shortlistFromMarketplace(eventId, 'host_marketplace_search');
  await claim(await newToken(), eventId);

  // The claim promotes the row to deposit_paid, which is inside the classifier's
  // "booked" scope — so this is the exact row My Performance counts.
  //
  // Read it AS THE VENDOR: the RPC is ownership-gated and raises 'forbidden' to
  // anyone else. Calling it unauthenticated returned that error rather than an
  // empty set, which is worth knowing — a caller that swallowed it would show a
  // vendor an empty attribution panel instead of a failure.
  await setAuthUid(db, vendorUserUid);
  let r;
  try {
    r = await db.query<{ attribution: string; booking_count: number }>(
      `SELECT attribution, booking_count
         FROM public.vendor_source_attribution($1)
        WHERE attribution = 'setnayan'`,
      [vendorProfileId],
    );
  } finally {
    await setAuthUid(db, null);
  }
  assert.equal(r.rows.length, 1, "the booking fell out of the 'setnayan' bucket entirely");
  assert.ok(
    r.rows[0]!.booking_count >= 1,
    'a booking Setnayan sourced must still be credited to Setnayan after the lock',
  );
});

/* ── 4. NOTHING ELSE MOVED ─────────────────────────────────────────────────*/

test('the rest of the claim is undisturbed — status, total and the frozen plan', async () => {
  const eventId = await newHostedEvent('Claim Still Works');
  await shortlistFromMarketplace(eventId, 'host_marketplace_search');
  const res = await claim(await newToken(), eventId);

  const ev = await db.query<{ status: string; total_cost_php: string | null }>(
    `SELECT status::text AS status, total_cost_php
       FROM public.event_vendors WHERE vendor_id = $1`,
    [res.event_vendor_id],
  );
  assert.equal(ev.rows[0]!.status, 'deposit_paid');
  assert.equal(Number(ev.rows[0]!.total_cost_php), 80000);

  const plan = await db.query<{ n: number }>(
    `SELECT jsonb_array_length(instances_json) AS n
       FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [res.event_vendor_id],
  );
  assert.equal(Number(plan.rows[0]!.n), 2, 'the payment plan must still freeze both installments');

  const pay = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE vendor_id = $1`,
    [res.event_vendor_id],
  );
  assert.equal(Number(pay.rows[0]!.n), 1, 'the downpayment must still be recorded');
});

/* ── 5. NEUTRALISATION ─────────────────────────────────────────────────────*/

test('NEUTRALISATION: putting the overwrite back erases the source again', async () => {
  const original = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;

  const broken = original.replace(
    /source\s*=\s*COALESCE\(\s*source\s*,\s*'vendor_locked_qr'\s*\)/,
    "source         = 'vendor_locked_qr'",
  );
  // Prove the sabotage LANDED. A no-op replace would leave the real function in
  // place and this test would "pass" while measuring nothing at all.
  assert.notEqual(broken, original, 'the neutralisation did not change the function body');
  await db.exec(broken);

  const eventId = await newHostedEvent('Neutralised');
  await shortlistFromMarketplace(eventId, 'host_marketplace_search');
  await claim(await newToken(), eventId);
  assert.equal(
    await sourceOf(eventId),
    'vendor_locked_qr',
    'with the overwrite restored the source should be erased — if it survived, ' +
      'something other than this clause is preserving it and case 1 proves nothing',
  );

  // Put the real one back so ordering can never leak the broken body.
  await db.exec(original);
  const eventId2 = await newHostedEvent('Restored');
  await shortlistFromMarketplace(eventId2, 'host_marketplace_search');
  await claim(await newToken(), eventId2);
  assert.equal(await sourceOf(eventId2), 'host_marketplace_search');
});
