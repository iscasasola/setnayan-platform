/**
 * "NOT AVAILABLE" REPEATS AND TAKES HOURS — and the booking path honours both.
 *
 * Owner, 2026-10-14 (✅ "APPROVE": the simpler supplier dashboard — "repeating 'Not available' blocks + hour ranges:
 * YES"). The case that asked for it: a parish whose Masses fill every Sunday MORNING. One row says so, and:
 *
 *   • a couple's Sunday 10 AM time slot is REFUSED (acquire_service_time_slot → 'blocked');
 *   • a Sunday 3 PM time slot is ALLOWED;
 *   • the Sunday itself stays bookable for a card with no time (only an ALL-DAY block closes a date);
 *   • the bench search (service_cards_unbookable_on) says exactly what the booking path says, and so does the
 *     couple's search busy bit (vendors_blocked_on_date).
 *
 * Every verdict below comes from the REAL functions on a replay of every migration, inside a transaction that is
 * rolled back — never from reading the SQL. And the TypeScript twin of the rule (`lib/not-available.ts`, which every
 * screen reads) is run over the same grid as the SQL rule: one rule, written twice, may not disagree.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { FIXTURE_COVER, FIXTURE_INCLUSION } from './live-card-fixture';
import { blockOnDay, dayPartMeetsTime, type DayPart, type RepeatRule } from '../../lib/not-available';

const MIGRATION_FILE = '20271269411264_not_available_repeats_and_hours.sql';

let replay: ReplayResult;
let db: PGlite;

// 2027-01-03 is a Sunday. The Masses start there and repeat for ever.
const FIRST_SUNDAY = '2027-01-03';
const SUNDAY = '2027-03-07';
const MONDAY = '2027-03-08';
const TUESDAY = '2027-03-09';
const SATURDAY = '2027-03-13';

let coupleUid = '';
let parish = ''; // vendor_profile_id
let massCard = ''; // a card with two exact time slots: 10 AM and 3 PM
let wholeDayCard = ''; // a card with no time slot (date-only)
let slot10 = '';
let slot15 = '';
let parishPool = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  coupleUid = await createUser('na-couple@audit.test');
  parish = await createVendor('na-parish@audit.test', 'Our Lady of the Pillar');

  massCard = await createService(parish, 'catering');
  slot10 = await createSlot(massCard, 'Morning', '10:00', '11:00');
  slot15 = await createSlot(massCard, 'Afternoon', '15:00', '16:00');

  wholeDayCard = await createService(parish, 'photographer');
  parishPool = await createPool(parish, 2);
  await db.query(
    `INSERT INTO public.vendor_schedule_pool_categories (vendor_profile_id, category_key, pool_id) VALUES ($1, 'photographer', $2)`,
    [parish, parishPool],
  );

  // EVERY SUNDAY MORNING · Masses — one row, shop-wide, no end.
  await block({ day: FIRST_SUNDAY, from: '06:00', to: '12:00', repeat: 'weekly', part: 'morning', label: 'Masses' });
  // EVERY MONDAY · rest day — all day, so it closes the date.
  await block({ day: '2027-01-04', from: '00:00', to: '23:30', repeat: 'weekly', part: 'all_day', label: 'Rest day' });
});

after(async () => {
  await db?.close?.();
});

// ── fixtures ──────────────────────────────────────────────────────────────

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createVendor(email: string, name: string): Promise<string> {
  const uid = await createUser(email);
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, is_published)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified'::public.vendor_verification_state, NOW(), TRUE)
     RETURNING vendor_profile_id`,
    [uid, name],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function createService(vpid: string, category: string): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `WITH s AS (
       INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, primary_photo_r2_key)
       VALUES ($1, $2, 40000, 'Free extra hour', '${FIXTURE_COVER}')
       RETURNING vendor_service_id, vendor_profile_id
     ), i AS (
       INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label)
       SELECT vendor_service_id, vendor_profile_id, '${FIXTURE_INCLUSION}' FROM s
     )
     SELECT vendor_service_id FROM s`,
    [vpid, category],
  );
  return r.rows[0]!.vendor_service_id;
}

async function createPool(vpid: string, capacity: number): Promise<string> {
  const r = await db.query<{ pool_id: string }>(
    `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity, is_active)
     VALUES ($1, 'Main', $2, TRUE) RETURNING pool_id`,
    [vpid, capacity],
  );
  return r.rows[0]!.pool_id;
}

async function createSlot(serviceId: string, label: string, start: string, end: string): Promise<string> {
  const r = await db.query<{ slot_id: string }>(
    `INSERT INTO public.vendor_service_time_slots
       (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time, slot_capacity, is_active)
     SELECT vendor_profile_id, vendor_service_id, $2, $3::time, $4::time, 1, TRUE
       FROM public.vendor_services WHERE vendor_service_id = $1
     RETURNING slot_id`,
    [serviceId, label, start, end],
  );
  return r.rows[0]!.slot_id;
}

/** A manual "Not available" row, written the way `addManualBlock` writes one. */
async function block(o: { day: string; from: string; to: string; repeat: RepeatRule; part: DayPart; label: string; until?: string }): Promise<string> {
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.vendor_calendar_blocks
       (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, is_private,
        repeat_rule, repeat_until, day_part)
     VALUES ($1, NULL, ($2 || ' ' || $3 || ':00+08')::timestamptz, ($2 || ' ' || $4 || ':00+08')::timestamptz,
             $5, 'manual', TRUE, $6, $7::date, $8)
     RETURNING block_id`,
    [parish, o.day, o.from, o.to, o.label, o.repeat, o.until ?? null, o.part],
  );
  return r.rows[0]!.block_id;
}

/** The couple's own event on `day`, the card on it — then `fn` — all rolled back. */
async function asCoupleOn<T>(day: string, serviceId: string, fn: (ids: { eventId: string; evId: string }) => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Our wedding', 'wedding', 'catholic', 'garden', $1::date, 'day') RETURNING event_id`,
      [day],
    );
    const eventId = ev.rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, coupleUid]);
    const evr = await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       SELECT $1, 'misc', 'Our Lady of the Pillar', 'shortlisted', s.vendor_profile_id, s.vendor_service_id
         FROM public.vendor_services s WHERE s.vendor_service_id = $2
       RETURNING vendor_id`,
      [eventId, serviceId],
    );
    await setAuthUid(db, coupleUid);
    return await fn({ eventId, evId: evr.rows[0]!.vendor_id });
  } finally {
    await setAuthUid(db, null);
    await db.exec('ROLLBACK');
  }
}

async function slotVerdict(day: string, slotId: string): Promise<string> {
  return asCoupleOn(day, massCard, async ({ eventId, evId }) => {
    const r = await db.query<{ out: { status: string } }>(`SELECT public.acquire_service_time_slot($1, $2, $3, $4) AS out`, [
      eventId,
      evId,
      massCard,
      slotId,
    ]);
    return r.rows[0]!.out.status;
  });
}

async function poolVerdict(day: string): Promise<string> {
  return asCoupleOn(day, wholeDayCard, async ({ eventId, evId }) => {
    const r = await db.query<{ out: { status: string } }>(`SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS out`, [
      eventId,
      evId,
      [parishPool],
    ]);
    return r.rows[0]!.out.status;
  });
}

async function benchRefuses(serviceId: string, days: string[]): Promise<Set<string>> {
  const r = await db.query<{ refused_on: string }>(
    `SELECT refused_on::text AS refused_on FROM public.service_cards_unbookable_on($1::uuid[], $2::date[], TRUE)`,
    [[serviceId], days],
  );
  return new Set(r.rows.map((x) => x.refused_on));
}

// ── 0 · the migration really ran ──────────────────────────────────────────

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

// ── 1 · THE OWNER'S CASE ───────────────────────────────────────────────────

test('a repeating Sunday-morning block REFUSES a Sunday 10 AM booking', async () => {
  assert.equal(await slotVerdict(SUNDAY, slot10), 'blocked');
});

test('…and ALLOWS a Sunday 3 PM booking', async () => {
  assert.equal(await slotVerdict(SUNDAY, slot15), 'ok');
});

test('…and a Saturday 10 AM is untouched — the repeat is Sundays only', async () => {
  assert.equal(await slotVerdict(SATURDAY, slot10), 'ok');
});

test('…and the Sunday itself stays bookable for a card with no time (a morning never closes a date)', async () => {
  assert.equal(await poolVerdict(SUNDAY), 'ok');
});

test('an all-day weekly block closes every such date, and only those', async () => {
  assert.equal(await poolVerdict(MONDAY), 'blocked', 'every Monday, all day');
  assert.equal(await poolVerdict(TUESDAY), 'ok', 'a Tuesday is not a Monday');
  assert.equal(await slotVerdict(MONDAY, slot15), 'blocked', 'an all-day block meets every time slot too');
});

test('the repeat starts on its first day — the Monday BEFORE it is open', async () => {
  assert.equal(await poolVerdict('2026-12-28'), 'ok');
});

test('a repeat with an end stops after it', async () => {
  await db.exec('BEGIN');
  try {
    await block({ day: '2027-03-10', from: '00:00', to: '23:30', repeat: 'daily', part: 'all_day', label: 'Retreat', until: '2027-03-11' });
    const statusOn = async (day: string) => {
      const ev = await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ('Our wedding', 'wedding', 'catholic', 'garden', $1::date, 'day') RETURNING event_id`,
        [day],
      );
      const eventId = ev.rows[0]!.event_id;
      await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, coupleUid]);
      const evr = await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
         SELECT $1, 'misc', 'x', 'shortlisted', vendor_profile_id, vendor_service_id FROM public.vendor_services WHERE vendor_service_id = $2
         RETURNING vendor_id`,
        [eventId, wholeDayCard],
      );
      await setAuthUid(db, coupleUid);
      const r = await db.query<{ out: { status: string } }>(`SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS out`, [
        eventId,
        evr.rows[0]!.vendor_id,
        [parishPool],
      ]);
      await setAuthUid(db, null);
      return r.rows[0]!.out.status;
    };
    assert.equal(await statusOn('2027-03-10'), 'blocked');
    assert.equal(await statusOn('2027-03-11'), 'blocked');
    assert.equal(await statusOn('2027-03-12'), 'ok', 'the day after its end is open');
  } finally {
    await setAuthUid(db, null);
    await db.exec('ROLLBACK');
  }
});

// ── 2 · THE COUPLE'S SIDE SAYS THE SAME ───────────────────────────────────

test('the bench search agrees: the Mass card is bookable on Sunday (3 PM is open), refused on Monday', async () => {
  const refused = await benchRefuses(massCard, [SUNDAY, MONDAY, TUESDAY]);
  assert.deepEqual([...refused].sort(), [MONDAY]);
});

test('the bench search refuses a Sunday when EVERY slot meets the morning', async () => {
  await db.exec('BEGIN');
  try {
    await db.query(`UPDATE public.vendor_service_time_slots SET is_active = FALSE WHERE slot_id = $1`, [slot15]);
    const refused = await benchRefuses(massCard, [SUNDAY, SATURDAY]);
    assert.deepEqual([...refused], [SUNDAY]);
  } finally {
    await db.exec('ROLLBACK');
  }
});

test('the bench search says the date-only card is free on Sunday and refused on Monday', async () => {
  const refused = await benchRefuses(wholeDayCard, [SUNDAY, MONDAY, TUESDAY]);
  assert.deepEqual([...refused], [MONDAY]);
});

test("the couple search's busy bit: Monday (all day) yes, Sunday (a morning) no", async () => {
  const busy = async (day: string) =>
    (await db.query(`SELECT * FROM public.vendors_blocked_on_date($1::uuid[], $2::date)`, [[parish], day])).rows.length > 0;
  assert.equal(await busy(MONDAY), true);
  assert.equal(await busy(SUNDAY), false);
  assert.equal(await busy(TUESDAY), false);
});

// ── 3 · ONE RULE, WRITTEN TWICE ────────────────────────────────────────────

test('the screens’ rule (lib/not-available.ts) and the database rule agree on every rule × day', async () => {
  const shapes: { repeat: RepeatRule; start: string; end: string; until: string | null }[] = [
    { repeat: 'once', start: '2027-03-05', end: '2027-03-09', until: null },
    { repeat: 'weekly', start: '2027-03-03', end: '2027-03-03', until: null },
    { repeat: 'weekly', start: '2027-03-07', end: '2027-03-07', until: '2027-03-21' },
    { repeat: 'weekend', start: '2027-03-06', end: '2027-03-06', until: null },
    { repeat: 'daily', start: '2027-03-04', end: '2027-03-04', until: '2027-03-12' },
  ];
  const days = Array.from({ length: 40 }, (_, i) => {
    const d = new Date(Date.UTC(2027, 1, 25 + i));
    return d.toISOString().slice(0, 10);
  });
  const differ: string[] = [];
  let covered = 0;
  for (const s of shapes) {
    for (const day of days) {
      const r = await db.query<{ on: boolean }>(
        `SELECT public.calendar_block_on_day(($1 || ' 00:00+08')::timestamptz, ($2 || ' 23:30+08')::timestamptz, $3, $4::date, $5::date) AS on`,
        [s.start, s.end, s.repeat, s.until, day],
      );
      const sql = r.rows[0]!.on;
      const ts = blockOnDay({ startDate: s.start, endDate: s.end, repeat: s.repeat, repeatUntil: s.until }, day);
      if (sql) covered += 1;
      if (sql !== ts) differ.push(`${s.repeat} ${s.start}..${s.until ?? s.end} on ${day}: sql ${sql} · ts ${ts}`);
    }
  }
  assert.deepEqual(differ, []);
  assert.ok(covered > 20 && covered < shapes.length * days.length - 20, `covered ${covered} — the grid lost its teeth`);
});

test('…and on every part of the day × time', async () => {
  const parts: DayPart[] = ['all_day', 'morning', 'afternoon', 'evening'];
  const times: [string | null, string | null][] = [
    [null, null],
    ['05:30', '06:00'],
    ['06:00', null],
    ['10:00', '11:00'],
    ['11:30', '12:30'],
    ['12:00', null],
    ['15:00', '16:00'],
    ['17:30', '18:00'],
    ['18:00', '21:00'],
    ['23:30', '24:00'],
    ['05:00', null],
  ];
  const differ: string[] = [];
  for (const p of parts) {
    for (const [s, e] of times) {
      const r = await db.query<{ m: boolean }>(`SELECT public.calendar_block_meets_time($1, $2::time, $3::time) AS m`, [p, s, e]);
      const sql = r.rows[0]!.m;
      const ts = dayPartMeetsTime(p, s, e);
      if (sql !== ts) differ.push(`${p} × ${s}–${e}: sql ${sql} · ts ${ts}`);
    }
  }
  assert.deepEqual(differ, []);
});

// ── 4 · WHAT THE TABLE REFUSES ─────────────────────────────────────────────

test('only a closure repeats or takes hours — an outside booking stays one-off, all day', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, repeat_rule)
       VALUES ($1, $2, '2027-03-07 00:00+08', '2027-03-07 23:30+08', 'Reyes', 'external_client', 'weekly')`,
      [parish, parishPool],
    ),
    /vendor_calendar_blocks_only_closures_repeat/,
  );
});

