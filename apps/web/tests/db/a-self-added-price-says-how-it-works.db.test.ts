/**
 * 🧾 A SUPPLIER THE COUPLE ADDS SAYS HOW ITS PRICE WORKS — migration 20271342032145, v2 (DECISION_LOG 2026-11-13,
 * "SELF-ADDED PRICE: THE COUPLE RECORDS WHAT WAS AGREED" · "PRICE BASIS v2 AGREED").
 *
 * Against the replayed migrations:
 *   · per guest carries its GUESTS AGREED in the shipped `pax_quote_base`; per hour its HOURS AGREED in `agreed_hours`;
 *     One price carries neither — the database refuses the mismatches;
 *   · the couple's numbers stay as typed: a guest joining the list, or a moment on the schedule, never moves the total;
 *   · a self-added booking priced per guest counts heads (the guest list's per-head row); a one-price one does not.
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
async function selfAdded(
  w: World,
  basis: 'per_pax' | 'per_hour' | null,
  total: number | null,
  counts: { guests?: number | null; hours?: number | null } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, pricing_basis, pax_quote_base, agreed_hours)
     VALUES ($1, 'catering'::public.vendor_category, 'Rosa''s Kitchen', 'considering', $2, $3, $4, $5) RETURNING vendor_id`,
    [w.eventId, total, basis, counts.guests ?? null, counts.hours ?? null],
  );
  return r.rows[0]!.vendor_id;
}

async function addGuests(w: World, n: number): Promise<void> {
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
     SELECT $1, 'Guest ' || i, 'Cruz', 'both', 'friends', 'attending'::public.rsvp_status
       FROM generate_series(1, $2::int) AS i`,
    [w.eventId, n],
  );
}

const row = async (vendorId: string) =>
  (
    await db.query<{ t: string | null; g: number | null; h: string | null }>(
      `SELECT total_cost_php::text AS t, pax_quote_base AS g, agreed_hours::text AS h FROM public.event_vendors WHERE vendor_id = $1`,
      [vendorId],
    )
  ).rows[0]!;
const perHead = async (vendorId: string) =>
  (await db.query<{ b: boolean }>(`SELECT public.event_vendor_counts_per_head($1) AS b`, [vendorId])).rows[0]!.b;

test('👥 a self-added supplier priced per guest counts heads — a one-price one does not', async () => {
  const w = await newWorld();
  const caterer = await selfAdded(w, 'per_pax', 162000, { guests: 120 });
  const band = await selfAdded(w, null, 60000);
  assert.equal(await perHead(caterer), true, 'per guest → on the per-head row');
  assert.equal(await perHead(band), false, 'One price → counts nobody');

  await addGuests(w, 3);
  const counts = (await db.query<{ c: { services: Array<{ id: string; counted: number }> } }>(
    `SELECT public.get_event_service_counts($1) AS c`,
    [w.eventId],
  )).rows[0]!.c;
  assert.deepEqual(counts.services.map((s) => s.id), [caterer]);
  assert.equal(counts.services[0]!.counted, 3);
});

test('🧾 what was agreed stays as typed — the guest list does not move a self-added total', async () => {
  const w = await newWorld();
  const caterer = await selfAdded(w, 'per_pax', 162000, { guests: 120 });
  const lights = await selfAdded(w, 'per_hour', 30000, { hours: 5 });
  await addGuests(w, 40);
  assert.deepEqual(await row(caterer), { t: '162000.00', g: 120, h: null });
  assert.deepEqual(await row(lights), { t: '30000.00', g: null, h: '5.00' });
});

test('🧱 each basis carries its own agreed count — the database refuses the mismatches', async () => {
  const w = await newWorld();
  await assert.rejects(selfAdded(w, 'per_hour', 30000), /agreed_hours_with_basis/, 'per hour with no hours agreed');
  await assert.rejects(selfAdded(w, 'per_hour', 30000, { hours: 0 }), /agreed_hours_with_basis/, 'zero hours is no hours');
  await assert.rejects(selfAdded(w, null, 30000, { hours: 5 }), /agreed_hours_with_basis/, 'hours only belong to per hour');
  await assert.rejects(selfAdded(w, 'per_pax', 162000, { hours: 5 }), /agreed_hours_with_basis/);
  await assert.rejects(selfAdded(w, 'per_pax', 162000), /per_pax_has_guests_agreed/, 'per guest with no guests agreed');
  await assert.rejects(
    db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, pricing_basis)
       VALUES ($1, 'catering'::public.vendor_category, 'X', 'considering', 'per_day')`,
      [w.eventId],
    ),
    /pricing_basis_check/,
  );
  // Half hours are kept to the column's scale.
  const v = await selfAdded(w, 'per_hour', 19500, { hours: 6.5 });
  assert.equal((await row(v)).h, '6.50');
});

test('🗑 the v1 rate machinery is gone — no rate column, no browser read of the schedule', async () => {
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND column_name IN ('pricing_rate_php', 'agreed_hours', 'pricing_basis')`,
  );
  assert.deepEqual(cols.rows.map((r) => r.column_name).sort(), ['agreed_hours', 'pricing_basis']);
  const fns = await db.query<{ proname: string }>(
    `SELECT proname FROM pg_proc WHERE proname IN ('get_self_added_price_terms', 'self_added_price_terms', 'self_added_price_follow')`,
  );
  assert.deepEqual(fns.rows, []);
});
