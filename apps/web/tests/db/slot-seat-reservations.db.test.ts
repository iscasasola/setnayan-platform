/**
 * TABLE RESERVATIONS — "Setnayan holds the reservation" (owner 2026-08-01).
 * Verifies 20271029000675_restaurant_table_seat_reservations against the FULL
 * replayed prod schema (every migration, in order, in an in-memory PGlite).
 *
 * The thing that matters here is that CAPACITY CANNOT BE EXCEEDED and that a
 * CANCELLATION ACTUALLY GIVES THE SEAT BACK. Both are asserted against the real
 * SQL, exercised through the real RPCs, as the real end-user role — not against
 * a TypeScript reimplementation of the rules.
 *
 * Specifically proven:
 *   • seats, not bookings — two parties of 6 fill a 12-seat window, and the
 *     THIRD party is refused. This is the defect that would have shipped had
 *     the reservation reused acquire_service_time_slot's count(*);
 *   • the CHECK is a real backstop — a direct oversell UPDATE as the table
 *     owner (bypassing every RPC) is REJECTED by the database itself;
 *   • cancel releases exactly the seats it consumed, and the released seat is
 *     immediately re-bookable;
 *   • a double cancel does NOT double-release (the classic way a "cancelled"
 *     reservation quietly mints capacity);
 *   • the ledger never disagrees with the reservations behind it;
 *   • a slot with seat_capacity IS NULL is NOT reservable — the tier-#3 path
 *     is untouched and the new path fails CLOSED;
 *   • a stranger cannot reserve on someone else's event, and authenticated
 *     cannot write either table directly (single-writer property);
 *   • capacity is per (slot x DATE) — a full Friday does not close Saturday;
 *   • a vendor can close a date, but cannot strand tables already held.
 *
 * HONEST LIMIT: PGlite is a single in-process connection, so these tests CANNOT
 * exercise two transactions racing for the last seat. What they do prove is the
 * property that makes the race safe — the invariant is owned by a CHECK
 * constraint and a single conditional UPDATE, not by application sequencing, so
 * there is no read-then-write window for a racer to land in. The oversell test
 * deliberately attacks the constraint as the table OWNER, which is the strongest
 * check available without a real multi-connection Postgres.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

type Envelope = { status: string; [k: string]: unknown };

async function reserve(
  eventId: string,
  slotId: string,
  date: string,
  party: number,
): Promise<Envelope> {
  const r = await db.query<{ out: Envelope }>(
    `SELECT public.reserve_service_slot_seats($1,$2,$3::date,$4) AS out`,
    [eventId, slotId, date, party],
  );
  return r.rows[0]!.out;
}
async function cancel(reservationId: string): Promise<Envelope> {
  const r = await db.query<{ out: Envelope }>(
    `SELECT public.cancel_service_slot_reservation($1) AS out`,
    [reservationId],
  );
  return r.rows[0]!.out;
}
async function seatsTaken(slotId: string, date: string): Promise<number | null> {
  await asOwner();
  const r = await db.query<{ seats_taken: number }>(
    `SELECT seats_taken FROM public.service_slot_day_state
      WHERE slot_id = $1 AND reserved_date = $2::date`,
    [slotId, date],
  );
  return r.rows[0]?.seats_taken ?? null;
}

/** The ledger must always equal the reservations behind it. Zero rows = agree. */
async function ledgerDrift(): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (
       SELECT d.slot_id, d.reserved_date, d.seats_taken,
              COALESCE(SUM(r.party_size), 0) AS from_rows
         FROM public.service_slot_day_state d
         LEFT JOIN public.service_slot_reservations r
           ON r.slot_id = d.slot_id
          AND r.reserved_date = d.reserved_date
          AND r.status IN ('held','confirmed')
        GROUP BY d.slot_id, d.reserved_date, d.seats_taken
       HAVING d.seats_taken <> COALESCE(SUM(r.party_size), 0)
     ) drift`,
  );
  return r.rows[0]!.n;
}

const FRI = '2027-12-03';
const SAT = '2027-12-04';

const F = {
  hostA: '',
  hostB: '',
  eventA: '',
  eventB: '',
  vendorUser: '',
  vendorProfile: '',
  serviceId: '',
  /** 12 covers — the reservable dinner seating. */
  seatedSlot: '',
  /** seat_capacity NULL — a tier-#3 booking slot, must stay unreservable. */
  bookingSlot: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  // Two unrelated couples, so cross-event authorization is testable.
  for (const key of ['A', 'B'] as const) {
    const uid = (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [`host${key.toLowerCase()}@resv.test`],
      )
    ).rows[0]!.id;
    const eventId = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type)
         VALUES ($1,'birthday') RETURNING event_id`,
        [`Dinner ${key}`],
      )
    ).rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1,$2,'couple')`,
      [eventId, uid],
    );
    if (key === 'A') {
      F.hostA = uid;
      F.eventA = eventId;
    } else {
      F.hostB = uid;
      F.eventB = eventId;
    }
  }

  // The restaurant.
  F.vendorUser = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ('resto@resv.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  F.vendorProfile = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1,'Kanto Dining','Manila',ARRAY['catering']::text[],'verified', NOW())
       RETURNING vendor_profile_id`,
      [F.vendorUser],
    )
  ).rows[0]!.vendor_profile_id;
  F.serviceId = (
    await db.query<{ vendor_service_id: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
       VALUES ($1,'catering',40000,'Free extra hour') RETURNING vendor_service_id`,
      [F.vendorProfile],
    )
  ).rows[0]!.vendor_service_id;

  // 12-cover 7PM seating, and a capacity-less tier-#3 slot alongside it.
  F.seatedSlot = (
    await db.query<{ slot_id: string }>(
      `INSERT INTO public.vendor_service_time_slots
         (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time,
          slot_capacity, seat_capacity)
       VALUES ($1,$2,'7PM Seating','19:00','21:00', 1, 12) RETURNING slot_id`,
      [F.vendorProfile, F.serviceId],
    )
  ).rows[0]!.slot_id;
  F.bookingSlot = (
    await db.query<{ slot_id: string }>(
      `INSERT INTO public.vendor_service_time_slots
         (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time,
          slot_capacity, seat_capacity)
       VALUES ($1,$2,'AM Ceremony','08:00','11:00', 3, NULL) RETURNING slot_id`,
      [F.vendorProfile, F.serviceId],
    )
  ).rows[0]!.slot_id;

  // Both couples have a booking row against the service — the precondition the
  // shipped vsts_couple_read policy already imposes for seeing a slot at all.
  for (const eventId of [F.eventA, F.eventB]) {
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1,'catering','Kanto Dining','shortlisted',$2,$3)`,
      [eventId, F.vendorProfile, F.serviceId],
    );
  }
});