test('a time belongs to an outside booking only', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, blocked_at, blocked_until, block_label, block_source, client_time)
       VALUES ($1, '2027-03-07 00:00+08', '2027-03-07 23:30+08', 'Masses', 'manual', '10:00')`,
      [parish],
    ),
    /vendor_calendar_blocks_client_time_check/,
  );
});

test('an end date only on a repeat', async () => {
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_calendar_blocks (vendor_profile_id, blocked_at, blocked_until, block_label, block_source, repeat_until)
       VALUES ($1, '2027-03-07 00:00+08', '2027-03-07 23:30+08', 'Trip', 'manual', '2027-04-01')`,
      [parish],
    ),
    /vendor_calendar_blocks_repeat_until_check/,
  );
});

// ── 5 · A BOOKING FROM OUTSIDE HAS A TIME ─────────────────────────────────

test('import_external_client keeps the time, and still holds the day', async () => {
  const owner = await db.query<{ user_id: string }>(`SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [parish]);
  await db.exec('BEGIN');
  try {
    await setAuthUid(db, owner.rows[0]!.user_id);
    const r = await db.query<{ out: { status: string; block_id: string } }>(
      `SELECT public.import_external_client($1, $2, 'Dela Cruz', NULL, 'paid cash', '2027-03-20'::date, '2027-03-20'::date, '15:00'::time) AS out`,
      [parish, parishPool],
    );
    assert.equal(r.rows[0]!.out.status, 'ok');
    const row = await db.query<{ t: string; rule: string; part: string }>(
      `SELECT client_time::text AS t, repeat_rule AS rule, day_part AS part FROM public.vendor_calendar_blocks WHERE block_id = $1`,
      [r.rows[0]!.out.block_id],
    );
    assert.deepEqual(row.rows[0], { t: '15:00:00', rule: 'once', part: 'all_day' });
    // An older caller that names seven arguments still resolves (no time).
    const old = await db.query<{ out: { status: string } }>(
      `SELECT public.import_external_client(p_vendor_profile_id => $1, p_pool_id => $2, p_client_name => 'Santos',
              p_client_contact => NULL, p_client_note => NULL, p_start_date => '2027-03-21'::date, p_end_date => '2027-03-21'::date) AS out`,
      [parish, parishPool],
    );
    assert.equal(old.rows[0]!.out.status, 'ok');
  } finally {
    await setAuthUid(db, null);
    await db.exec('ROLLBACK');
  }
});

// ── 6 · REMOVING A REPEAT FREES EVERY DAY IT COVERED ──────────────────────

test('the freed log keeps the repeat of a removed block', async () => {
  await db.exec('BEGIN');
  try {
    const id = await block({ day: '2027-01-02', from: '18:00', to: '23:30', repeat: 'weekend', part: 'evening', label: 'Family' });
    await db.query(`DELETE FROM public.vendor_calendar_blocks WHERE block_id = $1`, [id]);
    const r = await db.query<{ rule: string; part: string }>(
      `SELECT repeat_rule AS rule, day_part AS part FROM public.vendor_availability_freed WHERE vendor_profile_id = $1 ORDER BY id DESC LIMIT 1`,
      [parish],
    );
    assert.deepEqual(r.rows[0], { rule: 'weekend', part: 'evening' });
  } finally {
    await db.exec('ROLLBACK');
  }
});

// ── 7 · THE LIVE DEFINITIONS STILL ASK THE RULE ───────────────────────────

test('every SQL gate on the table asks the rule (a later replacement that drops it fails here)', async () => {
  const defOf = async (sig: string) =>
    (await db.query<{ d: string }>(`SELECT pg_get_functiondef($1::regprocedure) AS d`, [sig])).rows[0]!.d;
  const gates: [string, string][] = [
    ['public.acquire_schedule_pools(uuid, uuid, uuid[])', 'calendar_block_on_day('],
    ['public.acquire_service_time_slot(uuid, uuid, uuid, uuid)', 'calendar_blocks_refuse_slot('],
    ['public.service_cards_unbookable_on(uuid[], date[], boolean)', 'calendar_block_on_day('],
    ['public.service_cards_unbookable_on(uuid[], date[], boolean)', 'calendar_blocks_refuse_slot('],
    ['public.vendors_blocked_on_date(uuid[], date)', 'calendar_block_on_day('],
  ];
  const missing = [];
  for (const [sig, needle] of gates) if (!(await defOf(sig)).includes(needle)) missing.push(`${sig} lost ${needle}`);
  assert.deepEqual(missing, []);
});
