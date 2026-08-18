/**
 * PR-H slice B · THE PAYLOAD CEILING AND THE PACKAGE PROMOTION (test:db).
 *
 * Two claims that cannot be checked by reading, and one of them is a PRIVACY
 * boundary:
 *
 *  1. A supplier who has only been ASKED can open the event — and receives the
 *     region, NOT the venue name, NOT the venue address, and NOT one line of the
 *     run-of-show. 🔑 A TEST THAT ONLY CHECKS THE HAPPY STAGE PASSES WHILE
 *     LEAKING, so every assertion here is about what the payload does NOT
 *     contain, and the ceiling is mutation-proved: widen the booked predicate to
 *     include 'pending' and these go red.
 *
 *  2. A package is ONE answer spread over N rows. Agreeing to the anchor books
 *     the covered lines and the booking row with it, or the supplier accepts a
 *     package and gets half of one.
 *
 * ⚠ auth.role() CAN NEVER BE NULL IN THIS REPLAY — the shim returns 'anon' where
 * prod returns NULL — so nothing here branches on it, exactly as the slice A
 * suite records.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string, name = 'Ceiling Co'): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid, name],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/**
 * An event carrying EVERY field the ceiling is about, so an absence in the
 * payload can only mean the function withheld it.
 *
 * 🔑 SEEDING THE SECRETS IS THE WHOLE TEST. A ceiling test on an event with no
 * venue address would pass against a completely open function — the field would
 * be NULL because nobody set it, not because anybody withheld it. That is the
 * "search that cannot match is not a negative result" failure, in test form.
 */
async function newEventWithSecrets(label: string): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@sliceb.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision,
        venue_name, venue_address, region)
     VALUES ($1, 'birthday', '2027-05-05'::date, 'day',
             'The Secret Ballroom', '12 Private Road, Makati', 'NCR')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  // A run-of-show block — the other thing only an agreement earns.
  await db.query(
    `INSERT INTO public.event_schedule_blocks (event_id, label, block_type, start_at, location)
     VALUES ($1, 'Ceremony', 'ceremony', '2027-05-05T14:00:00Z', 'The Secret Ballroom')`,
    [eventId],
  );
  return { eventId, coupleUid };
}

