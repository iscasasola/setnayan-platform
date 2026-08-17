/**
 * THE AGREE RPC MUST STAMP THE LINK IT WAS ALWAYS SAID TO STAMP.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `app/dashboard/[eventId]/vendors/actions.ts` asserted, in a comment, that
 * "the agree RPC stamps both alongside 'contracted', exactly as
 * `acquire_service_time_slot` already does". Read out of PRODUCTION with
 * `pg_get_functiondef` — not from a migration, not from a comment — half of it
 * was false: `acquire_service_time_slot` does stamp both; `vendor_agree_to_lock`
 * stamped NEITHER.
 *
 * 🔑 A SENTENCE IS NOT A MECHANISM. Nothing typechecks a comment, and a comment
 * describing what a DIFFERENT object does is the least checkable kind there is.
 * The fix is migration 20271144481150; THIS FILE is what stops the sentence
 * becoming false again quietly.
 *
 * ── WHY IT MATTERS THE INSTANT THE FLAG GOES ON ─────────────────────────────
 * With `NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` on, the supplier's yes becomes the
 * only thing that creates a booking. ~10 features key off
 * `linked_vendor_profile_id` — the supplier doorway on `/{slug}`, editorial
 * first-pick credit, Real Stories credit, Papic attribution, stage-note
 * recipients, showcase credits, the verified median, fraud detection, the
 * plausibility scanner, venue-room-size. Every handshake booking would have been
 * a 'contracted' row with a NULL link: booked, and invisible to all of them.
 *
 * ── WHY A DB TEST AND NOT A SOURCE GUARD ────────────────────────────────────
 * A guard grepping the migration for the column name passes on a COMMENT. This
 * project has shipped exactly that guard before and called it protection. These
 * tests CALL THE FUNCTION and read the row back, so they can only pass if the
 * write really happened.
 */

import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type StampRow = {
  status: string;
  lock_request_state: string | null;
  selection_match_rank: number | null;
  linked_vendor_profile_id: string | null;
};

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Ceiling Co', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

async function newEvent(label: string): Promise<string> {
  const coupleUid = await newUser(`couple-${label}@stamp.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-05-05'::date, 'day', 'NCR')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  return eventId;
}

/** A pending ask, exactly as the couple's Lock button writes one under the flag. */
async function newAsk(
  eventId: string,
  vpid: string | null,
  opts: { category?: string; link?: string | null } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        linked_vendor_profile_id, lock_request_state, lock_requested_at)
     VALUES ($1, $2::public.vendor_category, 'Ceiling Co', 'considering',
             $3, $4, 'pending', NOW())
     RETURNING vendor_id`,
    [eventId, opts.category ?? 'photographer', vpid, opts.link ?? null],
  );
  return r.rows[0]!.vendor_id;
}

