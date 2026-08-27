/**
 * A LOCKED-QR BOOKING STAMPS THE LINK TO THE SHOP — and this is what pins it.
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * `event_vendors` carries TWO columns answering one question — which Setnayan
 * shop is this booking? — and the readers are split across them.
 * `get_vendor_event_brief`, the booked-supplier schedule policy and the vendor
 * capture policy all read `marketplace_vendor_id`. The supplier doorway and desk
 * on the celebration's own page, editorial first-pick credit, Real Stories
 * credit, Papic attribution, stage-note recipients, showcase credits, chapter
 * participation and the plausibility scanner all read
 * `linked_vendor_profile_id`.
 *
 * 🔴 `vendor_claim_locked_qr` wrote the first and never mentioned the second —
 * on the one path where MONEY HAS ALREADY CHANGED HANDS. A supplier booked by
 * scanning the couple's locked QR was invisible to all nine of those surfaces.
 *
 * 🔑 It is the same hole PR #4488 closed on `vendor_agree_to_lock`, surviving in
 * the clone. *A clone inherits the bug its twin fixed.*
 *
 * ── WHY CASE 0 AND CASE 5 EXIST ─────────────────────────────────────────────
 * `CREATE OR REPLACE` restates the WHOLE body, so this change had to reproduce
 * two rules it does not own. Both are asserted here, because a rewrite that
 * silently drops somebody else's invariant is the expensive failure:
 *   · `COALESCE(source, …)` — a lock is a status change, never a rewrite of how
 *     the couple found the shop (owner rule 2026-08-09);
 *   · the schedule acquire still sits AFTER the date-precision narrowing —
 *     hoisted above it, every claim reserves nothing and still reports success.
 *
 * ── AND CASE 6 ──────────────────────────────────────────────────────────────
 * NEUTRALISATION. Put the old body back — the INSERT without the column, the
 * UPDATE without the assignment — and watch both cases go dark. Without it this
 * suite could be measuring a fixture that was linked by something else.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const AGREED_DAY = '2027-06-19';

let coupleUid = '';
let vendorUserUid = '';
let vendorProfileId = '';
let otherProfileId = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('locked-qr-link-couple@audit.test');
  vendorUserUid = await createUser('locked-qr-link-vendor@audit.test');
  const otherUid = await createUser('locked-qr-link-other@audit.test');

  vendorProfileId = await createVendor(vendorUserUid, 'Link Stamping Studio');
  otherProfileId = await createVendor(otherUid, 'Someone Else Entirely');
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

/** Verified + stamped: `enforce_booking_requires_verified_vendor` refuses the
 *  `event_vendors` write otherwise, and the verified state requires its stamp. */
async function createVendor(userId: string, name: string): Promise<string> {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[],
             'verified'::public.vendor_verification_state, NOW())
     RETURNING vendor_profile_id`,
    [userId, name],
  );
  return r.rows[0]!.vendor_profile_id;
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

async function shortlist(
  eventId: string,
  opts: { source?: string | null; linked?: string | null } = {},
): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name, status, source)
     VALUES ($1, $2, $3, 'photographer'::public.vendor_category, 'Link Stamping Studio',
             'considering', $4)`,
    [eventId, vendorProfileId, opts.linked ?? null, opts.source ?? null],
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

async function rowOf(eventId: string) {
  const r = await db.query<{
    linked_vendor_profile_id: string | null;
    marketplace_vendor_id: string | null;
    status: string;
    source: string | null;
  }>(
    `SELECT linked_vendor_profile_id, marketplace_vendor_id, status, source
       FROM public.event_vendors
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!;
}

async function liveBody(): Promise<string> {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'vendor_claim_locked_qr'`,
  );
  assert.equal(r.rows.length, 1, 'vendor_claim_locked_qr(text, uuid) must exist exactly once');
  return r.rows[0]!.def;
}

/* ── 0. META — the shipped body, not a remembered one ──────────────────────*/

