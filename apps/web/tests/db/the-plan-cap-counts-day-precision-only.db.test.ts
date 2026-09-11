/**
 * THE PLAN CAP COUNTS DAY-PRECISION ONLY — a month-only couple never takes a
 * real day. FOLLOW-UPS A item 2 · migration 20271224170958.
 *
 * A month-only event stores the 1st of its month in `event_date`. The per-plan
 * customers-per-date ceiling counted it there, so a Free shop (ceiling 1)
 * chasing a month-only March couple REFUSED a real 1 March couple — replayed by
 * LOCK-PATH 2. The two counts beside it (service_card_bookings_on,
 * vendor_soft_holds_on) already say a month-only event is never a booking on the
 * 1st; this pins the third to the same rule, by behaviour, and then puts the old
 * count back to show the proof bites.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

const MIGRATION_FILE = '20271224170958_the_plan_cap_counts_day_precision_only.sql';
const MARCH_1 = '2027-03-01';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await db.query(`SET TIME ZONE 'UTC'`);
  await db.query(`UPDATE public.platform_settings SET vendor_tier_pipeline_caps_enabled = TRUE WHERE id = 1`);
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = (label: string) => `${label}-${++seq}`;

async function newFreeShop(): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`${uniq('free')}@precision.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  const vendorProfileId =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city)
         VALUES ($1, 'Precision Shop', 'Manila') RETURNING vendor_profile_id`,
        [userId],
      )
    ).rows[0]!.vendor_profile_id;
  await db.query(
    `UPDATE public.vendor_profiles
        SET services = ARRAY['photography']::text[], verification_state = 'verified',
            last_verified_at = NOW(), tier_state = 'free'
      WHERE vendor_profile_id = $1`,
    [vendorProfileId],
  );
  return { vendorProfileId, userId };
}

async function couple(precision: 'day' | 'month', date = MARCH_1): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', $2::date, $3) RETURNING event_id`,
    [uniq(`${precision}-couple`), date, precision],
  );
  return r.rows[0]!.event_id;
}

async function thread(vendorProfileId: string, eventId: string): Promise<string> {
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id) VALUES ($1, $2) RETURNING thread_id`,
    [eventId, vendorProfileId],
  );
  return t.rows[0]!.thread_id;
}

/** The shop accepts a couple's inquiry. Returns the refusal, or null. */
async function accept(threadId: string): Promise<string | null> {
  try {
    await db.query(
      `UPDATE public.chat_threads SET inquiry_status = 'accepted'::public.chat_inquiry_status WHERE thread_id = $1`,
      [threadId],
    );
    return null;
  } catch (e) {
    return String((e as Error).message);
  }
}

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

test('THE BUG · a month-only March couple being chased does NOT make a Free shop refuse a real 1 March couple', async () => {
  const shop = await newFreeShop();
  assert.equal(await accept(await thread(shop.vendorProfileId, await couple('month'))), null);
  assert.equal(
    await accept(await thread(shop.vendorProfileId, await couple('day'))),
    null,
    'the real 1 March couple is accepted',
  );
});

test('POSITIVE CONTROL · two real 1 March couples still hit the Free ceiling of 1', async () => {
  const shop = await newFreeShop();
  assert.equal(await accept(await thread(shop.vendorProfileId, await couple('day'))), null);
  assert.match(
    (await accept(await thread(shop.vendorProfileId, await couple('day')))) ?? '',
    /WHITELIST_DATE_LIMIT/,
    'the ceiling still binds on a real day',
  );
});

test('a month-only couple\'s own accept is never capped on its placeholder 1st', async () => {
  const shop = await newFreeShop();
  assert.equal(await accept(await thread(shop.vendorProfileId, await couple('day'))), null, 'the 1st is now full');
  assert.equal(
    await accept(await thread(shop.vendorProfileId, await couple('month'))),
    null,
    'a month-only couple is not competing for the 1st',
  );
});

test('the screen agrees with the trigger — no cap shown on a month-only thread, the real count on a day', async () => {
  const shop = await newFreeShop();
  const monthThread = await thread(shop.vendorProfileId, await couple('month'));
  await accept(monthThread);
  const dayThread = await thread(shop.vendorProfileId, await couple('day'));
  await accept(dayThread);
  const nextDay = await thread(shop.vendorProfileId, await couple('day'));

  await setAuthUid(db, shop.userId);
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE authenticated');
    const month = await db.query(`SELECT * FROM public.vendor_whitelist_pressure($1)`, [monthThread]);
    assert.equal(month.rows.length, 0, 'a month-only thread promises no per-date cap');
    const day = await db.query<{ used: number; cap: number }>(
      `SELECT used, cap FROM public.vendor_whitelist_pressure($1)`,
      [nextDay],
    );
    assert.deepEqual(
      { used: Number(day.rows[0]!.used), cap: Number(day.rows[0]!.cap) },
      { used: 1, cap: 1 },
      'the month-only couple is not in the count; the real 1 March couple is',
    );
  } finally {
    await db.exec('ROLLBACK');
    await setAuthUid(db, null);
  }
});

test('NEUTRALISATION · put the old count back and the real 1 March couple is refused again', async () => {
  const shop = await newFreeShop();
  assert.equal(await accept(await thread(shop.vendorProfileId, await couple('month'))), null);
  const def = (
    await db.query<{ d: string }>(
      `SELECT pg_get_functiondef('public.vendor_whitelist_used_for_date(uuid,date,uuid)'::regprocedure) AS d`,
    )
  ).rows[0]!.d;
  const line = "     AND e.event_date_precision = 'day'\n";
  assert.ok(def.includes(line), 'the live count no longer carries the day-precision line — re-derive this');
  await db.exec('BEGIN');
  try {
    await db.exec(def.replace(line, ''));
    const refused = await accept(await thread(shop.vendorProfileId, await couple('day')));
    assert.match(refused ?? '', /WHITELIST_DATE_LIMIT/, 'with the old count, the month-only couple takes the 1st');
  } finally {
    await db.exec('ROLLBACK');
  }
});
