/**
 * A FINISHED JOB STAYS THE SUPPLIER'S — slice 2 of "vendors get to keep it"
 *
 * Owner, 2026-08-21: "statistics and data for the vendor stays… that the vendor
 * needs for their website." Test: DID THE SUPPLIER TAKE PART IN IT?
 *
 * `event_vendors` is the root of the supplier's whole public track record and
 * there is no independent record of a completed booking anywhere in the schema.
 * But the same table holds the couple's PRIVATE SHORTLIST, so this is the slice
 * where preserving too much is as wrong as preserving too little — and both
 * directions are asserted below.
 */
import { test, before, after } from 'node:test';
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

let seq = 0;
const uniq = () => `job-${++seq}-${Date.now()}`;

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}-vendor@test.local`],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Finished Job Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

async function newEvent(coupleUserId: string | null): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-03-04') RETURNING event_id`,
  );
  const eventId = r.rows[0]!.event_id;
  if (coupleUserId) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, coupleUserId],
    );
  }
  return eventId;
}

async function newBooking(
  eventId: string,
  status: string,
  opts: { marketplaceId?: string | null; linkedId?: string | null } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, linked_vendor_profile_id)
     VALUES ($1, 'photographer', 'Finished Job Studio', $2::vendor_status, $3, $4)
     RETURNING vendor_id`,
    [eventId, status, opts.marketplaceId ?? null, opts.linkedId ?? null],
  );
  return r.rows[0]!.vendor_id;
}

async function readBooking(vendorId: string) {
  const r = await db.query<{
    vendor_id: string;
    event_id: string | null;
    event_type_at_delete: string | null;
    event_date_at_delete: string | null;
  }>(
    `SELECT vendor_id, event_id, event_type_at_delete, event_date_at_delete
       FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0] ?? null;
}

const deleteEvent = (eventId: string) =>
  db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);

test('a booking the supplier really had survives the couple deleting the event', async () => {
  const { vendorProfileId } = await newVendor();
  const coupleU = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`${uniq()}-couple@test.local`],
  );
  const eventId = await newEvent(coupleU.rows[0]!.id);
  const vendorId = await newBooking(eventId, 'delivered', {
    marketplaceId: vendorProfileId,
    linkedId: vendorProfileId,
  });

  const before = await readBooking(vendorId);
  assert.ok(before, 'Fixture is wrong: the booking was never created.');
  assert.equal(before.event_id, eventId, 'Fixture is wrong: not attached.');

  await deleteEvent(eventId);

  const after = await readBooking(vendorId);
  assert.ok(after, 'THE BREAK: the supplier’s finished job died with the event.');
  assert.equal(after.event_id, null, 'Survived but still points at a deleted event.');
});

test('the surviving job still knows what kind of celebration it was, and when', async () => {
  /* 🚨 "STORED DOES NOT MEAN SURVIVES." The public track-record view reads
     `event_type` and `event_date` FROM THE EVENT. Preserving the row without
     these leaves it in the table and OUT of the view — the supplier's count
     still falls to zero and the fix is theatre. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent(null);
  const vendorId = await newBooking(eventId, 'complete', {
    marketplaceId: vendorProfileId,
    linkedId: vendorProfileId,
  });

  await deleteEvent(eventId);

  const after = await readBooking(vendorId);
  assert.equal(after?.event_type_at_delete, 'birthday', 'The job forgot what kind of celebration it was.');
  /* PGlite hands back a Date, so compare as a date — `String(d).slice(0,10)`
     yields "Wed Mar 04" and fails while the value is perfectly correct. */
  const kept = after?.event_date_at_delete;
  assert.ok(kept, 'The job forgot which day it was.');
  assert.equal(
    new Date(kept as unknown as string).toISOString().slice(0, 10),
    '2026-03-04',
    'The job kept a date, but not the right one.',
  );
});

test('the supplier’s public completed-jobs count still includes it', async () => {
  /* The row surviving is not the promise. The promise is that the supplier's
     PAGE still says they did the job. This asserts the view, not the table. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent(null);
  await newBooking(eventId, 'delivered', { marketplaceId: vendorProfileId, linkedId: vendorProfileId });

  const count = async () => {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.vendor_completed_events WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    return Number(r.rows[0]!.n);
  };

  assert.equal(await count(), 1, 'Fixture is wrong: not counted before the deletion.');
  await deleteEvent(eventId);
  assert.equal(await count(), 1, 'The supplier’s public track record dropped the job they did.');
});

test('the couple’s shortlist is NOT handed to the supplier', async () => {
  /* The opposite error, and the doc calls it just as expensive: preserving a
     `considering`/`shortlisted` row would tell a supplier they were on a list
     — and rejected. These must cascade. */
  /* Two DIFFERENT suppliers: `event_vendors_unique_marketplace_pick_per_event`
     allows one marketplace pick per event, and reusing one profile fails the
     insert rather than testing anything. Both rows are deliberately LINKED, so
     this proves the status decides — not the absence of a supplier. */
  const { vendorProfileId: vendorA } = await newVendor();
  const { vendorProfileId: vendorB } = await newVendor();
  const eventId = await newEvent(null);
  const considering = await newBooking(eventId, 'considering', { marketplaceId: vendorA });
  const shortlisted = await newBooking(eventId, 'shortlisted', { marketplaceId: vendorB });

  assert.ok(await readBooking(considering), 'Fixture is wrong.');
  assert.ok(await readBooking(shortlisted), 'Fixture is wrong.');

  await deleteEvent(eventId);

  assert.equal(await readBooking(considering), null, 'A supplier kept a row saying the couple considered them.');
  assert.equal(await readBooking(shortlisted), null, 'A supplier kept the couple’s shortlist.');
});

