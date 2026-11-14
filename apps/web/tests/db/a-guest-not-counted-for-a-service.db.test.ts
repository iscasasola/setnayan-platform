/**
 * 🍽 "NOT COUNTED FOR ▾" — the SQL half (owner 2026-11-02, DECISION_LOG "NOT COUNTED FOR ▾"; migration
 * 20271302857885). Owner: *"just to prevent caterers counting attendees not counted"*. Against the replayed migrations:
 *
 *   · the caterer's count DROPS for a guest ticked "Not counted for" its booking — the production sheet
 *     (`get_vendor_catering_metrics`), the client page / Hub headcount (`get_vendor_event_brief` › pax) and the seat
 *     plan's meal counts (`get_vendor_seat_plan`);
 *   · another service's count (the photo booth's) DOES NOT — the guest still comes;
 *   · the supplier sees the NUMBER only: it cannot read the table, cannot call the helper that names the guests, and
 *     no guest id reaches it through the brief;
 *   · unticking counts the guest again; the couple (and nobody else) writes it; a booking of another event is refused;
 *   · every guest read of the three readers, as the database holds them after EVERY migration, carries the rule — so a
 *     later migration that re-copies one of those bodies from an older file and drops it goes red.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let otherEvent = '';
let couple = '';
let caterer = '';
let booth = '';
let catering = '';
let photobooth = '';
let otherBooking = '';
let toddler = '';
let toddlerSeat = '';

type Json = Record<string, unknown>;

async function newUser(email: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
}

async function newVendor(email: string): Promise<{ uid: string; vpid: string }> {
  const uid = await newUser(email);
  const vpid = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1, 'Count Co', 'Manila', ARRAY['catering']::text[], 'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [uid],
    )
  ).rows[0]!.vendor_profile_id;
  return { uid, vpid };
}

/**
 * A booking on a PER-HEAD service card — since 20271307968824 only a per-head service counts heads (owner 2026-11-04:
 * *"not counted for will be for service cards with pax only"*), so a tick on a flat-priced booking is refused.
 */
async function book(ev: string, vpid: string, category: string): Promise<string> {
  const have = (
    await db.query<{ s: string }>(
      `SELECT vendor_service_id AS s FROM public.vendor_services WHERE vendor_profile_id = $1 AND category = $2 LIMIT 1`,
      [vpid, category],
    )
  ).rows[0]?.s;
  const card =
    have ??
    (
      await db.query<{ s: string }>(
        `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, pricing_basis, per_pax_price_php, min_pax, is_active)
         VALUES ($1, $2, 1000, 'per_pax', 1000, 1, FALSE) RETURNING vendor_service_id AS s`,
        [vpid, category],
      )
    ).rows[0]!.s;
  return (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, $2::public.vendor_category, 'Count Co', 'contracted'::public.vendor_status, $3, $4) RETURNING vendor_id`,
      [ev, category, vpid, card],
    )
  ).rows[0]!.vendor_id;
}

async function guest(ev: string, first: string, rsvp: string, meal: string | null = null): Promise<string> {
  return (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, meal_preference)
       VALUES ($1, $2, 'Cruz', 'both', 'friends', $3::public.rsvp_status, $4::public.meal_preference) RETURNING guest_id`,
      [ev, first, rsvp, meal],
    )
  ).rows[0]!.guest_id;
}

async function asPostgres(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}

/** A signed-in browser session: the role PostgREST hands a logged-in user. */
async function asSignedIn(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
}

/** The supplier's RPC call: the SECURITY DEFINER reader, with the caller's uid. */
async function asSupplier(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
}

async function call(fn: string): Promise<Json> {
  return (await db.query<{ r: Json }>(`SELECT public.${fn}($1) AS r`, [eventId])).rows[0]!.r;
}

const catererCounts = async () => {
  await asSupplier(caterer);
  const metrics = await call('get_vendor_catering_metrics');
  const brief = await call('get_vendor_event_brief');
  const plan = await call('get_vendor_seat_plan');
  const scen = metrics.headcount_scenarios as Record<string, number>;
  const pax = brief.pax as Record<string, number>;
  const tables = plan.tables as { meal_counts: Record<string, number> | null }[];
  const meals = tables.reduce((n, t) => n + Object.values(t.meal_counts ?? {}).reduce((a, b) => a + Number(b), 0), 0);
  return {
    confirmed: scen.confirmed,
    ceiling: scen.ceiling,
    invited: Number(metrics.invited),
    briefAttending: pax.attending,
    briefInvited: pax.invited,
    seatedMeals: meals,
    brief,
    metrics,
    plan,
  };
};

