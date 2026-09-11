/**
 * A FULL CARD LEAVES BENCH SEARCH — and only a card the booking path would
 * really refuse. Register session H6.
 *
 * Owner, 2026-09-11: *"if there are no more available booking for that day for
 * that service card, it should not show"*. The search asks
 * `service_cards_unbookable_on()` which (card, day) pairs are refused and hides
 * a supplier only when every card is refused on every day in scope.
 *
 * Hiding the wrong card costs the couple a supplier who could have taken them;
 * showing the wrong one sends them chasing a supplier who cannot. So the one
 * claim that matters is: **the function refuses exactly what the booking path
 * refuses.** A predicate-by-predicate reading of the SQL cannot prove that —
 * the booking path is two functions plus a TypeScript pool resolver, and
 * either side can drift. So this suite asserts it BY BEHAVIOUR:
 *
 *   THE DIFFERENTIAL — for every seeded card × day × named-calendars flag, run
 *   the REAL booking path (resolve_schedule_pool → acquire_schedule_pools, and
 *   acquire_service_time_slot for slotted cards, and — for a card with a daily
 *   limit and no slot — the lock's "#2" verdict: service_card_bookings_on ≥
 *   daily_capacity, the count the gate asks) inside a transaction that is
 *   rolled back, and assert the function's verdict matches. The only allowed
 *   difference is the ruled one: a 'whitelist' day is held for the supplier's
 *   yes, not refused, so search shows it (orchestrator ruling 2026-09-11).
 *
 * The named cases below are the same facts written out, so a failure reads as
 * a sentence rather than a diff of 126 verdicts. Then the privacy and safety
 * properties: the function writes nothing, answers the server alone (never
 * anon, never a signed-in browser), caps its inputs, and returns only
 * (card, date).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271221805341_service_cards_unbookable_on.sql';

// One wedding season, one Manila calendar. Each day carries one fact.
const DAY = {
  poolFull: '2027-10-02', // A's pool at capacity · E's named calendar at capacity · both G slots taken
  open: '2027-10-03', // nothing refuses · B holds 1 booking + 1 external client of 3
  whitelist: '2027-10-04', // shop-wide whitelist — held for approval, NOT refused
  poolLocked: '2027-10-05', // 'locked' on A's pool only
  shopLocked: '2027-10-06', // 'locked' shop-wide
  shopBlocked: '2027-10-07', // a shop-wide manual block
  externalFull: '2027-10-08', // B: 2 bookings + 1 external client = its capacity of 3
  released: '2027-10-09', // A's only booking that day was released
  syncedPool: '2027-10-10', // a synced-calendar block on A's pool only
  monthFirst: '2027-10-01', // H: one real booking + two MONTH-only events stored as the 1st
} as const;
const DAYS = Object.values(DAY);

type Card = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
const card = {} as Record<Card, string>;
const pool = {} as Record<'A' | 'B' | 'D' | 'E', string>;
let coupleUid = '';
let vendorProfileId = '';
let monthVendorProfileId = '';
let monthCard = '';
const slot = {} as Record<'one' | 'two' | 'off', string>;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('h6-couple@audit.test');
  vendorProfileId = await createVendor('h6-shop@audit.test', 'Every Rule Studio');

  // A · a category pool, capacity 1.
  card.A = await createService(vendorProfileId, 'photographer');
  pool.A = await createPool(vendorProfileId, 1, true);
  await mapCategory(vendorProfileId, 'photographer', pool.A);
  // B · a category pool, capacity 3, shared with F's bundle leg.
  card.B = await createService(vendorProfileId, 'videographer');
  pool.B = await createPool(vendorProfileId, 3, true);
  await mapCategory(vendorProfileId, 'videographer', pool.B);
  // C · a category nobody has booked yet — NO pool exists. The booking path
  //     would create one on first resolve; this function must not.
  card.C = await createService(vendorProfileId, 'florist');
  // D · mapped to an INACTIVE pool that is already full. The acquire skips
  //     inactive pools entirely, so nothing about it can refuse D.
  card.D = await createService(vendorProfileId, 'caterer');
  pool.D = await createPool(vendorProfileId, 1, false);
  await mapCategory(vendorProfileId, 'caterer', pool.D);
  // E · a NAMED calendar, capacity 1, and no category mapping of its own.
  card.E = await createService(vendorProfileId, 'hair_and_makeup');
  pool.E = await createPool(vendorProfileId, 1, true);
  await db.query(
    `INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id)
     VALUES ($1, $2, $3)`,
    [card.E, pool.E, vendorProfileId],
  );
  // F · unmapped own category + a bundle leg into B's category.
  card.F = await createService(vendorProfileId, 'lights_and_sound');
  await db.query(
    `INSERT INTO public.vendor_service_links (vendor_service_id, vendor_profile_id, linked_canonical_service)
     VALUES ($1, $2, 'videographer')`,
    [card.F, vendorProfileId],
  );
  // G · Enterprise time slots: two active of capacity 1, one INACTIVE of 5.
  card.G = await createService(vendorProfileId, 'catering');
  slot.one = await createSlot(card.G, 'Lunch', '11:00', '14:00', 1, true);
  slot.two = await createSlot(card.G, 'Dinner', '18:00', '21:00', 1, true);
  slot.off = await createSlot(card.G, 'Brunch', '08:00', '10:00', 5, false);
  // H · a per-card DAILY LIMIT of 2, no time slots, a category nobody has
  //     booked into a pool yet (LOCK-PATH CAPACITY).
  card.H = await createService(vendorProfileId, 'photo_booth');
  await db.query(`UPDATE public.vendor_services SET daily_capacity = 2 WHERE vendor_service_id = $1`, [card.H]);

  // ── the facts, one per day ──────────────────────────────────────────────
  await bookPool(pool.A, DAY.poolFull);
  await bookPool(pool.D, DAY.poolFull);
  await bookPool(pool.D, DAY.open);
  await bookPool(pool.E, DAY.poolFull);
  await bookPool(pool.A, DAY.released, { released: true });

  await bookPool(pool.B, DAY.open);
  await block({ pool: pool.B, source: 'external_client', day: DAY.open });
  await bookPool(pool.B, DAY.externalFull);
  await bookPool(pool.B, DAY.externalFull);
  await block({ pool: pool.B, source: 'external_client', day: DAY.externalFull });

  await dayState(DAY.whitelist, 'whitelist', null);
  await dayState(DAY.poolLocked, 'locked', pool.A);
  await dayState(DAY.shopLocked, 'locked', null);
  await block({ pool: null, source: 'manual', day: DAY.shopBlocked });
  await block({ pool: pool.A, source: 'synced_calendar', day: DAY.syncedPool });

  // G's slots: both taken on poolFull. On open, Lunch is taken and Dinner's
  // only "bookings" are ones the booking path does not count — an archived
  // row, a shortlisted row, and a row on a month-precision event.
  await takeSlot(slot.one, DAY.poolFull);
  await takeSlot(slot.two, DAY.poolFull);
  await takeSlot(slot.one, DAY.open);
  await takeSlot(slot.two, DAY.open, { archived: true });
  await takeSlot(slot.two, DAY.open, { status: 'shortlisted' });
  await takeSlot(slot.two, DAY.open, { precision: 'month' });

  // H's bookings: full on poolFull (2 of 2); one of two on open, beside an
  // archived and a shortlisted row that are not bookings; and on the 1st one
  // real booking plus two MONTH-only events stored there — which must not count.
  await otherBooking({ day: DAY.poolFull, serviceId: card.H, status: 'deposit_paid' });
  await otherBooking({ day: DAY.poolFull, serviceId: card.H, status: 'contracted' });
  await otherBooking({ day: DAY.open, serviceId: card.H, status: 'complete' });
  await otherBooking({ day: DAY.open, serviceId: card.H, archived: true });
  await otherBooking({ day: DAY.open, serviceId: card.H, status: 'shortlisted' });
  await otherBooking({ day: DAY.monthFirst, serviceId: card.H, status: 'delivered' });
  await otherBooking({ day: DAY.monthFirst, serviceId: card.H, precision: 'month' });
  await otherBooking({ day: DAY.monthFirst, serviceId: card.H, precision: 'month', status: 'contracted' });

  // THE MONTH — a second shop whose one card is booked every day of October
  // but the 17th.
  monthVendorProfileId = await createVendor('h6-month@audit.test', 'Nearly Full Studio');
  monthCard = await createService(monthVendorProfileId, 'photographer');
  const monthPool = await createPool(monthVendorProfileId, 1, true);
  await mapCategory(monthVendorProfileId, 'photographer', monthPool);
  for (const day of october()) {
    if (day !== '2027-10-17') await bookPool(monthPool, day);
  }
});

after(async () => {
  await db?.close?.();
});

// ── fixtures ──────────────────────────────────────────────────────────────

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createVendor(email: string, name: string): Promise<string> {
  const uid = await createUser(email);
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, is_published)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[],
             'verified'::public.vendor_verification_state, NOW(), TRUE)
     RETURNING vendor_profile_id`,
    [uid, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function createService(vpid: string, category: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, $2, 40000, 'Free extra hour') RETURNING vendor_service_id`,
    [vpid, category],
  );
  return r.rows[0]!.vendor_service_id;
}

async function createPool(vpid: string, capacity: number, active: boolean): Promise<string> {
  const r = await db.query<{ pool_id: string }>(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity, is_active)
     VALUES ($1, 'pool', $2, $3) RETURNING pool_id`,
    [vpid, capacity, active],
  );
  return r.rows[0]!.pool_id;
}

async function mapCategory(vpid: string, category: string, poolId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_schedule_pool_categories (vendor_profile_id, category_key, pool_id)
     VALUES ($1, $2, $3)`,
    [vpid, category, poolId],
  );
}

async function createSlot(
  serviceId: string,
  label: string,
  start: string,
  end: string,
  capacity: number,
  active: boolean,
): Promise<string> {
  const r = await db.query<{ slot_id: string }>(
    `INSERT INTO public.vendor_service_time_slots
       (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time, slot_capacity, is_active)
     SELECT vendor_profile_id, vendor_service_id, $2, $3::time, $4::time, $5, $6
       FROM public.vendor_services WHERE vendor_service_id = $1
     RETURNING slot_id`,
    [serviceId, label, start, end, capacity, active],
  );
  return r.rows[0]!.slot_id;
}

/** Another couple's event with one supplier row on it. */
async function otherBooking(opts: {
  day: string;
  precision?: 'day' | 'month';
  serviceId?: string;
  status?: string;
  slotId?: string | null;
  archived?: boolean;
}): Promise<{ eventId: string; eventVendorId: string }> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
     VALUES ('Another wedding', 'wedding', 'catholic', 'garden', $1::date, $2) RETURNING event_id`,
    [opts.day, opts.precision ?? 'day'],
  );
  const eventId = ev.rows[0]!.event_id;
  const serviceId = opts.serviceId ?? card.A;
  const vr = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id,
        service_time_slot_id, archived_at)
     SELECT $1, 'misc', 'Every Rule Studio', $3, s.vendor_profile_id, s.vendor_service_id,
            $4::uuid, CASE WHEN $5 THEN NOW() ELSE NULL END
       FROM public.vendor_services s WHERE s.vendor_service_id = $2
     RETURNING vendor_id`,
    [eventId, serviceId, opts.status ?? 'deposit_paid', opts.slotId ?? null, opts.archived ?? false],
  );
  return { eventId, eventVendorId: vr.rows[0]!.vendor_id };
}