async function readStamps(vendorId: string): Promise<StampRow> {
  const r = await db.query<StampRow>(
    `SELECT status::text AS status, lock_request_state,
            selection_match_rank, linked_vendor_profile_id
       FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!;
}

async function asVendor(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE CORE. Agreeing books AND attributes, in the same statement.
// ───────────────────────────────────────────────────────────────────────────

test('the supplier saying yes stamps the link and the rank, not just the status', async () => {
  const eventId = await newEvent('core');
  const { vpid, uid } = await newVendor('core@stamp.test');
  const evId = await newAsk(eventId, vpid);

  // Before: this is the state the old function left behind for ever.
  const before = await readStamps(evId);
  assert.equal(before.linked_vendor_profile_id, null);
  assert.equal(before.selection_match_rank, null);

  await asVendor(uid);
  await db.query(`SELECT public.vendor_agree_to_lock($1)`, [evId]);

  const after = await readStamps(evId);
  assert.equal(after.status, 'contracted', 'the booking half must still work');
  assert.equal(after.lock_request_state, 'agreed');
  assert.equal(
    after.linked_vendor_profile_id,
    vpid,
    'BOOKED AND INVISIBLE: ~10 features key off this column. A contracted row ' +
      'with a NULL link is a supplier nobody can credit, attribute or notify.',
  );
  assert.equal(after.selection_match_rank, 1, 'first-pick credit keys off the rank');
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE BOUNDARY THAT MADE THIS A BUG RATHER THAN AN OVERSIGHT.
// ───────────────────────────────────────────────────────────────────────────

test('an ask that has NOT been answered stamps nothing — the stamps mean "chosen"', async () => {
  const eventId = await newEvent('ask');
  const { vpid } = await newVendor('ask@stamp.test');
  const evId = await newAsk(eventId, vpid);

  const row = await readStamps(evId);
  assert.equal(row.lock_request_state, 'pending');
  assert.equal(
    row.linked_vendor_profile_id,
    null,
    'The stamps say "this is our chosen supplier". On an ask that is later ' +
      'declined, expired or withdrawn the row stays "considering", and the only ' +
      'thing that clears them refuses unless the row is confirmed — so stamping ' +
      'at ask time makes them permanent. A forward primitive with no inverse.',
  );
  assert.equal(row.selection_match_rank, null);
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · THE COALESCE — and the constraint that makes it unreachable.
// ───────────────────────────────────────────────────────────────────────────

test('the database forbids the row the COALESCE defends against', async () => {
  // I wrote the migration's COALESCE to stop a NULL marketplace_vendor_id
  // blanking an existing link, reasoning that the ownership gate's `OR
  // is_admin()` arm could reach such a row. WRITING THE TEST DISPROVED MY OWN
  // REASONING, which is the only reason this is documented rather than believed:
  //
  //   CHECK (lock_request_state IS DISTINCT FROM 'pending'
  //          OR marketplace_vendor_id IS NOT NULL)
  //
  // A pending ask with no marketplace vendor CANNOT EXIST, so the flip — which
  // only ever matches `lock_request_state = 'pending'` — can never meet one.
  // The COALESCE is therefore harmless defence in depth, NOT a live safeguard,
  // and the migration says so. This test pins the constraint that makes that
  // true: if it is ever relaxed, the COALESCE stops being decorative and whoever
  // relaxes it is told by this failure.
  const eventId = await newEvent('coalesce');
  await assert.rejects(
    () => newAsk(eventId, null, { link: null }),
    /lock_request_marketplace/,
    'a pending ask with a NULL marketplace_vendor_id must be refused by the DB',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · THE DELIBERATE NON-CHANGE, asserted so nobody "fixes" it by accident.
// ───────────────────────────────────────────────────────────────────────────

test('covered package lines are booked but deliberately NOT stamped', async () => {
  const eventId = await newEvent('pkg');
  const { vpid, uid } = await newVendor('pkg@stamp.test');

  // total_price_centavos is NOT NULL — a package with no price is not a package.
  const tmpl = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, primary_canonical_service, is_active,
        total_price_centavos)
     VALUES ($1, 'Full Day', 'photography', TRUE, 15000000)
     RETURNING package_id`,
    [vpid],
  );
  const booking = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages (event_id, package_id, status)
     VALUES ($1, $2, 'considering') RETURNING booking_id`,
    [eventId, tmpl.rows[0]!.package_id],
  );
  const bookingId = booking.rows[0]!.booking_id;

  const anchor = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role, lock_request_state, lock_requested_at)
     VALUES ($1,'photographer','Ceiling Co','considering',$2,$3,'anchor','pending',NOW())
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );
  const covered = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role)
     VALUES ($1,'videographer','Ceiling Co','considering',$2,$3,'covered')
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );

  await asVendor(uid);
  await db.query(`SELECT public.vendor_agree_to_lock($1)`, [anchor.rows[0]!.vendor_id]);

  const a = await readStamps(anchor.rows[0]!.vendor_id);
  const c = await readStamps(covered.rows[0]!.vendor_id);

  assert.equal(a.linked_vendor_profile_id, vpid, 'the anchor IS stamped');
  assert.equal(c.status, 'contracted', 'the covered line IS booked');
  assert.equal(
    c.linked_vendor_profile_id,
    null,
    'DELIBERATE, NOT AN OVERSIGHT: nothing anywhere stamps a covered line — not ' +
      'this path, not the couple own lock, not the chat lock. Matching the ' +
      'anchor-only behaviour keeps the two booking paths identical. Whether a ' +
      'covered line SHOULD carry the link is a real question and a separate change.',
  );
});