const boothCounts = async () => {
  await asSupplier(booth);
  const brief = await call('get_vendor_event_brief');
  const pax = brief.pax as Record<string, number>;
  return { attending: pax.attending, invited: pax.invited };
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  couple = await newUser('couple@notcounted.test');
  eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Not counted', 'birthday', '2099-06-06') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  otherEvent = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ('Elsewhere', 'birthday', '2099-07-07') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);

  const c = await newVendor('caterer@notcounted.test');
  const b = await newVendor('booth@notcounted.test');
  caterer = c.uid;
  booth = b.uid;
  catering = await book(eventId, c.vpid, 'catering');
  photobooth = await book(eventId, b.vpid, 'photobooth');
  otherBooking = await book(otherEvent, c.vpid, 'catering');

  const ana = await guest(eventId, 'Ana', 'attending', 'chicken');
  await guest(eventId, 'Ben', 'attending', 'beef');
  toddler = await guest(eventId, 'Toddler', 'attending', 'kids');
  await guest(eventId, 'Lola', 'pending');

  // A published seat plan with the toddler and Ana seated, so the meal counts have something to count.
  await db.query(`INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, NOW())`, [eventId]);
  const table = (
    await db.query<{ table_id: string }>(
      `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order)
       VALUES ($1, 'Table 1', 'round_8', 8, 1) RETURNING table_id`,
      [eventId],
    )
  ).rows[0]!.table_id;
  await db.query(
    `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES ($1, $2, $3, 1), ($1, $2, $4, 2)`,
    [eventId, table, ana, toddler],
  );
  toddlerSeat = table;
});
after(async () => {
  await asPostgres();
  await db?.close();
});
beforeEach(asPostgres);

test('nobody is left out by the migration: no row means counted for all', async () => {
  const n = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guest_not_counted_for`)).rows[0]!.n;
  assert.equal(n, 0);
  const before = await catererCounts();
  assert.equal(before.confirmed, 3);
  assert.equal(before.briefAttending, 3);
  assert.equal(before.seatedMeals, 2);
  assert.ok(toddlerSeat);
});

test('the couple ticks the caterer — the caterer’s count drops; the photo booth’s does not', async () => {
  await asSignedIn(couple);
  await db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [toddler, catering]);

  const c = await catererCounts();
  assert.equal(c.confirmed, 2, 'the production sheet still counts the toddler');
  assert.equal(c.ceiling, 3, 'the ceiling still counts the toddler (2 attending + 1 pending)');
  assert.equal(c.invited, 3);
  assert.equal(c.briefAttending, 2, 'the client page / Hub headcount still counts the toddler');
  assert.equal(c.briefInvited, 3);
  assert.equal(c.seatedMeals, 1, 'the seat plan’s meal counts still count the toddler');
  const meals = (c.metrics.meal_counts ?? {}) as Record<string, number>;
  assert.equal(meals.kids, undefined, 'the caterer’s meal mix still carries the toddler’s kids meal');

  const b = await boothCounts();
  assert.equal(b.attending, 3, 'another service stopped counting a guest who still comes');
  assert.equal(b.invited, 4);
});

test('the supplier sees the NUMBER only — never who', async () => {
  // Nothing in what it is handed names the guest.
  const c = await catererCounts();
  for (const [what, payload] of [['brief', c.brief], ['metrics', c.metrics], ['seat plan', c.plan]] as const) {
    assert.ok(!JSON.stringify(payload).includes(toddler), `the ${what} hands the supplier the guest's id`);
  }
  // It cannot read the table…
  await asSignedIn(caterer);
  const seen = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guest_not_counted_for`)).rows[0]!.n;
  assert.equal(seen, 0, 'a supplier reads which guests are not counted');
  // …nor call the helper that names them.
  await assert.rejects(
    db.query(`SELECT public.guests_not_counted_for_services($1, ARRAY[$2]::uuid[])`, [eventId, catering]),
    /permission denied/,
    'a supplier can ask the database which guests are left out',
  );
  // …nor write one of its own.
  await assert.rejects(
    db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [toddler, photobooth]),
    /row-level security|permission denied/,
  );
});

test('a stranger and anon read nothing', async () => {
  const stranger = await newUser('stranger@notcounted.test');
  await asSignedIn(stranger);
  assert.equal((await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guest_not_counted_for`)).rows[0]!.n, 0);
  await db.exec('RESET ROLE');
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query(`SELECT 1 FROM public.guest_not_counted_for`), /permission denied/);
});

test('the couple reads their own tick; a booking of another event is refused', async () => {
  await asSignedIn(couple);
  const mine = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.guest_not_counted_for WHERE guest_id = $1`, [toddler])).rows[0]!.n;
  assert.equal(mine, 1);
  await asPostgres();
  await assert.rejects(
    db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [toddler, otherBooking]),
    /not on this event/,
  );
});

test('unticking counts the guest again', async () => {
  await asSignedIn(couple);
  await db.query(`DELETE FROM public.guest_not_counted_for WHERE guest_id = $1 AND event_vendor_id = $2`, [toddler, catering]);
  const c = await catererCounts();
  assert.equal(c.confirmed, 3);
  assert.equal(c.briefAttending, 3);
  assert.equal(c.seatedMeals, 2);
});

test('every guest read in the three supplier readers carries the rule, as the DB holds them', async () => {
  for (const fn of ['get_vendor_catering_metrics', 'get_vendor_event_brief', 'get_vendor_seat_plan']) {
    const def = (
      await db.query<{ d: string }>(
        `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn],
      )
    ).rows[0]?.d;
    assert.ok(def, `${fn} is missing`);
    const reads = (def.match(/public\.guests\b/g) ?? []).length;
    const ruled = (def.match(/\b(g2?)\.guest_id <> ALL \(v_not_counted\)/g) ?? []).length;
    assert.ok(reads > 0, `${fn} reads no guests — re-point this test`);
    assert.equal(ruled, reads, `${fn}: ${ruled} of ${reads} guest reads leave a guest not counted for this service out`);
    assert.match(def, /v_not_counted := public\.guests_not_counted_for_services\(p_event_id, /, `${fn} never works out who is left out`);
  }
});