after(async () => {
  await asOwner();
  await db.close?.();
});

const MIGRATION_FILE = '20271029000675_restaurant_table_seat_reservations.sql';

test('the migration applied on top of the full corpus (not skipped)', async () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );

  // "It replayed" is not the same as "the objects exist" — assert the objects.
  await asOwner();
  const objs = await db.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM pg_class
         WHERE relname IN ('service_slot_day_state','service_slot_reservations')
           AND relnamespace = 'public'::regnamespace)
     + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname IN ('reserve_service_slot_seats','cancel_service_slot_reservation',
                             'confirm_service_slot_reservation','set_service_slot_day_capacity'))
     )::int AS n`,
  );
  assert.equal(objs.rows[0]!.n, 6, '2 tables + 4 RPCs must exist after replay');
});

test('capacity is counted in SEATS, not in bookings', async () => {
  await asUser(F.hostA);
  const first = await reserve(F.eventA, F.seatedSlot, FRI, 6);
  assert.equal(first.status, 'ok', JSON.stringify(first));
  assert.equal(first.seats_remaining, 6);

  await asUser(F.hostB);
  const second = await reserve(F.eventB, F.seatedSlot, FRI, 6);
  assert.equal(second.status, 'ok', JSON.stringify(second));
  assert.equal(second.seats_remaining, 0);

  // Two BOOKINGS have now filled a 12-SEAT window. Under the pre-existing
  // count(*) model these two rows would have consumed 2 of 12 "capacity" and
  // ten more parties would still have been admitted to a full restaurant.
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12);
  assert.equal(await ledgerDrift(), 0);
});

test('a third party is refused once the seats are gone', async () => {
  // A third couple, so the refusal is capacity and not the one-per-event index.
  await asOwner();
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ('hostc@resv.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type)
       VALUES ('Dinner C','birthday') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, uid],
  );
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1,'catering','Kanto Dining','shortlisted',$2,$3)`,
    [eventId, F.vendorProfile, F.serviceId],
  );

  await asUser(uid);
  const full = await reserve(eventId, F.seatedSlot, FRI, 2);
  assert.equal(full.status, 'full', JSON.stringify(full));
  assert.equal(full.seats_remaining, 0);

  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12);
  assert.equal(await ledgerDrift(), 0);
});