test('a name the couple typed is not preserved — there is nobody to keep it for', async () => {
  /* 44 of 45 prod rows are exactly this. With no supplier account behind it,
     preserving retains the couple's data with no beneficiary at all. */
  const eventId = await newEvent(null);
  const typed = await newBooking(eventId, 'delivered', { marketplaceId: null, linkedId: null });
  assert.ok(await readBooking(typed), 'Fixture is wrong.');

  await deleteEvent(eventId);

  assert.equal(await readBooking(typed), null, 'A booking with no supplier behind it was preserved anyway.');
});

test('a couple cannot manufacture a preserved booking by linking a supplier themselves', async () => {
  /* `lib/reusable-bookings.server.ts` lets the COUPLE'S action stamp
     `linked_vendor_profile_id`. If preservation keyed on that column, a couple
     could plant a "booking" on any supplier and then delete the event to make
     it permanent — inflating a stranger's public numbers. Preservation keys on
     `marketplace_vendor_id`, which the counterparty does not control. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent(null);
  const planted = await newBooking(eventId, 'delivered', {
    marketplaceId: null,
    linkedId: vendorProfileId,
  });

  await deleteEvent(eventId);

  assert.equal(
    await readBooking(planted),
    null,
    'A couple manufactured a permanent booking against a supplier by linking it themselves.',
  );
});

test('deleting the event does not LAUNDER a supplier’s own self-booked job', async () => {
  /* 🚨 THE HOLE THE NAIVE FIX CREATES. The track-record view excludes a booking
     whose supplier is also a couple member of that event. Those checks read
     `event_members`, which CASCADES — so once the event is gone they cannot run
     and every one passes permissively. Preserve blindly and a vendor books
     their own celebration, marks it delivered, deletes the event, and the job
     counts forever. The guard has to run while the members still exist. */
  const { vendorProfileId, userId } = await newVendor();
  const eventId = await newEvent(userId); // the SUPPLIER is the couple here
  const selfDealt = await newBooking(eventId, 'delivered', {
    marketplaceId: vendorProfileId,
    linkedId: vendorProfileId,
  });

  const counted = async () => {
    const r = await db.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.vendor_completed_events WHERE vendor_profile_id = $1`,
      [vendorProfileId],
    );
    return Number(r.rows[0]!.n);
  };

  assert.equal(await counted(), 0, 'Fixture is wrong: a self-booked job counted even before the deletion.');
  await deleteEvent(eventId);
  assert.equal(await readBooking(selfDealt), null, 'A self-booked job was preserved.');
  assert.equal(await counted(), 0, 'Deleting the event laundered a self-booked job into the public count.');
});

test('a couple cannot pre-write the snapshot to fake what the job was for', async () => {
  /* The two snapshot columns are writable by session roles, and a column-level
     REVOKE would be INERT here — `authenticated` holds TABLE-LEVEL UPDATE on
     event_vendors and a column revoke cannot subtract from a table grant. This
     repo has already paid for that mistake once, so the control is not a grant:

       1. the trigger STAMPS the truth at delete time, overwriting anything
          pre-written, and
       2. once orphaned, all four RLS policies key on `event_id`, so NULL
          matches nothing and the couple can never touch the row again.

     This asserts (1), which is the one that could silently stop being true. */
  const { vendorProfileId } = await newVendor();
  const eventId = await newEvent(null);
  const vendorId = await newBooking(eventId, 'delivered', {
    marketplaceId: vendorProfileId,
    linkedId: vendorProfileId,
  });

  await db.query(
    `UPDATE public.event_vendors
        SET event_type_at_delete = 'wedding', event_date_at_delete = DATE '1999-01-01'
      WHERE vendor_id = $1`,
    [vendorId],
  );

  await deleteEvent(eventId);

  const after = await readBooking(vendorId);
  assert.equal(
    after?.event_type_at_delete,
    'birthday',
    'A pre-written snapshot survived — the supplier’s record says the wrong kind of celebration.',
  );
  assert.equal(
    new Date(after?.event_date_at_delete as unknown as string).toISOString().slice(0, 10),
    '2026-03-04',
    'A pre-written date survived — the supplier’s record says the wrong day.',
  );
});
