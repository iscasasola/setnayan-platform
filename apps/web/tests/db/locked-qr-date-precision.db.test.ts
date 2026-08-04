/**
 * REGRESSION GUARD — a Locked-QR claim must date the event at 'day' PRECISION.
 *
 * THE DEFECT THIS PINS SHUT
 * -------------------------
 * `public.vendor_claim_locked_qr()`'s (d0) block writes the vendor's contracted
 * date into `events.event_date` and clears the candidate set / window / mode. It
 * did NOT touch `events.event_date_precision`, which defaults to 'year' on every
 * new event — so the claim landed a real calendar day underneath a precision
 * that still said "sometime that year". Countdown maths only runs at 'day'
 * (`lib/progress-stages.ts`), so an event dated by a signed vendor contract was
 * skipped by everything that counts down, and the couple was still being told to
 * "Lock your exact date — narrowed, not final".
 *
 * It is the SAME defect fixed for `studio/save-the-date/actions.ts` on
 * 2026-07-30. That fix's note called itself "the only `events.event_date` writer
 * that didn't set precision alongside it" — it was the only TypeScript one. This
 * suite exists so the plpgsql sibling cannot regress silently the way it was
 * introduced silently.
 *
 * WHY 'day' IS HONEST HERE (and why this suite is allowed to demand it)
 * `events.event_date` genuinely carries PLACEHOLDERS at year/month precision, so
 * demanding 'day' from every writer would be wrong. The token's date is not one:
 * `locked-qr-generator.tsx` offers a single `<input type="date">` with no vague
 * mode, `vendor-dashboard/invite/actions.ts` validates it as ONE day against the
 * vendor's own calendar availability, and a downpayment has already been taken
 * against it. Case 3 below pins the other side of that line — a legacy token
 * with NO date must not fabricate a precision.
 *
 * WHAT THIS SUITE ASSERTS
 *   0. META — the shipped function body actually writes `event_date_precision`
 *      (otherwise every case below could pass for the wrong reason).
 *   1. A claim sets event_date AND precision 'day' — and `date_status` promotes
 *      to 'locked' off that same UPDATE via sync_event_date_status_trg, with no
 *      explicit date_status write in the RPC.
 *   2. MONEY IS UNDISTURBED — the replacement is one SET clause, so the booking,
 *      the frozen plan and the attributed + vendor-confirmed downpayment must
 *      all still land exactly as before.
 *   3. A legacy token (event_date NULL) still changes no date column at all.
 *   4. ACL — anon / authenticated / service_role keep EXECUTE and PUBLIC does
 *      not have it. A CREATE OR REPLACE that ever became a DROP + CREATE would
 *      reset the ACL; this is the tripwire.
 *   5. NEUTRALISATION — strip exactly the added SET clause out of the live
 *      function, re-run case 1, and watch the drift come back. Without this the
 *      suite could be measuring the default rather than the fix.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The single contracted day every fixture token carries. */
const AGREED_DAY = '2027-03-14';

let coupleUid = '';
let vendorUserUid = '';
let vendorProfileId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('locked-qr-couple@audit.test');
  vendorUserUid = await createUser('locked-qr-vendor@audit.test');

  // Must be VERIFIED: enforce_booking_requires_verified_vendor rejects the
  // event_vendors write otherwise, and `last_verified_at` must be stamped
  // alongside it (vendor_profiles_verified_requires_stamp, 20271017100000).
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Locked QR Test Studio', 'Manila', ARRAY['photography']::text[],
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

/** A fresh event owned by the couple, left at the shipped column defaults. */
async function newHostedEvent(): Promise<string> {
  // `events_wedding_fields_consistency` requires ceremony_type + venue_setting
  // on a wedding, which is also what onboarding writes — so this fixture is the
  // real shape of the row the claim lands on, not a stripped-down stand-in.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Locked QR Test', 'wedding', 'catholic', 'garden') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  return eventId;
}