test('the CHECK rejects an oversell even with every RPC bypassed', async () => {
  // As the table OWNER — no RLS, no grants, no RPC. If capacity were merely
  // "enforced in the app" this would succeed.
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.service_slot_day_state
            SET seats_taken = seats_taken + 1
          WHERE slot_id = $1 AND reserved_date = $2::date`,
        [F.seatedSlot, FRI],
      ),
    /sscds_within_capacity|violates check constraint/i,
    'the database itself must refuse to hold more seats than the window has',
  );
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12);
});

test('capacity is per (slot x DATE) — a full Friday does not close Saturday', async () => {
  await asUser(F.hostA);
  const sat = await reserve(F.eventA, F.seatedSlot, SAT, 10);
  assert.equal(sat.status, 'ok', JSON.stringify(sat));
  assert.equal(await seatsTaken(F.seatedSlot, SAT), 10);
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12);
  assert.equal(await ledgerDrift(), 0);
});

test('cancelling frees the seat, and the freed seat is re-bookable', async () => {
  await asUser(F.hostA);
  const held = await db.query<{ reservation_id: string }>(
    `SELECT reservation_id FROM public.service_slot_reservations
      WHERE event_id = $1 AND slot_id = $2 AND reserved_date = $3::date
        AND status = 'held'`,
    [F.eventA, F.seatedSlot, FRI],
  );
  const reservationId = held.rows[0]!.reservation_id;

  const out = await cancel(reservationId);
  assert.equal(out.status, 'ok', JSON.stringify(out));
  assert.equal(out.seats_released, 6);
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 6);
  assert.equal(await ledgerDrift(), 0);

  // The whole point: somebody else can now have that table.
  await asOwner();
  const uid = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ('hostd@resv.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type)
       VALUES ('Dinner D','birthday') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, uid],
  );

  await asUser(uid);
  const rebooked = await reserve(eventId, F.seatedSlot, FRI, 6);
  assert.equal(rebooked.status, 'ok', JSON.stringify(rebooked));
  assert.equal(rebooked.seats_remaining, 0);
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12);
  assert.equal(await ledgerDrift(), 0);
});

test('a double cancel does NOT release the seats twice', async () => {
  await asUser(F.hostA);
  const r = await db.query<{ reservation_id: string }>(
    `SELECT reservation_id FROM public.service_slot_reservations
      WHERE event_id = $1 AND slot_id = $2 AND reserved_date = $3::date
        AND status = 'held'`,
    [F.eventA, F.seatedSlot, SAT],
  );
  const reservationId = r.rows[0]!.reservation_id;

  const first = await cancel(reservationId);
  assert.equal(first.status, 'ok');
  const afterFirst = await seatsTaken(F.seatedSlot, SAT);
  assert.equal(afterFirst, 0);

  await asUser(F.hostA);
  const second = await cancel(reservationId);
  assert.equal(second.status, 'already_cancelled', JSON.stringify(second));
  assert.equal(await seatsTaken(F.seatedSlot, SAT), 0, 'a second cancel must not mint capacity');
  assert.equal(await ledgerDrift(), 0);
});

test('a slot with no seat_capacity is NOT reservable (tier-#3 path untouched)', async () => {
  await asUser(F.hostB);
  const out = await reserve(F.eventB, F.bookingSlot, FRI, 2);
  assert.equal(out.status, 'not_reservable', JSON.stringify(out));
  assert.equal(await seatsTaken(F.bookingSlot, FRI), null);
});

test('one event cannot hold the same table twice on the same date', async () => {
  await asUser(F.hostB);
  const dup = await reserve(F.eventB, F.seatedSlot, FRI, 1);
  assert.equal(dup.status, 'already_reserved', JSON.stringify(dup));
  assert.equal(await seatsTaken(F.seatedSlot, FRI), 12, 'a refused duplicate must not consume');
  assert.equal(await ledgerDrift(), 0);
});

test('a stranger cannot reserve against an event that is not theirs', async () => {
  await asUser(F.hostB);
  const out = await reserve(F.eventA, F.seatedSlot, SAT, 2);
  assert.equal(out.status, 'not_authorized', JSON.stringify(out));
});

test('a reservation cannot be made for a date already past', async () => {
  await asUser(F.hostA);
  const out = await reserve(F.eventA, F.seatedSlot, '2020-01-01', 2);
  assert.equal(out.status, 'date_in_past', JSON.stringify(out));
});

test('party size is bounded — zero and absurd are both refused', async () => {
  await asUser(F.hostA);
  assert.equal((await reserve(F.eventA, F.seatedSlot, SAT, 0)).status, 'invalid_party_size');
  assert.equal((await reserve(F.eventA, F.seatedSlot, SAT, 99999)).status, 'invalid_party_size');
});

test('authenticated cannot write either table directly — one writer only', async () => {
  await asUser(F.hostA);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.service_slot_day_state SET seats_taken = 0 WHERE slot_id = $1`,
        [F.seatedSlot],
      ),
    /permission denied/i,
    'a client that can edit the ledger can oversell by editing the ledger',
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.service_slot_reservations
           (slot_id, vendor_profile_id, vendor_service_id, event_id, reserved_date, party_size)
         VALUES ($1,$2,$3,$4,$5::date,4)`,
        [F.seatedSlot, F.vendorProfile, F.serviceId, F.eventA, SAT],
      ),
    /permission denied/i,
    'a reservation inserted outside the RPC would never reach the ledger',
  );
});

test('the restaurant confirms back without moving capacity', async () => {
  await asUser(F.hostB);
  const r = await db.query<{ reservation_id: string }>(
    `SELECT reservation_id FROM public.service_slot_reservations
      WHERE event_id = $1 AND status = 'held' LIMIT 1`,
    [F.eventB],
  );
  const reservationId = r.rows[0]!.reservation_id;
  const before = await seatsTaken(F.seatedSlot, FRI);

  await asUser(F.vendorUser);
  const out = await db.query<{ out: Envelope }>(
    `SELECT public.confirm_service_slot_reservation($1) AS out`,
    [reservationId],
  );
  assert.equal(out.rows[0]!.out.status, 'ok', JSON.stringify(out.rows[0]!.out));
  assert.equal(await seatsTaken(F.seatedSlot, FRI), before, 'confirm must not move the ledger');
  assert.equal(await ledgerDrift(), 0);

  // A confirmed table still occupies, and cancelling it still releases.
  await asUser(F.vendorUser);
  const released = await cancel(reservationId);
  assert.equal(released.status, 'ok', JSON.stringify(released));
  assert.equal(await seatsTaken(F.seatedSlot, FRI), (before ?? 0) - 6);
  assert.equal(await ledgerDrift(), 0);
});

test('a vendor can close a date but cannot strand tables already held', async () => {
  // SAT currently holds 0 seats (both cancelled) — close it outright.
  await asUser(F.vendorUser);
  const closed = await db.query<{ out: Envelope }>(
    `SELECT public.set_service_slot_day_capacity($1,$2::date,0) AS out`,
    [F.seatedSlot, SAT],
  );
  assert.equal(closed.rows[0]!.out.status, 'ok', JSON.stringify(closed.rows[0]!.out));

  await asUser(F.hostA);
  const refused = await reserve(F.eventA, F.seatedSlot, SAT, 1);
  assert.equal(refused.status, 'full', 'a closed date must take no reservations');

  // FRI still holds live tables — shrinking below them must be refused.
  const taken = await seatsTaken(F.seatedSlot, FRI);
  assert.ok((taken ?? 0) > 0, 'precondition: FRI holds seats');
  await asUser(F.vendorUser);
  const strand = await db.query<{ out: Envelope }>(
    `SELECT public.set_service_slot_day_capacity($1,$2::date,0) AS out`,
    [F.seatedSlot, FRI],
  );
  assert.equal(strand.rows[0]!.out.status, 'below_taken', JSON.stringify(strand.rows[0]!.out));
  assert.equal(await seatsTaken(F.seatedSlot, FRI), taken);
  assert.equal(await ledgerDrift(), 0);
});

test('a stranger vendor cannot set capacity on a slot they do not own', async () => {
  await asUser(F.hostA);
  const out = await db.query<{ out: Envelope }>(
    `SELECT public.set_service_slot_day_capacity($1,$2::date,50) AS out`,
    [F.seatedSlot, SAT],
  );
  assert.equal(out.rows[0]!.out.status, 'not_authorized', JSON.stringify(out.rows[0]!.out));
});
