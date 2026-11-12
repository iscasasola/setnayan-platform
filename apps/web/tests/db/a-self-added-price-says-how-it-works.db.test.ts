/**
 * 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — migration 20271342032145 (DECISION_LOG 2026-11-13,
 * "MANUAL SERVICE PRICE BASIS — PROTOTYPE APPROVED").
 *
 * Against the replayed migrations:
 *   · a self-added booking priced per guest now counts heads — it is on the guest list's per-head row
 *     (`event_vendor_counts_per_head` · `get_event_service_counts`) and "Not counted for ▾" may tick it;
 *   · its total follows the guest list on the pax-follow's own path (the guest-list triggers), up AND down;
 *   · per hour: hours come from that supplier's moments on the schedule (Arrive → Done); with no times, NO total is
 *     written — `total_cost_php` keeps what it held — and a Time-TBA moment has no time;
 *   · the couple's read gives numbers only, and a stranger is refused.
 *
 * Run (from apps/web): tsx --test tests/db/a-self-added-price-says-how-it-works.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

let seq = 0;
const uniq = () => `basis-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type World = { eventId: string; host: string };

async function newWorld(): Promise<World> {
  const host = await newUser();
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2027-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  return { eventId, host };
}

/** A supplier the couple added — no Setnayan shop, no service card. */
async function selfAdded(w: World, basis: 'per_pax' | 'per_hour' | null, rate: number | null, total: number | null = null): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, pricing_basis, pricing_rate_php)
     VALUES ($1, 'catering'::public.vendor_category, 'Rosa''s Kitchen', 'considering', $2, $3, $4) RETURNING vendor_id`,
    [w.eventId, total, basis, rate],
  );
  return r.rows[0]!.vendor_id;
}

async function addGuests(w: World, n: number, rsvp = 'attending'): Promise<string[]> {
  if (n <= 0) return [];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
     SELECT $1, 'Guest ' || i, 'Cruz', 'both', 'friends', $3::public.rsvp_status
       FROM generate_series(1, $2::int) AS i
     RETURNING guest_id`,
    [w.eventId, n, rsvp],
  );
  return r.rows.map((x) => x.guest_id);
}