async function newBooking(
  eventId: string,
  vpid: string,
  opts: { status?: string; category?: string; pending?: boolean } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        lock_request_state, lock_requested_at)
     VALUES ($1, $2::public.vendor_category, 'Ceiling Co', $3::public.vendor_status, $4, $5, $6)
     RETURNING vendor_id`,
    [
      eventId,
      opts.category ?? 'photographer',
      opts.status ?? 'considering',
      vpid,
      opts.pending ? 'pending' : null,
      opts.pending ? new Date().toISOString() : null,
    ],
  );
  return r.rows[0]!.vendor_id;
}

/** Become the vendor's own session — the brief keys on auth.uid(). */
async function asVendor(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

async function brief(eventId: string): Promise<Row> {
  const r = await db.query<{ b: Row }>(
    `SELECT public.get_vendor_event_brief($1) AS b`,
    [eventId],
  );
  return r.rows[0]!.b;
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
// 1 · THE ASK OPENS THE DOOR AT ALL.
// ───────────────────────────────────────────────────────────────────────────

test('an asked supplier can open the event — before slice B this raised not_booked', async () => {
  const { vpid, uid } = await newVendor('ask-open@sliceb.test');
  const { eventId } = await newEventWithSecrets('open');
  await newBooking(eventId, vpid, { pending: true });

  await asVendor(uid);
  const b = await brief(eventId);
  assert.equal(b.stage, 'requested');
  // MUTATION: delete the 'requested' rung from the stage gate ⇒ this throws
  // not_booked (42501) and the test reddens.
});

test('a supplier with NEITHER a booking, an ask, nor a thread is still refused', async () => {
  const { vpid, uid } = await newVendor('ask-none@sliceb.test');
  const { eventId } = await newEventWithSecrets('none');
  // A row with NO request marker: the org is linked to the event but nobody
  // asked them anything.
  await newBooking(eventId, vpid, { pending: false });

  await asVendor(uid);
  await assert.rejects(
    () => brief(eventId),
    /not_booked/,
    'the new rung must open the door for an ASK, not for every linked row',
  );
  // MUTATION: change the rung's predicate from `lock_request_state = 'pending'`
  // to `lock_request_state IS NOT DISTINCT FROM ev.lock_request_state` (always
  // true) ⇒ this reddens. That mutation is the realistic slip — a predicate that
  // matches the row rather than the STATE.
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · THE CEILING. Every assertion is a NEGATIVE.
// ───────────────────────────────────────────────────────────────────────────

test('the ask stage withholds the venue name, the venue address and the run-of-show', async () => {
  const { vpid, uid } = await newVendor('ceiling@sliceb.test');
  const { eventId } = await newEventWithSecrets('ceiling');
  await newBooking(eventId, vpid, { pending: true });

  await asVendor(uid);
  const b = await brief(eventId);
  const ev = b.event as Row;

  assert.equal(b.stage, 'requested');
  assert.equal(ev.venue_name, null, 'the venue NAME must not reach a supplier who has not agreed');
  assert.equal(
    ev.venue_address,
    null,
    'the venue ADDRESS must not reach a supplier who has not agreed',
  );
  assert.deepEqual(b.timeline, [], 'the run-of-show is earned by an agreement, never by an ask');
  assert.equal(b.dietary, null, 'meal counts are earned by an agreement');
  assert.equal((b.seat_plan as Row).table_count, 0, 'the seat plan is earned by an agreement');
  assert.equal((b.seat_plan as Row).published, false);

  // 🔑 THE ONE POSITIVE, and it is what makes the negatives meaningful: the
  // supplier DOES get the region. Without this the whole test would also pass
  // against a function that returned nothing at all.
  assert.equal(ev.region, 'NCR', 'the supplier must still get enough to answer');
  assert.equal(ev.event_date, '2027-05-05');

  // MUTATION 1: add 'pending' to the BOOKED predicate's status list ⇒ stage
  // becomes 'booked', venue_address is '12 Private Road, Makati', timeline has
  // one block, and four assertions above go red at once. That is the exact
  // two-word "obvious repair" the migration header warns against.
  // MUTATION 2: give 'requested' its own RETURN that copies the booked payload
  // ⇒ same four reds. The single shared build object is what makes MUTATION 2
  // an edit somebody has to consciously write rather than one they can inherit.
});

test('the ask envelope carries the supplier own row and nothing about the wedding', async () => {
  const { vpid, uid } = await newVendor('envelope@sliceb.test');
  const { eventId } = await newEventWithSecrets('envelope');
  const evId = await newBooking(eventId, vpid, { pending: true, category: 'videographer' });

  await asVendor(uid);
  const b = await brief(eventId);
  const lr = b.lock_request as Row;
  assert.ok(lr, 'the ask stage must carry its envelope');
  assert.equal(lr.event_vendor_id, evId);
  assert.equal(lr.category, 'videographer');
  assert.ok(lr.expires_at, 'the DB-materialized deadline must be readable — the UI shows THIS');
  assert.deepEqual(
    Object.keys(lr).sort(),
    ['category', 'event_vendor_id', 'expires_at', 'requested_at'],
    'a new key here is a new disclosure and must be a deliberate edit, not a drift',
  );
});

test('an AGREED supplier gets everything — the ceiling is a stage, not a permanent lid', async () => {
  const { vpid, uid } = await newVendor('agreed@sliceb.test');
  const { eventId } = await newEventWithSecrets('agreed');
  const evId = await newBooking(eventId, vpid, { pending: true });

  await asVendor(uid);
  await db.query(`SELECT public.vendor_agree_to_lock($1)`, [evId]);
  const b = await brief(eventId);

  assert.equal(b.stage, 'booked');
  assert.equal((b.event as Row).venue_address, '12 Private Road, Makati');
  assert.equal((b.timeline as unknown[]).length, 1);
  // The booked payload does not carry the key AT ALL — it is a different build
  // object. Asserted as absence rather than `=== null`, because those are two
  // different facts and the looser check would pass on a booked payload that
  // had grown an (empty) envelope.
  assert.ok(
    !('lock_request' in b),
    'the envelope belongs to the ask; the booked payload has no such key',
  );
  // Without this test the suite would be satisfied by a function that refused
  // EVERYONE — the failure mode a ceiling test is most likely to hide.
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · A PACKAGE IS ONE ANSWER, N ROWS.
// ───────────────────────────────────────────────────────────────────────────

test('agreeing to a package anchor books its covered lines and the booking row', async () => {
  const { vpid, uid } = await newVendor('pkg@sliceb.test', 'Package Co');
  const { eventId } = await newEventWithSecrets('pkg');

  const pkg = await db.query<{ package_id: string }>(
    // total_price_centavos is NOT NULL — a package with no price is not a
    // package, and omitting it made this suite fail for a reason that had
    // nothing to do with what it measures.
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, primary_canonical_service, is_active,
        total_price_centavos)
     VALUES ($1, 'Full Day', 'photography', TRUE, 15000000)
     RETURNING package_id`,
    [vpid],
  );
  const booking = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages (event_id, package_id, status)
     VALUES ($1, $2, 'considering')
     RETURNING booking_id`,
    [eventId, pkg.rows[0]!.package_id],
  );
  const bookingId = booking.rows[0]!.booking_id;

  const anchor = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role, lock_request_state, lock_requested_at)
     VALUES ($1,'photographer','Package Co','considering',$2,$3,'anchor','pending',NOW())
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );
  const covered = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role)
     VALUES ($1,'videographer','Package Co','considering',$2,$3,'covered')
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );

  await asVendor(uid);
  const res = await db.query<{ r: Row }>(
    `SELECT public.vendor_agree_to_lock($1) AS r`,
    [anchor.rows[0]!.vendor_id],
  );
  assert.equal(res.rows[0]!.r.status, 'ok');
  assert.equal(
    res.rows[0]!.r.package_lines_booked,
    1,
    'the envelope must REPORT the promotion — a silent one is unmeasurable from a log',
  );

  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  const cov = await db.query<Row>(
    `SELECT status::text AS status FROM public.event_vendors WHERE vendor_id = $1`,
    [covered.rows[0]!.vendor_id],
  );
  assert.equal(
    cov.rows[0]!.status,
    'contracted',
    'a covered line left at considering is HALF a package — a state with no copy and no way out',
  );
  const bk = await db.query<Row>(
    `SELECT status, locked_at FROM public.event_vendor_packages WHERE booking_id = $1`,
    [bookingId],
  );
  assert.equal(bk.rows[0]!.status, 'locked');
  assert.ok(bk.rows[0]!.locked_at, 'locked_at is the receipt and it lands when the lock does');
  // MUTATION: delete the `IF v_pkg_id IS NOT NULL` block ⇒ the covered row stays
  // 'considering', the booking row stays 'considering', three assertions red.
});

test('the package promotion is MONOTONE — it never demotes a paid line', async () => {
  const { vpid, uid } = await newVendor('pkgmono@sliceb.test', 'Mono Co');
  const { eventId } = await newEventWithSecrets('pkgmono');
  const pkg = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, primary_canonical_service, is_active,
        total_price_centavos)
     VALUES ($1, 'Mono', 'photography', TRUE, 15000000) RETURNING package_id`,
    [vpid],
  );
  const booking = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages (event_id, package_id, status)
     VALUES ($1, $2, 'considering') RETURNING booking_id`,
    [eventId, pkg.rows[0]!.package_id],
  );
  const bookingId = booking.rows[0]!.booking_id;
  const anchor = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role, lock_request_state, lock_requested_at)
     VALUES ($1,'photographer','Mono Co','considering',$2,$3,'anchor','pending',NOW())
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );
  // A covered line that is ALREADY PAID — the shape a naive UPDATE would walk
  // backwards, firing the release trigger and freeing the vendor's held date.
  const paid = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        event_vendor_package_id, package_role)
     VALUES ($1,'videographer','Mono Co','deposit_paid',$2,$3,'covered')
     RETURNING vendor_id`,
    [eventId, vpid, bookingId],
  );

  await asVendor(uid);
  await db.query(`SELECT public.vendor_agree_to_lock($1)`, [anchor.rows[0]!.vendor_id]);

  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  const after = await db.query<Row>(
    `SELECT status::text AS status FROM public.event_vendors WHERE vendor_id = $1`,
    [paid.rows[0]!.vendor_id],
  );
  assert.equal(
    after.rows[0]!.status,
    'deposit_paid',
    'the CASE is what stops this; an unconditional SET status = contracted reddens here',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · THE INVERSE. The RPC with zero callers, exercised end to end.
// ───────────────────────────────────────────────────────────────────────────

test('the couple can withdraw a pending ask, and only while it IS pending', async () => {
  const { vpid, uid } = await newVendor('withdraw@sliceb.test');
  const { eventId, coupleUid } = await newEventWithSecrets('withdraw');
  const evId = await newBooking(eventId, vpid, { pending: true });

  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, coupleUid);
  const r = await db.query<{ r: Row }>(
    `SELECT public.cancel_vendor_lock_request($1) AS r`,
    [evId],
  );
  assert.equal(r.rows[0]!.r.status, 'ok');
  assert.equal(
    r.rows[0]!.r.event_id,
    eventId,
    'the envelope carries the AUTHORIZED event id — the server action must never take one from a form',
  );

  await setAuthUid(db, null);
  const row = await db.query<Row>(
    `SELECT status::text AS status, lock_request_state, lock_request_cancelled_at
       FROM public.event_vendors WHERE vendor_id = $1`,
    [evId],
  );
  assert.equal(row.rows[0]!.lock_request_state, 'cancelled');
  assert.equal(row.rows[0]!.status, 'considering', 'withdrawing an ask must not touch the status');
  assert.ok(row.rows[0]!.lock_request_cancelled_at);

  // And the SUPPLIER can no longer agree to a question that was taken back.
  await asVendor(uid);
  const agree = await db.query<{ r: Row }>(
    `SELECT public.vendor_agree_to_lock($1) AS r`,
    [evId],
  );
  assert.equal(agree.rows[0]!.r.status, 'not_pending');
  assert.equal(agree.rows[0]!.r.current, 'cancelled');
});

test('a withdrawal frees the category — the couple can ask someone else immediately', async () => {
  // The whole point of the inverse: without it the pending index holds the
  // hard-single category for seven days and the couple is stuck.
  const a = await newVendor('free-a@sliceb.test', 'Venue A');
  const b = await newVendor('free-b@sliceb.test', 'Venue B');
  const { eventId, coupleUid } = await newEventWithSecrets('free');
  const first = await newBooking(eventId, a.vpid, { pending: true, category: 'venue' });

  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, coupleUid);
  // Before withdrawing, a second ask in the same hard-single category is refused
  // by the unique index — proving the index is live and the test is not vacuous.
  await assert.rejects(
    () => newBooking(eventId, b.vpid, { pending: true, category: 'venue' }),
    /one_pending_lock_request_per_group/,
  );
  await db.query(`SELECT public.cancel_vendor_lock_request($1)`, [first]);
  await setAuthUid(db, null);
  const second = await newBooking(eventId, b.vpid, { pending: true, category: 'venue' });
  assert.ok(second, 'after the withdrawal the category is open again');
});
