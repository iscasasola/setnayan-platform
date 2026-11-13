/**
 * A SUPPLIERS-ONLY DELEGATE READS NO BOOKING AMOUNT — #5936 · migrations 20271342818285 (A) + 20271343340931 (B).
 *
 * Build 3 lane B round 4 (20271333705710) closed every chat / quote / amendment route to an amount for a
 * coordinator without Budget & payments, and left ONE route open for the owner: the five price columns on
 * `event_vendors`, the same row a Suppliers delegate must read to do the job. This proves the database now:
 *
 *   • signed in as a delegate with Suppliers but no Budget, event_vendor_money_read() hands back the rows with every
 *     amount NULL and money_shown = FALSE;
 *   • a delegate WITH Budget & payments, and the host, read the real figures through the reader;
 *   • a stranger reads no row at all; the service role reads every figure;
 *   • since migration B (20271343340931) every direct browser read of an amount — select, filter or `*` — is
 *     refused for every seat, the host included; the row itself, the readers and the service role are unaffected,
 *     and a session write of a typed price still lands (migration B closes reads only).
 *
 * Run (from apps/web): tsx --test tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts
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
beforeEach(reset);

async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string | null, role: 'authenticated' | 'service_role', fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  if (role === 'authenticated') await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
const q = <T>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);

let seq = 0;
async function newUser(): Promise<string> {
  return (await q<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`money5936-${++seq}@test.local`]))[0]!.id;
}

type World = { eventId: string; host: string; suppliersOnly: string; withBudget: string; stranger: string; booking: string };
async function newWorld(): Promise<World> {
  const [host, suppliersOnly, withBudget, stranger] = [await newUser(), await newUser(), await newUser(), await newUser()];
  const eventId = (await q<{ e: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id AS e`))[0]!.e;
  await q(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host]);
  await q(`INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
           VALUES ($1, $2, 'wedding_planner_external', $4::jsonb, NOW()),
                  ($1, $3, 'wedding_planner_external', $5::jsonb, NOW())`,
    [eventId, suppliersOnly, withBudget,
     JSON.stringify({ areas: { vendors: 'edit' } }),
     JSON.stringify({ areas: { vendors: 'edit', budget: 'view' } })]);
  const booking = (await q<{ v: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, deposit_paid_php,
                                       transport_php, food_allowance_php, pax_surcharge_php)
     VALUES ($1, 'photographer', 'Lumina', 'contracted', 99000, 20000, 1500, 800, 3000) RETURNING vendor_id AS v`,
    [eventId]))[0]!.v;
  return { eventId, host, suppliersOnly, withBudget, stranger, booking };
}

type MoneyRow = {
  vendor_id: string; total_cost_php: string | null; deposit_paid_php: string | null; transport_php: string | null;
  food_allowance_php: string | null; pax_surcharge_php: number | null; money_shown: boolean;
};
const readMoney = (w: World) =>
  q<MoneyRow>(`SELECT vendor_id, total_cost_php::text, deposit_paid_php::text, transport_php::text,
                      food_allowance_php::text, pax_surcharge_php, money_shown
                 FROM public.event_vendor_money_read($1)`, [w.eventId]);

test('a Suppliers-only delegate: the reader hands back the row with every amount hidden — never ₱0', async () => {
  const w = await newWorld();
  const rows = await as(w.suppliersOnly, 'authenticated', () => readMoney(w));
  assert.deepEqual(rows, [{
    vendor_id: w.booking, total_cost_php: null, deposit_paid_php: null, transport_php: null,
    food_allowance_php: null, pax_surcharge_php: null, money_shown: false,
  }]);
});

test('a delegate WITH Budget & payments, and the host, read the real figures', async () => {
  const w = await newWorld();
  for (const uid of [w.withBudget, w.host]) {
    const rows = await as(uid, 'authenticated', () => readMoney(w));
    assert.deepEqual(rows, [{
      vendor_id: w.booking, total_cost_php: '99000.00', deposit_paid_php: '20000.00', transport_php: '1500.00',
      food_allowance_php: '800.00', pax_surcharge_php: 3000, money_shown: true,
    }]);
  }
});

test('a stranger reads no row; the service role reads every figure', async () => {
  const w = await newWorld();
  assert.deepEqual(await as(w.stranger, 'authenticated', () => readMoney(w)), []);
  const svc = await as(null, 'service_role', () => readMoney(w));
  assert.equal(svc.length, 1);
  assert.equal(svc[0]!.total_cost_php, '99000.00');
  assert.equal(svc[0]!.money_shown, true);
});

const MONEY = ['total_cost_php', 'deposit_paid_php', 'transport_php', 'food_allowance_php', 'pax_surcharge_php'];

test('migration B (20271343340931): every direct read of an amount is refused on a browser session — host included', async () => {
  const w = await newWorld();
  for (const uid of [w.suppliersOnly, w.withBudget, w.host]) {
    for (const col of MONEY) {
      await assert.rejects(
        as(uid, 'authenticated', () => q(`SELECT ${col} FROM public.event_vendors WHERE vendor_id = $1`, [w.booking])),
        /permission denied/,
        `${col} is still selectable on a browser session`,
      );
      // A filter names the column too — Postgres checks it exactly as for the select list.
      await assert.rejects(
        as(uid, 'authenticated', () => q(`SELECT vendor_id FROM public.event_vendors WHERE ${col} > 0`)),
        /permission denied/,
        `${col} is still usable in a WHERE on a browser session`,
      );
    }
    // select * is refused outright, never silently trimmed.
    await assert.rejects(
      as(uid, 'authenticated', () => q(`SELECT * FROM public.event_vendors WHERE vendor_id = $1`, [w.booking])),
      /permission denied/,
    );
  }
});

test('migration B: the row itself still reads, the readers still fill the amounts, the service role reads every column', async () => {
  const w = await newWorld();
  // POSITIVE CONTROL — the same seats, the same row, without an amount: the denial above is the column, not the row.
  for (const uid of [w.suppliersOnly, w.host]) {
    const rows = await as(uid, 'authenticated', () =>
      q<{ vendor_id: string; status: string }>(`SELECT vendor_id, status FROM public.event_vendors WHERE vendor_id = $1`, [w.booking]));
    assert.deepEqual(rows, [{ vendor_id: w.booking, status: 'contracted' }]);
  }
  // The definer reader still reads the closed columns (it runs as its owner).
  const hostMoney = await as(w.host, 'authenticated', () => readMoney(w));
  assert.equal(hostMoney[0]!.total_cost_php, '99000.00');
  assert.equal(hostMoney[0]!.money_shown, true);
  // DIFFERENTIAL CONTROL — the very statement refused above succeeds for the service role.
  await db.exec(`SET ROLE service_role`);
  try {
    const svc = await q<{ total_cost_php: string }>(
      `SELECT total_cost_php::text FROM public.event_vendors WHERE vendor_id = $1`, [w.booking]);
    assert.deepEqual(svc, [{ total_cost_php: '99000.00' }]);
  } finally {
    await reset();
  }
});

test('migration B closes reads only: a host still writes a typed price on their session, returning vendor_id', async () => {
  // The session writers (vendors/actions.ts, chat-lock-booking.server.ts, …) write a price and read back vendor_id
  // only; lib/booking-cost-write.ts decides which amounts a caller may write.
  const w = await newWorld();
  const rows = await as(w.host, 'authenticated', () =>
    q<{ vendor_id: string }>(`UPDATE public.event_vendors SET transport_php = 1800 WHERE vendor_id = $1 RETURNING vendor_id`, [w.booking]));
  assert.deepEqual(rows, [{ vendor_id: w.booking }]);
  const after = await as(null, 'service_role', () => readMoney(w));
  assert.equal(after[0]!.transport_php, '1800.00');
});

test('every OTHER event_vendors column stays SELECT-able by anon and authenticated (a new column must be granted)', async () => {
  // Since migration B the browser roles hold SELECT per column, so a column added later is NOT readable until a
  // migration grants it. If this fails, add to that migration:
  //   GRANT SELECT (<new_column>) ON public.event_vendors TO anon, authenticated;
  // — unless the column is an amount, in which case add it to the reader instead and to the list below.
  const ungranted = await q<{ r: string; c: string }>(`
    SELECT r, c.column_name AS c
      FROM information_schema.columns c, unnest(ARRAY['anon', 'authenticated']) r
     WHERE c.table_schema = 'public' AND c.table_name = 'event_vendors'
       AND c.column_name <> ALL ($1::text[])
       AND NOT has_column_privilege(r, 'public.event_vendors', c.column_name, 'SELECT')
     ORDER BY 1, 2`, [MONEY]);
  assert.deepEqual(ungranted, [], 'these event_vendors columns are not browser-selectable — grant them in the migration that added them');
  const open = await q<{ r: string; c: string }>(`
    SELECT r, c FROM unnest($1::text[]) c, unnest(ARRAY['anon', 'authenticated']) r
     WHERE has_column_privilege(r, 'public.event_vendors', c, 'SELECT')`, [MONEY]);
  assert.deepEqual(open, [], 'a later migration handed a booking amount back to a browser role');
  const fns = await q<{ ok: boolean }>(`
    SELECT has_function_privilege('authenticated', f, 'EXECUTE') AS ok
      FROM unnest(ARRAY['public.event_vendor_money_read(uuid)', 'public.event_vendor_money_event_ids()']) f`);
  assert.deepEqual(fns.map((r) => r.ok), [true, true], 'authenticated must be able to call both readers');
  const anon = await q<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', 'public.event_vendor_money_read(uuid)', 'EXECUTE') AS ok`);
  assert.equal(anon[0]!.ok, false, 'anon must not call the money reader');
});
