/**
 * 🪑 A BOOKED SUPPLIER SEES THE SEAT PLAN ON THE DAY, LIKE THE GUESTS DO
 * (supplier go-live audit E2, 2026-11-02 · migration 20271304542745_suppliers_see_seats_on_the_day).
 *
 * Owner 2026-09-30: "seatplan will show on the date of the event". The guests got that rule
 * (`guests_may_see_seats`); the two supplier readers kept asking the couple's "Show guests their seats early"
 * switch alone, so on the event day a booked caterer was told `not_published`.
 *
 * Against the replayed migrations, for a booked caterer on one event:
 *   1. before the day, switch off   → the seat plan answers `not_published`, the brief says not published;
 *   2. ON the day (Manila), switch off → the seat plan opens and the brief says published;
 *   3. before the day, switch on     → opens (the early switch still works).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let vendorUid = '';
let eventId = '';

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  vendorUid = await newUser('caterer@seats-on-the-day.test');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Day Plate Catering', 'Manila', ARRAY['catering']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorUid],
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Ana & Miguel', 'birthday', '2027-09-09'::date, 'day') RETURNING event_id`,
  );
  eventId = e.rows[0]!.event_id;
  // A drawn plan the couple never showed early.
  await db.query(`INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, NULL)`, [eventId]);
  await db.query(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order)
     VALUES ($1, 'Table 1', 'round_8', 8, 1)`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'catering'::public.vendor_category, 'Day Plate Catering', 'contracted'::public.vendor_status, $2)`,
    [eventId, v.rows[0]!.vendor_profile_id],
  );
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

async function setDay(sql: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db.query(`UPDATE public.events SET event_date = ${sql} WHERE event_id = $1`, [eventId]);
}

async function setEarly(on: boolean): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db.query(`UPDATE public.event_floor_plan SET published_at = ${on ? 'NOW()' : 'NULL'} WHERE event_id = $1`, [eventId]);
}

/** What the caterer sees: the seat plan's answer (or its error) and the brief's pill. */
async function asCaterer(): Promise<{ plan: 'opens' | string; briefPublished: unknown }> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, vendorUid);
  let plan = 'opens';
  try {
    const r = await db.query<{ p: { tables: unknown[] } }>(`SELECT public.get_vendor_seat_plan($1) AS p`, [eventId]);
    assert.equal(r.rows[0]!.p.tables.length, 1, 'the plan opens WITH its table — not an empty shell');
  } catch (err) {
    plan = String((err as Error).message);
  }
  const b = await db.query<{ b: { seat_plan: { published: unknown } } }>(
    `SELECT public.get_vendor_event_brief($1) AS b`,
    [eventId],
  );
  return { plan, briefPublished: b.rows[0]!.b.seat_plan.published };
}

const MANILA_TODAY = `(now() AT TIME ZONE 'Asia/Manila')::date`;

test('before the day, switch off → still closed to the supplier (no change)', async () => {
  await setDay(`${MANILA_TODAY} + 7`);
  await setEarly(false);
  const seen = await asCaterer();
  assert.match(seen.plan, /not_published/);
  assert.equal(seen.briefPublished, false);
});

test('ON the day (Manila), switch off → the supplier sees the plan, like every guest', async () => {
  await setDay(MANILA_TODAY);
  await setEarly(false);
  const seen = await asCaterer();
  assert.equal(seen.plan, 'opens', `on the day the caterer was refused: ${seen.plan}`);
  assert.equal(seen.briefPublished, true);
});

test('before the day, "Show guests their seats early" on → opens (the switch still works)', async () => {
  await setDay(`${MANILA_TODAY} + 7`);
  await setEarly(true);
  const seen = await asCaterer();
  assert.equal(seen.plan, 'opens');
  assert.equal(seen.briefPublished, true);
});