async function bookPool(poolId: string, day: string, opts: { released?: boolean } = {}): Promise<void> {
  const { eventId, eventVendorId } = await otherBooking({ day });
  await db.query(
    `INSERT INTO public.vendor_schedule_pool_bookings
       (pool_id, vendor_profile_id, event_vendor_id, event_id, booked_date, released_at, release_reason)
     SELECT pool_id, vendor_profile_id, $2, $3, $4::date,
            CASE WHEN $5 THEN NOW() ELSE NULL END,
            CASE WHEN $5 THEN 'host_cancelled' ELSE NULL END
       FROM public.vendor_schedule_pools WHERE pool_id = $1`,
    [poolId, eventVendorId, eventId, day, opts.released ?? false],
  );
}

async function takeSlot(
  slotId: string,
  day: string,
  opts: { archived?: boolean; status?: string; precision?: 'day' | 'month' } = {},
): Promise<void> {
  await otherBooking({
    day,
    serviceId: card.G,
    slotId,
    status: opts.status ?? 'contracted',
    archived: opts.archived ?? false,
    precision: opts.precision ?? 'day',
  });
}

/** A block covering one whole Manila day. */
async function block(opts: { pool: string | null; source: string; day: string }): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_calendar_blocks
       (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source)
     VALUES ($1, $2::uuid,
             ($3::date)::timestamp AT TIME ZONE 'Asia/Manila',
             (($3::date)::timestamp + interval '23 hours 30 minutes') AT TIME ZONE 'Asia/Manila',
             'Taken', $4)`,
    [vendorProfileId, opts.pool, opts.day, opts.source],
  );
}

async function dayState(day: string, state: 'locked' | 'whitelist', poolId: string | null): Promise<void> {
  await db.query(
    `INSERT INTO public.vendor_calendar_day_states (vendor_profile_id, state_date, day_state, pool_id)
     VALUES ($1, $2::date, $3, $4::uuid)`,
    [vendorProfileId, day, state, poolId],
  );
}

function october(): string[] {
  return Array.from({ length: 31 }, (_, i) => `2027-10-${String(i + 1).padStart(2, '0')}`);
}

// ── the two readers ───────────────────────────────────────────────────────

/** What the new function says: the set of "card@day" it refuses. */
async function refusedBy(
  serviceIds: string[],
  days: readonly string[],
  namedCalendars = true,
): Promise<Set<string>> {
  await setAuthUid(db, coupleUid);
  try {
    const r = await db.query<{ service_id: string; refused_on: string }>(
      `SELECT service_id, refused_on::text AS refused_on
         FROM public.service_cards_unbookable_on($1::uuid[], $2::date[], $3)`,
      [serviceIds, days, namedCalendars],
    );
    return new Set(r.rows.map((x) => `${x.service_id}@${x.refused_on}`));
  } finally {
    await setAuthUid(db, null);
  }
}

/**
 * What the BOOKING PATH says, for real: a fresh event of this couple's on that
 * day, the card on it, its pools resolved the way lib/schedule-pools.ts
 * `resolvePoolIdsForService` resolves them, then the two acquire functions.
 * Everything — including any pool the resolver CREATES — is rolled back.
 */
async function bookingPathRefuses(
  serviceId: string,
  day: string,
  namedCalendars: boolean,
): Promise<boolean> {
  await db.exec('BEGIN');
  try {
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Our wedding', 'wedding', 'catholic', 'garden', $1::date, 'day') RETURNING event_id`,
      [day],
    );
    const eventId = ev.rows[0]!.event_id;
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, coupleUid],
    );
    // event_vendors.category is the coarse enum; the pool gate never reads it.
    const evr = await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       SELECT $1, 'misc', 'Every Rule Studio', 'shortlisted', s.vendor_profile_id, s.vendor_service_id
         FROM public.vendor_services s WHERE s.vendor_service_id = $2
       RETURNING vendor_id`,
      [eventId, serviceId],
    );
    const eventVendorId = evr.rows[0]!.vendor_id;
    const svc = await db.query<{ vpid: string; category: string | null }>(
      `SELECT vendor_profile_id AS vpid, category FROM public.vendor_services WHERE vendor_service_id = $1`,
      [serviceId],
    );
    const { vpid, category } = svc.rows[0]!;

    await setAuthUid(db, coupleUid);

    // ── resolvePoolIdsForService, step for step ──
    const pools = new Set<string>();
    const resolveCategory = async (key: string) => {
      const r = await db.query<{ p: string | null }>(
        `SELECT public.resolve_schedule_pool($1, $2) AS p`,
        [vpid, key],
      );
      const p = r.rows[0]!.p;
      if (p) pools.add(p);
    };
    const membership = namedCalendars
      ? (
          await db.query<{ pool_id: string }>(
            `SELECT pool_id FROM public.vendor_schedule_calendar_services WHERE vendor_service_id = $1`,
            [serviceId],
          )
        ).rows[0]?.pool_id
      : undefined;
    if (membership) pools.add(membership);
    else if (category) await resolveCategory(category);
    const legs = await db.query<{ k: string }>(
      `SELECT DISTINCT linked_canonical_service AS k FROM public.vendor_service_links WHERE vendor_service_id = $1`,
      [serviceId],
    );
    for (const { k } of legs.rows) await resolveCategory(k);

    let poolRefused = false;
    if (pools.size > 0) {
      const r = await db.query<{ out: { status: string } }>(
        `SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS out`,
        [eventId, eventVendorId, [...pools]],
      );
      const status = r.rows[0]!.out.status;
      assert.ok(status !== 'not_authorized' && status !== 'no_date', `fixture never reached the gate: ${status}`);
      // 'whitelist' is the ruled difference: held for the supplier's yes.
      poolRefused = status === 'blocked' || status === 'locked' || status === 'full';
    }

    const slots = await db.query<{ slot_id: string }>(
      `SELECT slot_id FROM public.vendor_service_time_slots WHERE vendor_service_id = $1 AND is_active`,
      [serviceId],
    );
    let slotRefused = false;
    if (slots.rows.length > 0) {
      slotRefused = true;
      for (const { slot_id } of slots.rows) {
        const r = await db.query<{ out: { status: string } }>(
          `SELECT public.acquire_service_time_slot($1, $2, $3, $4) AS out`,
          [eventId, eventVendorId, serviceId, slot_id],
        );
        const status = r.rows[0]!.out.status;
        assert.ok(status !== 'not_authorized' && status !== 'no_date', `fixture never reached the gate: ${status}`);
        if (status === 'ok' || status === 'whitelist') {
          slotRefused = false;
          break;
        }
      }
    }
    // ── the lock's #2 daily-limit gate (vendors/actions.ts), for a card with no
    // active slot and a daily_capacity: the SAME count it asks, excluding the
    // row being locked, compared the way it compares. Day-precise only (this
    // event is). The count's own truth is checked independently below.
    let capacityRefused = false;
    if (slots.rows.length === 0) {
      const cap = await db.query<{ c: number | null }>(
        `SELECT daily_capacity AS c FROM public.vendor_services WHERE vendor_service_id = $1`,
        [serviceId],
      );
      const limit = cap.rows[0]?.c ?? null;
      if (typeof limit === 'number' && limit > 0) {
        const n = await db.query<{ n: number }>(
          `SELECT public.service_card_bookings_on($1, $2::date, $3) AS n`,
          [serviceId, day, eventVendorId],
        );
        capacityRefused = n.rows[0]!.n >= limit;
      }
    }
    return poolRefused || slotRefused || capacityRefused;
  } finally {
    await setAuthUid(db, null);
    await db.exec('ROLLBACK');
  }
}

const ALL = (): string[] => (Object.keys(card) as Card[]).map((k) => card[k]);
const nameOf = (id: string): string =>
  (Object.keys(card) as Card[]).find((k) => card[k] === id) ?? id;

// ── 0 · the migration really ran ──────────────────────────────────────────

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

// ── 1 · THE CLAIM — it refuses exactly what the booking path refuses ─────

test('THE DIFFERENTIAL · every card × day × flag agrees with the real booking path', async () => {
  const disagreements: string[] = [];
  let refusals = 0;
  for (const named of [true, false]) {
    const said = await refusedBy(ALL(), DAYS, named);
    for (const id of ALL()) {
      for (const day of DAYS) {
        const truth = await bookingPathRefuses(id, day, named);
        if (truth) refusals += 1;
        if (said.has(`${id}@${day}`) !== truth) {
          disagreements.push(
            `${nameOf(id)} on ${day} (named calendars ${named ? 'on' : 'off'}): booking path ${
              truth ? 'REFUSES' : 'accepts'
            }, function says ${said.has(`${id}@${day}`) ? 'refused' : 'bookable'}`,
          );
        }
      }
    }
  }
  assert.deepEqual(disagreements, []);
  // Not vacuous: the fixture must make the booking path refuse a good share of
  // the grid, and accept a good share, or agreement proves nothing.
  const cells = 2 * ALL().length * DAYS.length;
  assert.ok(refusals >= 20 && refusals <= cells - 20, `refusals ${refusals} of ${cells} — the fixture lost its teeth`);
});

test('the differential rolled everything back — no pool was created, no booking kept', async () => {
  const r = await db.query<{ pools: number; bookings: number; florist: number }>(
    `SELECT (SELECT count(*)::int FROM public.vendor_schedule_pools WHERE vendor_profile_id = $1) AS pools,
            (SELECT count(*)::int FROM public.vendor_schedule_pool_bookings WHERE vendor_profile_id = $1) AS bookings,
            (SELECT count(*)::int FROM public.vendor_schedule_pool_categories
              WHERE vendor_profile_id = $1 AND category_key = 'florist') AS florist`,
    [vendorProfileId],
  );
  assert.deepEqual(r.rows[0], { pools: 4, bookings: 8, florist: 0 });
});

// ── 2 · the same facts, as sentences ──────────────────────────────────────

test('a pool at capacity refuses its card that day and no other', async () => {
  const said = await refusedBy([card.A], DAYS);
  assert.ok(said.has(`${card.A}@${DAY.poolFull}`));
  assert.ok(!said.has(`${card.A}@${DAY.open}`));
  assert.ok(!said.has(`${card.A}@${DAY.released}`), 'a released booking frees the day');
});

test('a whitelist day is SHOWN — held for the supplier, not refused', async () => {
  const said = await refusedBy(ALL(), [DAY.whitelist]);
  assert.deepEqual([...said], []);
});

test('a locked day refuses the pool it names; a shop-wide lock refuses every live card', async () => {
  const poolLocked = await refusedBy(ALL(), [DAY.poolLocked]);
  assert.deepEqual([...poolLocked].map((k) => nameOf(k.split('@')[0]!)), ['A']);
  const shopLocked = await refusedBy(ALL(), [DAY.shopLocked]);
  assert.deepEqual(
    [...shopLocked].map((k) => nameOf(k.split('@')[0]!)).sort(),
    ['A', 'B', 'C', 'E', 'F', 'G', 'H'],
    'every card but D — whose only pool is switched off, so the booking path gates nothing',
  );
});

test('a shop-wide manual block refuses even a card whose pool does not exist yet', async () => {
  const said = await refusedBy([card.C], [DAY.shopBlocked, DAY.open]);
  assert.deepEqual([...said], [`${card.C}@${DAY.shopBlocked}`]);
});

test('external clients count toward capacity — refused at 3 of 3, not at 2 of 3', async () => {
  const said = await refusedBy([card.B], [DAY.open, DAY.externalFull]);
  assert.deepEqual([...said], [`${card.B}@${DAY.externalFull}`]);
});

test('a bundle refuses when a leg it comes with is full', async () => {
  const said = await refusedBy([card.F], [DAY.externalFull, DAY.open]);
  assert.deepEqual([...said], [`${card.F}@${DAY.externalFull}`]);
});

test('a named calendar decides when the flag is on; its category decides when off', async () => {
  assert.ok((await refusedBy([card.E], [DAY.poolFull], true)).has(`${card.E}@${DAY.poolFull}`));
  assert.equal((await refusedBy([card.E], [DAY.poolFull], false)).size, 0);
});

test('an inactive pool refuses nothing, even full', async () => {
  assert.equal((await refusedBy([card.D], DAYS)).size, 0);
});

test('slots: refused only when EVERY active slot is taken; archived, shortlisted and month-dated rows do not count', async () => {
  const said = await refusedBy([card.G], [DAY.poolFull, DAY.open]);
  assert.deepEqual([...said], [`${card.G}@${DAY.poolFull}`]);
});

test('THE MONTH · booked every day but one — 30 of 31 refused, so the supplier stays', async () => {
  const said = await refusedBy([monthCard], october());
  assert.equal(said.size, 30);
  assert.ok(!said.has(`${monthCard}@2027-10-17`));
});

// ── 2b · the per-card daily limit (LOCK-PATH CAPACITY) ────────────────────

test('a daily limit refuses its card when full, and a month-only event is no booking on the 1st', async () => {
  const said = await refusedBy([card.H], [DAY.poolFull, DAY.open, DAY.monthFirst]);
  assert.deepEqual([...said], [`${card.H}@${DAY.poolFull}`]);
});

test('the one count agrees with the rows themselves, card by card and day by day', async () => {
  // Independent of the function: the superuser reads every row and applies the
  // rule by hand — booked statuses, not archived, day-precise events that day.
  let checked = 0;
  for (const id of ALL()) {
    for (const day of DAYS) {
      const fn = await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [id, day]);
      const byHand = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.event_vendors ev JOIN public.events e ON e.event_id = ev.event_id
          WHERE ev.service_id = $1 AND e.event_date = $2::date AND e.event_date_precision = 'day'
            AND ev.archived_at IS NULL
            AND ev.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')`,
        [id, day],
      );
      assert.equal(fn.rows[0]!.n, byHand.rows[0]!.n, `${nameOf(id)} on ${day}`);
      checked += 1;
    }
  }
  const h1st = await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date) AS n`, [card.H, DAY.monthFirst]);
  assert.equal(h1st.rows[0]!.n, 1, 'the two month-only events on the 1st were counted');
  console.log(`# daily-limit count checked against the rows: ${checked} card-days`);
});

