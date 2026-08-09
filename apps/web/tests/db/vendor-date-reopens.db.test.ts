/**
 * A BOOKED DATE MUST COME BACK WHEN THE BOOKING GOES AWAY — END-TO-END DB
 * verification (migrations replayed). Covers
 * 20271121865976_vendor_date_reopens_when_booking_released.
 *
 * The bug this suite exists to keep dead: reaching 'deposit_paid' auto-closed
 * the vendor's date (20270428213000) and NOTHING ever reopened it. Not a
 * function, not a trigger, not the vendor — `removeBlock` filters
 * block_source to manual/external_client, and the calendar surface hides
 * `setnayan_booking` rows from the removable list. A couple who backed out left
 * that vendor showing BUSY to every other couple, forever, with the waitlist
 * built for exactly that moment unable to deliver anyone a bookable date.
 *
 * Nothing threw and nothing logged — the only symptom was an absence. So every
 * assertion here is driven through a real UPDATE/DELETE so the trigger wiring
 * itself is exercised, never by reading the function body.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  // 🚨 PIN THE SESSION TO UTC — the clock this bug hides from.
  // Blocks are written at PH midnight (`…T00:00:00+08:00`). A bare
  // `blocked_at::date` renders that instant in the SESSION's timezone, so on a
  // +08 laptop it reads 14 Mar and in UTC — which is what prod and CI actually
  // run — it reads 13 Mar. The first draft of this suite passed locally and
  // failed in CI for exactly that reason, and the feature would have shipped
  // doing nothing. Running UTC here makes the trap reproducible on any machine.
  await db.query(`SET TIME ZONE 'UTC'`);
});

after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function newVendor(label: string): Promise<string> {
  // NOTE: signing up with account_type 'vendor' already MINTS the profile via
  // on_auth_user_created, and vendor_profiles.user_id is UNIQUE — inserting a
  // second one here fails with a duplicate key. Take the row the signup made.
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq(label)}@reopen.test`],
  );
  const userId = u.rows[0]!.id;

  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id
    ?? (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Reopen Test Vendor', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;

  // Verified: enforce_booking_requires_verified_vendor refuses to let an
  // unverified shop be booked at all, and an unbookable vendor can never
  // reach the auto-block this suite is about.
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = 'Reopen Test Vendor',
            location_city = 'Manila',
            services = ARRAY['photography']::text[],
            verification_state = 'verified',
            last_verified_at = NOW()
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return vendorProfileId;
}

async function newEvent(label: string, eventDate: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [uniq(label), eventDate],
  );
  return r.rows[0]!.event_id;
}

/** Create a booking already AT deposit_paid — the auto-block fires on insert. */
async function newBookedRow(eventId: string, vendorProfileId: string | null): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Reopen Test Vendor', 'deposit_paid', $2)
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  return r.rows[0]!.vendor_id;
}

async function setStatus(eventVendorId: string, status: string): Promise<void> {
  await db.query(`UPDATE public.event_vendors SET status = $1::public.vendor_status WHERE vendor_id = $2`, [
    status,
    eventVendorId,
  ]);
}

/** How many auto-written closures cover this vendor's day. */
async function autoBlockCount(vendorProfileId: string, date: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1
        AND pool_id IS NULL
        AND block_source = 'setnayan_booking'
        AND (blocked_at AT TIME ZONE 'Asia/Manila')::date = $2::date`,
    [vendorProfileId, date],
  );
  return r.rows[0]!.n;
}

/** Every block of any source covering the day — what a couple actually feels. */
async function anyBlockCount(vendorProfileId: string, date: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1
        AND blocked_at <= ($2::text || 'T23:59:59+08:00')::timestamptz
        AND blocked_until >= ($2::text || 'T00:00:00+08:00')::timestamptz`,
    [vendorProfileId, date],
  );
  return r.rows[0]!.n;
}

// ─────────────────────────────────────────────────────────────────────────────
// The baseline: the bug's own precondition. If this ever stops holding, every
// assertion below is testing nothing.
// ─────────────────────────────────────────────────────────────────────────────

