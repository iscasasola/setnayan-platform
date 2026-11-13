/**
 * A SUPPLIERS-ONLY DELEGATE READS NO BOOKING AMOUNT — #5936 · migration 20271341392450.
 *
 * Build 3 lane B round 4 (20271333705710) closed every chat / quote / amendment route to an amount for a
 * coordinator without Budget & payments, and left ONE route open for the owner: the five price columns on
 * `event_vendors`, the same row a Suppliers delegate must read to do the job. This proves the database now:
 *
 *   • signed in as a delegate with Suppliers but no Budget, event_vendor_money_read() hands back the rows with every
 *     amount NULL and money_shown = FALSE;
 *   • a delegate WITH Budget & payments, and the host, read the real figures through the reader;
 *   • a stranger reads no row at all; the service role reads every figure;
 *   • the readers are purely ADDITIVE — migration 20271341392450 closes no column, so the build still serving when
 *     `db push` runs keeps working. The per-column close is migration B, a separate follow-up PR (controller audit
 *     on PR #7560), and that PR flips the last test here into "every direct read of an amount is refused".
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

test('the readers close nothing — the build still serving when db push runs keeps every column it selects', async () => {
  // Migration A of two (controller audit on PR #7560): deploy-prod applies migrations BEFORE the new build serves,
  // so a column close here would refuse the old build's selects. The close is migration B, in its own PR.
  const closed = await q<{ c: string }>(`
    SELECT column_name AS c FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_vendors'
       AND NOT has_column_privilege('authenticated', 'public.event_vendors', column_name, 'SELECT')
     ORDER BY 1`);
  assert.deepEqual(closed, [], 'a column was closed in migration A — that is migration B, after prod serves the readers');
  const fns = await q<{ f: string; ok: boolean }>(`
    SELECT f, has_function_privilege('authenticated', f, 'EXECUTE') AS ok
      FROM unnest(ARRAY['public.event_vendor_money_read(uuid)', 'public.event_vendor_money_event_ids()']) f`);
  assert.deepEqual(fns.map((r) => r.ok), [true, true], 'authenticated must be able to call both readers');
  const anon = await q<{ ok: boolean }>(
    `SELECT has_function_privilege('anon', 'public.event_vendor_money_read(uuid)', 'EXECUTE') AS ok`);
  assert.equal(anon[0]!.ok, false, 'anon must not call the money reader');
});
