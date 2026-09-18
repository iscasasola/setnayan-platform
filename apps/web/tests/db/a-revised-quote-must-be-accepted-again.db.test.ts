/**
 * A REVISED QUOTE MUST BE ACCEPTED AGAIN (S5 · 2026-09-18) — the database half.
 *
 * Owner: "they can do updates and must be reaccepted." Option (a): a new quote
 * SUPERSEDES the live one — including an ACCEPTED one — the old one stays as
 * history, and the acceptance resets to pending.
 *
 * What is proved here, against the replayed schema and the real RPCs:
 *   1. the couple accepts quote A → `event_vendors` shortlisted at A's price
 *      (the shipped `respond_vendor_proposal` behaviour, as the fixture floor);
 *   2. the supplier sends quote B and the supersede RPC runs → A is
 *      'superseded', the bench row is back to 'considering' at B's price, and
 *      accepting A again is REFUSED (`already_resolved`) while accepting B works;
 *   3. once the booking is confirmed, or the couple has an open lock request at
 *      A's price, superseding A is REFUSED and A stays accepted;
 *   4. `vendor_may_requote` answers the same rule, and refuses a foreign profile;
 *   5. a couple's own manual shortlist (no accepted quote) is never reverted.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `requote-${++seq}-${Date.now()}`;

/** Run `fn` as an authenticated user — the way the RPCs see a real caller. */
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function newUser(tag: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}-${tag}@test.local`],
  );
  return r.rows[0]!.id;
}

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const userId = await newUser('v');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Requote Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newCoupleEvent(): Promise<{ eventId: string; coupleId: string }> {
  const coupleId = await newUser('c');
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Rosa & Ben', 'birthday', DATE '2027-02-14') RETURNING event_id`,
  );
  const eventId = r.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, coupleId],
  );
  return { eventId, coupleId };
}

async function newSentProposal(eventId: string, vendorProfileId: string, totalCentavos: number): Promise<string> {
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals
       (event_id, vendor_profile_id, title, status, total_centavos, sent_at,
        line_items, merge_snapshot)
     VALUES ($1, $2, 'Full-day coverage', 'sent', $3, NOW(),
             jsonb_build_array(jsonb_build_object('label','Photography','detail','photography','amount_centavos',$3::bigint)),
             '{}'::jsonb)
     RETURNING proposal_id`,
    [eventId, vendorProfileId, totalCentavos],
  );
  return r.rows[0]!.proposal_id;
}

async function proposalStatus(proposalId: string): Promise<string> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.vendor_proposals WHERE proposal_id = $1`,
    [proposalId],
  );
  return r.rows[0]!.status;
}

async function benchRow(eventId: string, vendorProfileId: string) {
  const r = await db.query<{ vendor_id: string; status: string; total_cost_php: string | null }>(
    `SELECT vendor_id, status::text AS status, total_cost_php::text AS total_cost_php
       FROM public.event_vendors
      WHERE event_id = $1 AND marketplace_vendor_id = $2 AND archived_at IS NULL`,
    [eventId, vendorProfileId],
  );
  return r.rows[0] ?? null;
}

const accept = (coupleId: string, proposalId: string) =>
  as(coupleId, () =>
    db.query(`SELECT public.respond_vendor_proposal($1, 'accepted', 'photographer')`, [proposalId]),
  );