// ── 3 · safety and privacy ────────────────────────────────────────────────

test('asking writes nothing — no pool is created for a card that has none', async () => {
  const before = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_schedule_pools`);
  await refusedBy(ALL(), DAYS, true);
  await refusedBy(ALL(), DAYS, false);
  const after = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_schedule_pools`);
  assert.equal(after.rows[0]!.n, before.rows[0]!.n);
});

test('the inputs are capped — 100 cards and 31 days, no more', async () => {
  const ids = Array.from({ length: 101 }, () => card.A);
  await assert.rejects(refusedBy(ids, [DAY.open]), /too_many_service_ids/);
  await assert.rejects(refusedBy([card.A], [...october(), '2027-11-01']), /too_many_dates/);
  // The edges themselves are allowed.
  await refusedBy(Array.from({ length: 100 }, () => card.A), october());
});

test('only the server may ask — anon and signed-in callers are refused, service_role answers', async () => {
  // Granted to signed-in users, any account could read a month of any
  // supplier's full days over arbitrary card ids (orchestrator review, #5434).
  const call = () =>
    db.query(`SELECT * FROM public.service_cards_unbookable_on($1::uuid[], $2::date[])`, [[card.A], [DAY.poolFull]]);
  for (const role of ['anon', 'authenticated'] as const) {
    if (role === 'authenticated') await setAuthUid(db, coupleUid);
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(call(), /permission denied/, `${role} was allowed to call it`);
    } finally {
      await db.exec(`RESET ROLE`);
      await setAuthUid(db, null);
    }
  }
  await db.exec(`SET ROLE service_role`);
  try {
    const r = await call();
    assert.equal(r.rows.length, 1);
  } finally {
    await db.exec(`RESET ROLE`);
  }
});

test('it answers with the card and the day, nothing else', async () => {
  const r = await db.query<{ name: string }>(
    `SELECT unnest(proargnames) AS name FROM pg_proc WHERE proname = 'service_cards_unbookable_on'`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.name),
    ['p_service_ids', 'p_dates', 'p_named_calendars', 'service_id', 'refused_on'],
  );
});
