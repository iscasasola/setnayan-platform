/**
 * A SUPPLIERS-ONLY DELEGATE READS NO BOOKING AMOUNT — #5936 · migration 20271341392450.
 *
 * Build 3 lane B round 4 (20271333705710) closed every chat / quote / amendment route to an amount for a
 * coordinator without Budget & payments, and left ONE route open for the owner: the five price columns on
 * `event_vendors`, the same row a Suppliers delegate must read to do the job. This proves the database now:
 *
 *   • signed in as a delegate with Suppliers but no Budget, a direct SELECT of any of the five columns is REFUSED,
 *     the row's other columns still read, and event_vendor_money_read() hands back the rows with every amount NULL
 *     and money_shown = FALSE;
 *   • a delegate WITH Budget & payments, and the host, read the real figures through the reader;
 *   • a stranger reads no row at all; the service role reads every figure;
 *   • every OTHER event_vendors column is still selectable by `authenticated` — a column added later must be granted.
 *
 * Run (from apps/web): tsx --test tests/db/a-suppliers-only-delegate-reads-no-booking-amount.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const MONEY = ['total_cost_php', 'deposit_paid_php', 'transport_php', 'food_allowance_php', 'pax_surcharge_php'] as const;

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
async function tryQ<T>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; refused: string | null }> {
  try {
    return { rows: await q<T>(sql, params), refused: null };
  } catch (e) {
    await db.exec('ROLLBACK').catch(() => {});
    return { rows: [], refused: (e as Error).message };
  }
}

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

test('a Suppliers-only delegate: every direct read of an amount is refused; the row still reads', async () => {
  const w = await newWorld();
  await as(w.suppliersOnly, 'authenticated', async () => {
    for (const col of MONEY) {
      const r = await tryQ(`SELECT ${col} FROM public.event_vendors WHERE vendor_id = $1`, [w.booking]);
      assert.match(r.refused ?? '', /permission denied/i, `${col} must be refused to a Suppliers-only delegate`);
    }
    const star = await tryQ(`SELECT * FROM public.event_vendors WHERE vendor_id = $1`, [w.booking]);
    assert.match(star.refused ?? '', /permission denied/i, 'SELECT * names the money columns, so it is refused too');
    const plain = await q<{ vendor_name: string; status: string }>(
      `SELECT vendor_name, status FROM public.event_vendors WHERE vendor_id = $1`, [w.booking]);
    assert.deepEqual(plain, [{ vendor_name: 'Lumina', status: 'contracted' }], 'the Suppliers job still reads the row');
  });
});

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

test('only the five amounts are closed — every other event_vendors column is still selectable by authenticated', async () => {
  const rows = await q<{ c: string }>(`
    SELECT column_name AS c FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND NOT has_column_privilege('authenticated', 'public.event_vendors', column_name, 'SELECT')
     ORDER BY 1`);
  assert.deepEqual(rows.map((r) => r.c), [...MONEY].sort(),
    'an event_vendors column is not selectable by authenticated — since 20271341392450 SELECT is granted per column; grant the new one');
  const anon = await q<{ c: string }>(`
    SELECT column_name AS c FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND has_column_privilege('anon', 'public.event_vendors', column_name, 'SELECT')
       AND column_name = ANY($1::text[])`, [[...MONEY]]);
  assert.deepEqual(anon, [], 'anon must not SELECT a booking amount either');
});