test('META: the shipped claim writes linked_vendor_profile_id on BOTH arms', async () => {
  const def = await liveBody();
  assert.match(
    def,
    /INSERT INTO public\.event_vendors \(\s*\n\s*event_id, marketplace_vendor_id, linked_vendor_profile_id,/,
    'the INSERT arm must name the column — a fresh Locked-QR booking is the common case',
  );
  assert.match(
    def,
    /linked_vendor_profile_id\s*=\s*\n?\s*COALESCE\(linked_vendor_profile_id, t\.vendor_profile_id\)/,
    'the UPDATE arm must COALESCE — stamping unconditionally would overwrite a link somebody else set',
  );
});

/* ── 1 · 2 — THE RULE, both arms ───────────────────────────────────────────*/

test('a fresh Locked-QR booking is linked to the shop that issued the token', async () => {
  const eventId = await newHostedEvent('Fresh Locked QR');
  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');

  const row = await rowOf(eventId);
  assert.equal(
    row.linked_vendor_profile_id,
    vendorProfileId,
    'without this the paid supplier has no doorway and no desk on the celebration page, ' +
      'no photo credit, no story credit and no stage notes',
  );
  assert.equal(row.marketplace_vendor_id, vendorProfileId, 'both columns, one answer');
  assert.equal(row.status, 'deposit_paid');
});

test('a shortlisted row is linked when the same shop’s Locked QR is claimed', async () => {
  const eventId = await newHostedEvent('Shortlisted Then Locked');
  await shortlist(eventId, { source: 'host_marketplace_search' });

  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');

  const row = await rowOf(eventId);
  assert.equal(row.linked_vendor_profile_id, vendorProfileId);
  assert.equal(row.status, 'deposit_paid');
});

/* ── 3 — MONOTONE ──────────────────────────────────────────────────────────*/

test('an existing link is never overwritten', async () => {
  const eventId = await newHostedEvent('Already Linked Elsewhere');
  await shortlist(eventId, { linked: otherProfileId });

  const res = await claim(await newToken(), eventId);
  assert.equal(res.status, 'ok');

  const row = await rowOf(eventId);
  assert.equal(
    row.linked_vendor_profile_id,
    otherProfileId,
    'the COALESCE is the whole point — this write may only ever FILL the column, never move it',
  );
});

/* ── 4 · 5 — THE TWO INVARIANTS THIS REWRITE DID NOT OWN ───────────────────*/

test('the 2026-08-09 source rule survived the rewrite', async () => {
  const eventId = await newHostedEvent('Source Survives The Rewrite');
  await shortlist(eventId, { source: 'host_marketplace_search' });
  await claim(await newToken(), eventId);

  assert.equal(
    (await rowOf(eventId)).source,
    'host_marketplace_search',
    'a lock is a status change, never a rewrite of how the couple found the shop',
  );
});

test('the schedule acquire still sits AFTER the date-precision narrowing', async () => {
  const def = await liveBody();
  const precision = def.indexOf("event_date_precision = 'day'");
  const acquire = def.indexOf('acquire_schedule_pools');
  assert.ok(precision > 0, 'the date-precision narrowing is gone — read the migration header');
  assert.ok(acquire > 0, 'the schedule acquire is gone — read the migration header');
  assert.ok(
    precision < acquire,
    'hoisted above the narrowing, the acquire degrades open on every claim: it reserves ' +
      'NOTHING and still reports success',
  );
});

/* ── 6 — NEUTRALISATION ────────────────────────────────────────────────────*/

test('NEUTRALISATION: putting the old body back loses the link on both arms', async () => {
  const def = await liveBody();
  const broken = def
    .replace(
      'event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name,',
      'event_id, marketplace_vendor_id, category, vendor_name,',
    )
    .replace(
      'p_event_id, t.vendor_profile_id, t.vendor_profile_id, t.category::public.vendor_category',
      'p_event_id, t.vendor_profile_id, t.category::public.vendor_category',
    )
    .replace(
      /\s*linked_vendor_profile_id =\s*\n\s*COALESCE\(linked_vendor_profile_id, t\.vendor_profile_id\),/,
      '',
    );
  assert.notEqual(broken, def, 'the sabotage did not apply — a result now proves nothing');
  assert.ok(
    !broken.includes('linked_vendor_profile_id'),
    'the sabotage must remove EVERY mention, or it is measuring a half-broken function',
  );

  await db.query(broken);
  try {
    const fresh = await newHostedEvent('Neutralised Fresh');
    await claim(await newToken(), fresh);
    assert.equal(
      (await rowOf(fresh)).linked_vendor_profile_id,
      null,
      'with the old body back the INSERT arm must leave the column empty — otherwise something ' +
        'ELSE is filling it and case 1 was never measuring this function',
    );

    const upd = await newHostedEvent('Neutralised Update');
    await shortlist(upd);
    await claim(await newToken(), upd);
    assert.equal((await rowOf(upd)).linked_vendor_profile_id, null);
  } finally {
    await db.query(def);
  }
});