/** A pending token exactly as `vendor-dashboard/invite/actions.ts` writes one. */
async function newToken(eventDate: string | null): Promise<string> {
  const r = await db.query<{ token: string }>(
    `INSERT INTO public.vendor_locked_qr_tokens (
       vendor_profile_id, created_by_user_id, event_type, category,
       service_description, event_date, total_php, initial_paid_php, schedule_json
     ) VALUES (
       $1, $2, 'wedding', 'photographer',
       'Full-day coverage', $3, 60000, 20000,
       $4::jsonb
     ) RETURNING token`,
    [
      vendorProfileId,
      vendorUserUid,
      eventDate,
      JSON.stringify([
        { seq: 1, label: 'Downpayment', amount_value: 20000, due_date: '2026-12-01' },
        { seq: 2, label: 'Balance', amount_value: 40000, due_date: '2027-03-01' },
      ]),
    ],
  );
  return r.rows[0]!.token;
}

type Claim = { status: string; event_id?: string; event_vendor_id?: string };

async function claimAs(uid: string, token: string, eventId: string): Promise<Claim> {
  await setAuthUid(db, uid);
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

type DateCols = {
  event_date: string | null;
  event_date_precision: string;
  date_status: string;
  date_mode: string | null;
  date_candidates: string[] | null;
};

async function dateColsOf(eventId: string): Promise<DateCols> {
  const r = await db.query<DateCols>(
    `SELECT event_date::text AS event_date, event_date_precision, date_status,
            date_mode, date_candidates
       FROM public.events WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!;
}

/* ── 0. META ───────────────────────────────────────────────────────────────*/

test('META: the shipped claim function writes events.event_date_precision', async () => {
  const r = await db.query<{ writes: boolean; secdef: boolean }>(
    `SELECT position('event_date_precision' IN pg_get_functiondef(p.oid)) > 0 AS writes,
            p.prosecdef AS secdef
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_claim_locked_qr(text, uuid) must exist exactly once');
  assert.equal(
    r.rows[0]!.writes,
    true,
    'the fix is not in the shipped body — every case below would be measuring something else',
  );
  assert.equal(r.rows[0]!.secdef, true, 'the claim must stay SECURITY DEFINER');
});

test('META: a fresh event starts at the precision that caused the defect', async () => {
  const eventId = await newHostedEvent();
  const cols = await dateColsOf(eventId);
  assert.equal(cols.event_date, null);
  assert.equal(
    cols.event_date_precision,
    'year',
    "the creation default must still be 'year' — that default IS the defect's other half",
  );
  assert.equal(cols.date_status, 'undecided');
});

/* ── 1. THE FIX ────────────────────────────────────────────────────────────*/

test("claiming a Locked QR dates the event at 'day' precision", async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(AGREED_DAY);

  const res = await claimAs(coupleUid, token, eventId);
  assert.equal(res.status, 'ok', `claim failed: ${JSON.stringify(res)}`);

  const cols = await dateColsOf(eventId);
  assert.equal(cols.event_date, AGREED_DAY, 'the contracted day must land on the event');
  assert.equal(
    cols.event_date_precision,
    'day',
    "precision must advance with the date — countdown maths only runs at 'day'",
  );
  // The (d0) block's original job, unchanged.
  assert.equal(cols.date_mode, null, 'the date mode must still be cleared');
  assert.equal(cols.date_candidates, null, 'the candidate set must still be cleared');
});