test('BASELINE: reaching deposit_paid still closes the date', async () => {
  const vendor = await newVendor('baseline');
  const eventId = await newEvent('baseline', '2027-03-14');
  await newBookedRow(eventId, vendor);
  assert.equal(
    await autoBlockCount(vendor, '2027-03-14'),
    1,
    'the auto-block did not fire — the reopen tests below would pass vacuously',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The fix.
// ─────────────────────────────────────────────────────────────────────────────

test('the couple backs out: downgrading off deposit_paid reopens the date', async () => {
  const vendor = await newVendor('backout');
  const eventId = await newEvent('backout', '2027-04-02');
  const booking = await newBookedRow(eventId, vendor);
  assert.equal(await autoBlockCount(vendor, '2027-04-02'), 1, 'precondition: date closed');

  await setStatus(booking, 'contracted');

  assert.equal(
    await autoBlockCount(vendor, '2027-04-02'),
    0,
    'the date stayed shut after the booking was released — this is the original bug',
  );
  assert.equal(
    await anyBlockCount(vendor, '2027-04-02'),
    0,
    'no closure of any kind may survive; a couple must be able to book this day',
  );
});

test('a hard DELETE of the booking reopens the date too', async () => {
  const vendor = await newVendor('deleted');
  const eventId = await newEvent('deleted', '2027-04-09');
  const booking = await newBookedRow(eventId, vendor);
  assert.equal(await autoBlockCount(vendor, '2027-04-09'), 1, 'precondition: date closed');

  await db.query(`DELETE FROM public.event_vendors WHERE vendor_id = $1`, [booking]);

  assert.equal(await autoBlockCount(vendor, '2027-04-09'), 0, 'a cascaded delete must free the day');
});

test('deposit_paid → delivered → complete is NOT a release; the date stays shut', async () => {
  const vendor = await newVendor('progress');
  const eventId = await newEvent('progress', '2027-05-01');
  const booking = await newBookedRow(eventId, vendor);

  await setStatus(booking, 'delivered');
  assert.equal(
    await autoBlockCount(vendor, '2027-05-01'),
    1,
    'delivering the work is not backing out — the date must stay taken',
  );

  await setStatus(booking, 'complete');
  assert.equal(await autoBlockCount(vendor, '2027-05-01'), 1, 'nor is completing it');
});

test('a SECOND live booking on the same day keeps the date shut', async () => {
  // Capacity > 1 vendors (a studio with two crews) can hold two weddings on one
  // day. One couple leaving must not advertise the vendor as free while the
  // other is still booked.
  const vendor = await newVendor('twobookings');
  const dayA = await newEvent('twobookings-a', '2027-06-06');
  const dayB = await newEvent('twobookings-b', '2027-06-06');
  const first = await newBookedRow(dayA, vendor);
  await newBookedRow(dayB, vendor);
  assert.equal(await autoBlockCount(vendor, '2027-06-06'), 1, 'one closure covers the day');

  await setStatus(first, 'contracted');

  assert.equal(
    await autoBlockCount(vendor, '2027-06-06'),
    1,
    'the day reopened while a second couple is still booked on it — double-booking risk',
  );

  // …and once the LAST one leaves, it does reopen.
  await db.query(
    `UPDATE public.event_vendors SET status = 'contracted'::public.vendor_status
      WHERE event_id = $1 AND marketplace_vendor_id = $2`,
    [dayB, vendor],
  );
  assert.equal(
    await autoBlockCount(vendor, '2027-06-06'),
    0,
    'with nobody booked the day must finally come back',
  );
});

test("a vendor's OWN manual closure survives the reopen", async () => {
  // The reopen undoes Setnayan's automatic closure and nothing else. A vendor
  // who also blocked the day by hand (they are away) keeps it blocked.
  const vendor = await newVendor('manualtoo');
  const eventId = await newEvent('manualtoo', '2027-07-04');
  const booking = await newBookedRow(eventId, vendor);
  await db.query(
    `INSERT INTO public.vendor_calendar_blocks
       (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, is_private)
     VALUES ($1, NULL, '2027-07-04T00:00:00+08:00'::timestamptz,
             '2027-07-04T23:30:00+08:00'::timestamptz, 'Out of town', 'manual', TRUE)`,
    [vendor],
  );

  await setStatus(booking, 'contracted');

  assert.equal(await autoBlockCount(vendor, '2027-07-04'), 0, "Setnayan's own closure must go");
  assert.equal(
    await anyBlockCount(vendor, '2027-07-04'),
    1,
    "the vendor's hand-written block was destroyed — we may only undo what we wrote",
  );
});

test('only THIS day reopens — a neighbouring booked date is untouched', async () => {
  const vendor = await newVendor('neighbour');
  const keepEvent = await newEvent('neighbour-keep', '2027-08-15');
  const dropEvent = await newEvent('neighbour-drop', '2027-08-16');
  await newBookedRow(keepEvent, vendor);
  const dropping = await newBookedRow(dropEvent, vendor);

  await setStatus(dropping, 'contracted');

  assert.equal(await autoBlockCount(vendor, '2027-08-16'), 0, 'the released day must reopen');
  assert.equal(
    await autoBlockCount(vendor, '2027-08-15'),
    1,
    'a different booked date was reopened as collateral damage',
  );
});

test('a non-marketplace (hand-entered) vendor is inert on both halves', async () => {
  // No profile means no calendar to close or reopen. Must not error either way.
  const eventId = await newEvent('manualvendor', '2027-09-09');
  const booking = await newBookedRow(eventId, null);
  await setStatus(booking, 'contracted');
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_calendar_blocks WHERE block_source = 'setnayan_booking'
       AND blocked_at::date = '2027-09-09'::date`,
  );
  assert.equal(r.rows[0]!.n, 0, 'a vendor with no profile must write no calendar rows');
});

// ─────────────────────────────────────────────────────────────────────────────
// The inverse primitive, directly.
// ─────────────────────────────────────────────────────────────────────────────

test('vendor_unblock_booked_date reports honestly whether it reopened anything', async () => {
  const vendor = await newVendor('primitive');

  // Nothing to remove → FALSE, not a silent success.
  const noop = await db.query<{ ok: boolean }>(
    `SELECT public.vendor_unblock_booked_date($1, '2027-10-10'::date) AS ok`,
    [vendor],
  );
  assert.equal(noop.rows[0]!.ok, false, 'reopening a day that was never shut must report FALSE');

  // Now close it by hand through the forward primitive, then undo.
  await db.query(`SELECT public.vendor_block_booked_date($1, '2027-10-10'::date, 'Booked')`, [
    vendor,
  ]);
  assert.equal(await autoBlockCount(vendor, '2027-10-10'), 1, 'precondition: closed');

  const undone = await db.query<{ ok: boolean }>(
    `SELECT public.vendor_unblock_booked_date($1, '2027-10-10'::date) AS ok`,
    [vendor],
  );
  assert.equal(undone.rows[0]!.ok, true, 'a real reopen must report TRUE');
  assert.equal(await autoBlockCount(vendor, '2027-10-10'), 0, 'and must actually delete the row');

  // NULL args are a no-op, never an exception.
  const nulls = await db.query<{ ok: boolean }>(
    `SELECT public.vendor_unblock_booked_date(NULL::uuid, NULL::date) AS ok`,
  );
  assert.equal(nulls.rows[0]!.ok, false);
});

test('THE DAY BOUNDARY IS PINNED — neither primitive may use a bare ::date', async () => {
  // The regression that nearly shipped: a bare `blocked_at::date` renders a
  // PH-midnight block in the SESSION timezone, so under prod's UTC it names the
  // day BEFORE. Proven behaviourally, in both directions, on the clock that
  // exposes it — and then re-proven against a +08 session so the fix is not
  // merely "right for UTC" but timezone-independent.
  for (const sessionTz of ['UTC', 'Asia/Manila', 'America/New_York']) {
    await db.query(`SET TIME ZONE '${sessionTz}'`);
    const vendor = await newVendor(`tz-${sessionTz}`);
    const date = '2028-01-20';

    await db.query(`SELECT public.vendor_block_booked_date($1, $2::date, 'Booked')`, [
      vendor,
      date,
    ]);
    assert.equal(
      await autoBlockCount(vendor, date),
      1,
      `block landed on the wrong civil day under ${sessionTz}`,
    );

    // Idempotency is the twin's own documented promise, and the bare cast broke
    // it: a second call inserted a DUPLICATE instead of returning early.
    await db.query(`SELECT public.vendor_block_booked_date($1, $2::date, 'Booked')`, [
      vendor,
      date,
    ]);
    assert.equal(
      await autoBlockCount(vendor, date),
      1,
      `vendor_block_booked_date stopped being idempotent under ${sessionTz} — it wrote a duplicate`,
    );

    const undone = await db.query<{ ok: boolean }>(
      `SELECT public.vendor_unblock_booked_date($1, $2::date) AS ok`,
      [vendor, date],
    );
    assert.equal(
      undone.rows[0]!.ok,
      true,
      `the reopen matched nothing under ${sessionTz} — the date would stay shut forever`,
    );
    assert.equal(await autoBlockCount(vendor, date), 0, `row survived under ${sessionTz}`);
  }
  await db.query(`SET TIME ZONE 'UTC'`); // leave the session as CI runs it
});

test('the forward and inverse primitives agree on which row they mean', async () => {
  // They matched on a hand-copied predicate (pool_id IS NULL · block_source ·
  // blocked_at::date). If either drifts, block-then-unblock stops round-tripping
  // and the date silently never comes back — the original bug, reintroduced.
  const vendor = await newVendor('roundtrip');
  for (const date of ['2027-11-01', '2027-11-02', '2027-11-03']) {
    await db.query(`SELECT public.vendor_block_booked_date($1, $2::date, 'Booked')`, [vendor, date]);
    assert.equal(await autoBlockCount(vendor, date), 1, `block failed for ${date}`);
    const r = await db.query<{ ok: boolean }>(
      `SELECT public.vendor_unblock_booked_date($1, $2::date) AS ok`,
      [vendor, date],
    );
    assert.equal(r.rows[0]!.ok, true, `unblock did not match the block it should undo (${date})`);
    assert.equal(await autoBlockCount(vendor, date), 0, `row survived for ${date}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Wiring. A trigger that exists but is not attached fails silently forever.
// ─────────────────────────────────────────────────────────────────────────────

test('the reopen trigger is actually ATTACHED to event_vendors', async () => {
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_triggerdef(t.oid) AS def
       FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'event_vendors'
        AND t.tgname = 'event_vendor_reopen_on_release'
        AND NOT t.tgisinternal`,
  );
  assert.equal(r.rows.length, 1, 'the reopen trigger is not attached — the fix is decoration');
  // Postgres normalises the event order in pg_get_triggerdef (DELETE first),
  // so assert each release shape independently rather than on one phrase.
  const def = r.rows[0]!.def;
  assert.match(def, /\bAFTER\b/, `must be an AFTER trigger, got: ${def}`);
  assert.match(def, /\bUPDATE OF status\b/, `must fire on a status change: ${def}`);
  assert.match(def, /\bDELETE\b/, `must fire on a delete: ${def}`);
  assert.match(def, /FOR EACH ROW/, def);
});

test('the reopen mirrors the auto-block: same table, same trigger timing', async () => {
  // The two halves must stay a pair. If one is moved or re-timed and the other
  // is not, dates close and never open — which is precisely what shipped.
  const r = await db.query<{ tgname: string }>(
    `SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'event_vendors' AND NOT t.tgisinternal
        AND t.tgname IN ('event_vendor_autoblock_on_booking', 'event_vendor_reopen_on_release')`,
  );
  const names = r.rows.map((x) => x.tgname).sort();
  assert.deepEqual(
    names,
    ['event_vendor_autoblock_on_booking', 'event_vendor_reopen_on_release'],
    `the close/open pair is incomplete: ${JSON.stringify(names)}`,
  );
});