async function moment(w: World, label: string, startIso: string, vendorIds: string[], extra: { tba?: boolean; parent?: string } = {}): Promise<string> {
  const r = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids, time_tba, parent_block_id, is_public)
     VALUES ($1, $2, $3::timestamptz, $4::uuid[], $5, $6, NOT $5) RETURNING block_id`,
    [w.eventId, label, startIso, `{${vendorIds.join(',')}}`, extra.tba ?? false, extra.parent ?? null],
  );
  return r.rows[0]!.block_id;
}

const total = async (vendorId: string) =>
  (await db.query<{ t: string | null }>(`SELECT total_cost_php::text AS t FROM public.event_vendors WHERE vendor_id = $1`, [vendorId])).rows[0]!.t;
const perHead = async (vendorId: string) =>
  (await db.query<{ b: boolean }>(`SELECT public.event_vendor_counts_per_head($1) AS b`, [vendorId])).rows[0]!.b;
const terms = async (w: World, vendorId: string | null) =>
  (await db.query<{ t: { counted: number; hours: number | string | null; arrive_at: string | null; done_at: string | null } }>(
    `SELECT public.self_added_price_terms($1, $2) AS t`,
    [w.eventId, vendorId],
  )).rows[0]!.t;

test('👥 a self-added supplier priced per guest counts heads — a one-price one does not', async () => {
  const w = await newWorld();
  const caterer = await selfAdded(w, 'per_pax', 1350);
  const band = await selfAdded(w, null, null, 60000);
  assert.equal(await perHead(caterer), true, 'per guest → on the per-head row');
  assert.equal(await perHead(band), false, 'One price → counts nobody');

  // …so it is on the guest list's Show & sort per-head row.
  await addGuests(w, 3);
  const counts = (await db.query<{ c: { services: Array<{ id: string; counted: number }> } }>(
    `SELECT public.get_event_service_counts($1) AS c`,
    [w.eventId],
  )).rows[0]!.c;
  assert.deepEqual(counts.services.map((s) => s.id), [caterer]);
  assert.equal(counts.services[0]!.counted, 3);
});

test('📈📉 per guest: the total is rate × the guests it counts, and follows the guest list up AND down', async () => {
  const w = await newWorld();
  const caterer = await selfAdded(w, 'per_pax', 1350);
  assert.equal(await total(caterer), null, 'nobody counted yet → no total, never ₱0');

  const ids = await addGuests(w, 120);
  assert.equal(Number(await total(caterer)), 162000, '₱1,350 × 120 = ₱162,000');
  assert.equal((await terms(w, caterer)).counted, 120);

  // A guest left out of THIS service (the "Not counted for ▾" tick) lowers it.
  await db.query(`INSERT INTO public.guest_not_counted_for (guest_id, event_vendor_id) VALUES ($1, $2)`, [ids[0], caterer]);
  assert.equal(Number(await total(caterer)), 1350 * 119);

  // A declined guest leaves the count.
  await db.query(`UPDATE public.guests SET rsvp_status = 'declined' WHERE guest_id = $1`, [ids[1]]);
  assert.equal(Number(await total(caterer)), 1350 * 118);

  await addGuests(w, 2);
  assert.equal(Number(await total(caterer)), 1350 * 120);
});

test('🕒 per hour: Arrive → Done on the schedule; no times → no total is written', async () => {
  const w = await newWorld();
  const lights = await selfAdded(w, 'per_hour', 6000, 25000);
  assert.equal((await terms(w, lights)).hours, null);
  assert.equal(Number(await total(lights)), 25000, 'no hours → the total stays what it was, never a guess');

  // One moment is not a span.
  await moment(w, 'Lights arrive', '2027-12-12T07:00:00Z', [lights]); // 3:00 PM Manila
  assert.equal((await terms(w, lights)).hours, null);
  assert.equal(Number(await total(lights)), 25000);

  // Arrive 3:00 PM · Done 8:00 PM → 5 hours → ₱30,000.
  const done = await moment(w, 'Lights is done', '2027-12-12T12:00:00Z', [lights]);
  assert.equal(Number((await terms(w, lights)).hours), 5);
  assert.equal(Number(await total(lights)), 30000);

  // A Time-TBA chapter has no time — it never stretches the span.
  await moment(w, 'Maybe later', '2027-12-12T15:00:00Z', [lights], { tba: true });
  assert.equal(Number(await total(lights)), 30000);

  // The schedule moves → the total follows (the per-hour twin).
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = '2027-12-12T13:30:00Z' WHERE block_id = $1`, [done]);
  assert.equal(Number(await total(lights)), 6000 * 6.5);

  // Their times are removed → back to no hours; the last total stays (nothing guessed, nothing zeroed).
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1`, [done]);
  assert.equal((await terms(w, lights)).hours, null);
  assert.equal(Number(await total(lights)), 6000 * 6.5);
});

test('🔢 a supplier not added yet: the whole count, and no hours', async () => {
  const w = await newWorld();
  await addGuests(w, 7);
  await addGuests(w, 2, 'declined');
  const t = await terms(w, null);
  assert.equal(t.counted, 7);
  assert.equal(t.hours, null);
});

test('🧱 the basis and the rate travel together; a Setnayan shop’s booking is never repriced here', async () => {
  const w = await newWorld();
  await assert.rejects(selfAdded(w, 'per_pax', null), /pricing_rate_with_basis/);
  await assert.rejects(selfAdded(w, null, 500), /pricing_rate_with_basis/);
  await assert.rejects(selfAdded(w, 'per_pax', 0), /pricing_rate_with_basis/);
  await assert.rejects(
    db.query(`INSERT INTO public.event_vendors (event_id, category, vendor_name, status, pricing_basis, pricing_rate_php)
              VALUES ($1, 'catering', 'X', 'considering', 'per_day', 10)`, [w.eventId]),
    /pricing_basis_check/,
  );
});

test('🔒 the couple reads numbers; a stranger is refused; the follow is not a browser door', async () => {
  const w = await newWorld();
  const caterer = await selfAdded(w, 'per_pax', 1350);
  await addGuests(w, 4);

  await setAuthUid(db, w.host);
  await db.exec('SET ROLE authenticated');
  const mine = (await db.query<{ t: { counted: number } }>(`SELECT public.get_self_added_price_terms($1, $2) AS t`, [w.eventId, caterer])).rows[0]!.t;
  assert.equal(mine.counted, 4);
  assert.deepEqual(Object.keys(mine).sort(), ['arrive_at', 'counted', 'done_at', 'hours'], 'numbers and times only — never a guest');
  await assert.rejects(db.query(`SELECT public.self_added_price_terms($1, $2)`, [w.eventId, caterer]), /permission denied/);
  await assert.rejects(db.query(`SELECT public.self_added_price_follow($1)`, [w.eventId]), /permission denied/);
  await db.exec('RESET ROLE');

  const other = await newWorld();
  const stranger = await newUser();
  await setAuthUid(db, stranger);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(db.query(`SELECT public.get_self_added_price_terms($1, NULL)`, [w.eventId]), /not_allowed/);
  await db.exec('RESET ROLE');

  // A booking from another event is refused, never answered as "0 counted".
  await setAuthUid(db, w.host);
  await db.exec('SET ROLE authenticated');
  const elsewhere = await (async () => {
    await db.exec('RESET ROLE');
    const id = await selfAdded(other, 'per_pax', 100);
    await db.exec('SET ROLE authenticated');
    return id;
  })();
  await assert.rejects(db.query(`SELECT public.get_self_added_price_terms($1, $2)`, [w.eventId, elsewhere]), /not on this event/);
  await db.exec('RESET ROLE');
});