test("date_status promotes to 'locked' off the same UPDATE, unwritten by the RPC", async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(AGREED_DAY);
  assert.equal((await dateColsOf(eventId)).date_status, 'undecided');

  const res = await claimAs(coupleUid, token, eventId);
  assert.equal(res.status, 'ok');

  assert.equal(
    (await dateColsOf(eventId)).date_status,
    'locked',
    'sync_event_date_status_trg (20271033121603) promotes only DAY-precise dates, so fixing the precision must fix this too',
  );
  // The promotion must come from the trigger, not from the RPC — an explicit
  // date_status write would trip the trigger's "explicit intent always wins"
  // arm and suppress the very invariant that owns the column. Comments are
  // stripped first: the body TALKS about date_status at length, and a raw
  // substring match would fail on the explanation of why it isn't written.
  const src = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;
  const code = src
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  assert.equal(
    /date_status/.test(code),
    false,
    'the RPC must not touch date_status itself — the trigger owns that column',
  );
});

/* ── 2. MONEY IS UNDISTURBED ───────────────────────────────────────────────*/

test('the booking, the frozen plan and the downpayment are unchanged', async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(AGREED_DAY);
  const res = await claimAs(coupleUid, token, eventId);
  assert.equal(res.status, 'ok');

  const ev = await db.query<{ status: string; source: string; total_cost_php: string }>(
    `SELECT status, source, total_cost_php::text FROM public.event_vendors WHERE vendor_id = $1`,
    [res.event_vendor_id],
  );
  assert.equal(ev.rows[0]!.status, 'deposit_paid');
  assert.equal(ev.rows[0]!.source, 'vendor_locked_qr');
  assert.equal(Number(ev.rows[0]!.total_cost_php), 60000);

  const plan = await db.query<{ instances_json: Array<{ seq: number; amount_php: number }> }>(
    `SELECT instances_json FROM public.event_vendor_payment_plan
      WHERE event_id = $1 AND event_vendor_id = $2`,
    [eventId, res.event_vendor_id],
  );
  const instances = plan.rows[0]!.instances_json;
  assert.equal(instances.length, 2, 'both installments must freeze onto the plan');
  assert.equal(Number(instances[0]!.amount_php), 20000);
  assert.equal(Number(instances[1]!.amount_php), 40000);

  const pay = await db.query<{
    amount_php: string;
    method: string;
    schedule_instance_seq: number;
    confirmed: boolean;
  }>(
    `SELECT amount_php::text, method, schedule_instance_seq,
            (vendor_confirmed_at IS NOT NULL) AS confirmed
       FROM public.event_vendor_payments WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(pay.rows.length, 1, 'exactly one downpayment row');
  assert.equal(Number(pay.rows[0]!.amount_php), 20000);
  assert.equal(pay.rows[0]!.method, 'qr_lock');
  assert.equal(
    pay.rows[0]!.schedule_instance_seq,
    1,
    'the downpayment must stay attributed to installment seq 1 (else the stepper double-counts)',
  );
  assert.equal(pay.rows[0]!.confirmed, true, 'and stay vendor-confirmed');
});

/* ── 3. THE OTHER SIDE OF THE LINE ─────────────────────────────────────────*/

test('a legacy token with no date fabricates no precision', async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(null);
  const before = await dateColsOf(eventId);

  const res = await claimAs(coupleUid, token, eventId);
  assert.equal(res.status, 'ok');

  const cols = await dateColsOf(eventId);
  assert.equal(cols.event_date, null, 'no date was contracted, so none may appear');
  assert.equal(
    cols.event_date_precision,
    before.event_date_precision,
    "the (d0) block is skipped entirely for legacy tokens — 'day' here would be a lie",
  );
  assert.equal(cols.date_status, 'undecided');
});

test('a claimer who does not host the event changes nothing', async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(AGREED_DAY);
  const stranger = await createUser(`locked-qr-stranger-${Date.now()}@audit.test`);

  const res = await claimAs(stranger, token, eventId);
  assert.equal(res.status, 'not_your_event');

  const cols = await dateColsOf(eventId);
  assert.equal(cols.event_date, null, 'a rejected claim must not date the event');
  assert.equal(cols.event_date_precision, 'year');
});

/* ── 4. THE ACL DID NOT MOVE ───────────────────────────────────────────────*/

async function aclOf(): Promise<{
  anon: boolean;
  authed: boolean;
  svc: boolean;
  public_granted: boolean;
  raw: string | null;
}> {
  const r = await db.query<{
    anon: boolean;
    authed: boolean;
    svc: boolean;
    public_granted: boolean;
    raw: string | null;
  }>(
    `SELECT has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
            has_function_privilege('service_role',  p.oid, 'EXECUTE') AS svc,
            EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0) AS public_granted,
            p.proacl::text AS raw
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
  );
  return r.rows[0]!;
}