const supersede = (vendorUserId: string, eventId: string, vendorProfileId: string, keep: string) =>
  as(vendorUserId, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT public.supersede_prior_vendor_proposals($1, $2, $3) AS n`,
      [eventId, vendorProfileId, keep],
    );
    return Number(r.rows[0]!.n);
  });

const mayRequote = (vendorUserId: string, eventId: string, vendorProfileId: string) =>
  as(vendorUserId, async () => {
    const r = await db.query<{ b: string | null }>(
      `SELECT public.vendor_may_requote($1, $2) AS b`,
      [eventId, vendorProfileId],
    );
    return r.rows[0]!.b;
  });

/* ── 1 · the floor: accept writes a priced shortlist ─────────────────────── */

test('fixture floor: accepting quote A shortlists the supplier at A’s price', async () => {
  const { vendorProfileId } = await newVendor();
  const { eventId, coupleId } = await newCoupleEvent();
  const a = await newSentProposal(eventId, vendorProfileId, 1_017_000);

  await accept(coupleId, a);

  assert.equal(await proposalStatus(a), 'accepted');
  const row = await benchRow(eventId, vendorProfileId);
  assert.ok(row, 'Fixture is wrong: accept wrote no event_vendors row.');
  assert.equal(row.status, 'shortlisted');
  assert.equal(Number(row.total_cost_php), 10_170);
});

/* ── 2 · the ruling: a new quote supersedes the accepted one ─────────────── */

test('🔴 a new quote supersedes the ACCEPTED one: A is history, the bench is back to considering at B’s price, and only B can be accepted', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const { eventId, coupleId } = await newCoupleEvent();
  const a = await newSentProposal(eventId, vendorProfileId, 1_017_000);
  await accept(coupleId, a);
  assert.equal(await proposalStatus(a), 'accepted', 'fixture: A not accepted');

  // The supplier sends B.
  const b = await newSentProposal(eventId, vendorProfileId, 1_200_000);
  assert.equal(await mayRequote(vendorUserId, eventId, vendorProfileId), null, 'the pre-check refused an ordinary re-quote');
  const retired = await supersede(vendorUserId, eventId, vendorProfileId, b);

  assert.equal(retired, 1, `retired ${retired} rows — expected exactly A`);
  assert.equal(await proposalStatus(a), 'superseded', 'THE BREAK: the accepted quote was not superseded');
  assert.equal(await proposalStatus(b), 'sent', 'the new quote is not pending');

  const row = await benchRow(eventId, vendorProfileId);
  assert.ok(row);
  assert.equal(row.status, 'considering', 'the acceptance’s shortlist still stands');
  assert.equal(Number(row.total_cost_php), 12_000, 'the bench still shows the withdrawn price — a Lock would book at it');

  // Accepting A again is refused; accepting B is the re-acceptance.
  await assert.rejects(accept(coupleId, a), /already_resolved/, 'the superseded quote could be accepted again');
  await accept(coupleId, b);
  assert.equal(await proposalStatus(b), 'accepted');
  const after = await benchRow(eventId, vendorProfileId);
  assert.equal(after!.status, 'shortlisted');
  assert.equal(Number(after!.total_cost_php), 12_000);
});

test('a pending quote is superseded as before — the plain re-quote path is unchanged', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const { eventId } = await newCoupleEvent();
  const a = await newSentProposal(eventId, vendorProfileId, 500_000);
  const b = await newSentProposal(eventId, vendorProfileId, 600_000);
  assert.equal(await supersede(vendorUserId, eventId, vendorProfileId, b), 1);
  assert.equal(await proposalStatus(a), 'superseded');
  assert.equal(await benchRow(eventId, vendorProfileId), null, 'a pending re-quote wrote a bench row it had no business writing');
});

/* ── 3 · the two refusals ────────────────────────────────────────────────── */

test('once the booking is CONFIRMED, the accepted quote cannot be superseded and stays accepted', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const { eventId, coupleId } = await newCoupleEvent();
  const a = await newSentProposal(eventId, vendorProfileId, 1_017_000);
  await accept(coupleId, a);
  // The booking becomes real (the state finalizeVendor / vendor_agree_to_lock reach).
  await db.query(
    `UPDATE public.event_vendors SET status = 'contracted'
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [eventId, vendorProfileId],
  );

  assert.equal(await mayRequote(vendorUserId, eventId, vendorProfileId), 'deal_locked');
  const b = await newSentProposal(eventId, vendorProfileId, 1_500_000);
  await assert.rejects(supersede(vendorUserId, eventId, vendorProfileId, b), /deal_locked/);

  assert.equal(await proposalStatus(a), 'accepted', 'the accepted quote behind a real booking was retired');
  const row = await benchRow(eventId, vendorProfileId);
  assert.equal(row!.status, 'contracted');
  assert.equal(Number(row!.total_cost_php), 10_170, 'the booked price moved');
});

test('while the couple has an OPEN lock request at the accepted price, a re-quote is refused', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const { eventId, coupleId } = await newCoupleEvent();
  const a = await newSentProposal(eventId, vendorProfileId, 1_017_000);
  await accept(coupleId, a);
  await db.query(
    `UPDATE public.event_vendors
        SET lock_request_state = 'pending', lock_requested_at = NOW()
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [eventId, vendorProfileId],
  );

  assert.equal(await mayRequote(vendorUserId, eventId, vendorProfileId), 'lock_requested');
  const b = await newSentProposal(eventId, vendorProfileId, 1_500_000);
  await assert.rejects(supersede(vendorUserId, eventId, vendorProfileId, b), /lock_requested/);
  assert.equal(await proposalStatus(a), 'accepted');
});

/* ── 4 · the pre-check is the supplier’s own, and only theirs ────────────── */

test('vendor_may_requote refuses a profile the caller does not own', async () => {
  const mine = await newVendor();
  const theirs = await newVendor();
  const { eventId } = await newCoupleEvent();
  await assert.rejects(
    mayRequote(mine.userId, eventId, theirs.vendorProfileId),
    /not_your_vendor_profile/,
  );
});

test('the internal rule function is not callable by an authenticated session', async () => {
  const { vendorProfileId, userId } = await newVendor();
  const { eventId } = await newCoupleEvent();
  await assert.rejects(
    as(userId, () =>
      db.query(`SELECT public.vendor_requote_blocker($1, $2)`, [eventId, vendorProfileId]),
    ),
    /permission denied/,
  );
});

/* ── 5 · a couple’s own shortlist is not the supplier’s to undo ──────────── */

test('a manual shortlist with no accepted quote behind it is untouched by a re-quote', async () => {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
  const { eventId } = await newCoupleEvent();
  // The couple shortlisted this shop themselves; no quote was ever accepted.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, marketplace_vendor_id, linked_vendor_profile_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, $2, $2, 'photographer', 'Requote Studio', 'shortlisted', 8000)`,
    [eventId, vendorProfileId],
  );
  const a = await newSentProposal(eventId, vendorProfileId, 900_000);
  const b = await newSentProposal(eventId, vendorProfileId, 950_000);
  assert.equal(await supersede(vendorUserId, eventId, vendorProfileId, b), 1);

  const row = await benchRow(eventId, vendorProfileId);
  assert.equal(row!.status, 'shortlisted', 'a couple’s own shortlist was reverted by a supplier’s re-quote');
  assert.equal(Number(row!.total_cost_php), 8_000, 'a couple’s own figure was overwritten');
  assert.equal(await proposalStatus(a), 'superseded');
});