test('EXECUTE reach is unchanged: anon + authenticated + service_role, never PUBLIC', async () => {
  const acl = await aclOf();
  // 20271031571953 refuted the case for revoking anon here: the 128-bit token IS
  // the credential. Narrowing would break the guest surface; widening to PUBLIC
  // would undo 20270414692373. Both directions fail this assertion.
  assert.equal(acl.anon, true, 'anon lost EXECUTE — 20271031571953 kept it deliberately');
  assert.equal(acl.authed, true, 'authenticated lost EXECUTE');
  assert.equal(acl.svc, true, 'service_role lost EXECUTE');
  assert.equal(acl.public_granted, false, 'PUBLIC must never hold EXECUTE (20270414692373)');
});

test('CREATE OR REPLACE preserves the ACL — the property this migration relies on', async () => {
  // The migration ships no REVOKE/GRANT at all, exactly like the two prior
  // replacements. That is only safe because CREATE OR REPLACE keeps proacl —
  // a DROP + CREATE would reset it and hand the function back its default
  // grants. Asserting the ACL "looks right" after the fact cannot tell those
  // apart, so replace the function AGAIN, in place, and diff the raw ACL.
  const before = await aclOf();
  assert.notEqual(before.raw, null, 'the replay must materialise an explicit ACL for this check');

  const def = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;
  await db.exec(def);

  const after = await aclOf();
  assert.equal(after.raw, before.raw, 'a replacement must not move the ACL by a single entry');
});

/* ── 5. NEUTRALISATION ─────────────────────────────────────────────────────*/

test('NEUTRALISATION: removing the added SET clause reintroduces the drift', async () => {
  const original = (
    await db.query<{ def: string }>(
      `SELECT pg_get_functiondef(p.oid) AS def
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
    )
  ).rows[0]!.def;

  // Strip exactly the fix — the one SET clause this migration added — and
  // nothing else. If the marker ever stops matching, fail loudly rather than
  // silently "neutralising" a function that was never mutated.
  const neutralised = original.replace(/\n\s*event_date_precision = 'day',/, '');
  assert.notEqual(
    neutralised,
    original,
    'the neutralisation marker did not match — this test would otherwise pass vacuously',
  );

  try {
    await db.exec(neutralised);
    const eventId = await newHostedEvent();
    const token = await newToken(AGREED_DAY);
    const res = await claimAs(coupleUid, token, eventId);
    assert.equal(res.status, 'ok');

    const cols = await dateColsOf(eventId);
    assert.equal(cols.event_date, AGREED_DAY, 'the pre-fix body still writes the date');
    assert.equal(
      cols.event_date_precision,
      'year',
      'without the SET clause the drift MUST come back — otherwise this suite is measuring the default, not the fix',
    );
    assert.equal(
      cols.date_status,
      'undecided',
      'and date_status stays stale, which is the downstream half of the same defect',
    );
  } finally {
    await db.exec(original);
  }
});

test('POST-NEUTRALISATION: the real function is back', async () => {
  const eventId = await newHostedEvent();
  const token = await newToken(AGREED_DAY);
  const res = await claimAs(coupleUid, token, eventId);
  assert.equal(res.status, 'ok');
  const cols = await dateColsOf(eventId);
  assert.equal(cols.event_date_precision, 'day');
  assert.equal(cols.date_status, 'locked');
});
