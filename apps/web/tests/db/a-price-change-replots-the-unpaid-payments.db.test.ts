/**
 * AN ACCEPTED PRICE CHANGE ALWAYS RE-PLOTS THE UNPAID PAYMENTS — proved against the replayed database.
 *
 * Owner, 2026-10-29: *"Re-split payments after a price change? yes. allow this. replot the payments always."*
 * Migration `a_price_change_replots_the_unpaid_payments`:
 *
 *   1 · THE TWIN. `plan_replot_instances` (SQL) and `replotInstances` (`lib/plan-replot.ts`, what the record card runs
 *       live) give the SAME plan for the same input — so the screen never previews a split the database does not make.
 *   2 · An accepted CHANGE LINE re-plots: the paid instalment is untouched, the unpaid ones add up to the new total.
 *   3 · A couple re-pricing a supplier THEY ADDED re-plots the same way.
 *   4 · The plan before is KEPT (`replot_history`), never overwritten — what "Price changed ₱A → ₱B" reads.
 *   5 · A payment the supplier REFUSED does not hold its instalment.
 *
 * Landings are asserted by reading the row back, never from RETURNING.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { replotInstances, type ReplotInstance } from '../../lib/plan-replot';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});
after(async () => {
  await replay?.db.close();
});

const inst = (seq: number, amount: number, kind: 'percent' | 'fixed' = 'fixed', bps: number | null = null, authored?: ReplotInstance['authored']): ReplotInstance => ({
  seq,
  label: `Payment ${seq + 1}`,
  amount_php: amount,
  due_date: `2027-0${seq + 1}-15`,
  amount_kind: kind,
  percent_bps: bps,
  ...(authored ? { authored } : {}),
});

/** Numbers compared as numbers (JSON `37400.00` and `37400` are the same peso). */
const norm = (xs: unknown) => JSON.parse(JSON.stringify(xs), (_k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));

async function sqlReplot(instances: ReplotInstance[], settled: number[], total: number) {
  const r = await db.query<{ out: unknown }>(`SELECT public.plan_replot_instances($1::jsonb, $2::int[], $3::numeric) AS out`, [
    JSON.stringify(instances),
    `{${settled.join(',')}}`,
    total,
  ]);
  return r.rows[0]!.out;
}

test('1 · the database twin gives the same plan as the card, case for case', async () => {
  const authored = (v: string, a = 'on_lock') => ({ amount_kind: 'percent' as const, value: v, due_anchor: a, due_offset_days: '0' });
  const cases: Array<[string, ReplotInstance[], number[], number]> = [
    ['+20% on 50/50, nothing paid', [inst(0, 50_000, 'percent', 5000), inst(1, 50_000, 'percent', 5000)], [], 120_000],
    ['+₱20,000 with the first paid', [inst(0, 50_000), inst(1, 50_000)], [0], 120_000],
    ['thirds of ₱100,000', [inst(0, 1), inst(1, 1), inst(2, 1)], [], 100_000],
    ['centavos land on the last', [inst(0, 30_000), inst(1, 30_000), inst(2, 40_000)], [2], 80_000.5],
    ['all paid, price up → Balance', [inst(0, 50_000), inst(1, 50_000, 'fixed', null, authored('50', 'before_event'))], [0, 1], 115_000],
    ['price under what is paid', [inst(0, 60_000), inst(1, 40_000)], [0], 55_000],
    ['percent made untrue by a payment', [inst(0, 50_000, 'percent', 5000, authored('50')), inst(1, 50_000, 'percent', 5000, authored('50', 'before_event'))], [0], 120_000],
    ['already adds up', [inst(0, 50_000), inst(1, 50_000)], [], 100_000],
  ];
  for (const [name, plan, settled, total] of cases) {
    const ts = replotInstances(plan, settled, total).instances;
    const sql = await sqlReplot(plan, settled, total);
    assert.deepEqual(norm(sql), norm(ts), `the twins disagree on "${name}"`);
  }
  console.log(`# twin cases: ${cases.length}`);
});

async function seed(tag: string, total = 100_000): Promise<{ eventId: string; vendorId: string }> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', '2027-03-01'::date, 'day') RETURNING event_id`,
    [`Replot ${tag}`],
  );
  const eventId = e.rows[0]!.event_id;
  const v = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, 'reception_decor', 'Sample Styling Co', 'considering', $2) RETURNING vendor_id`,
    [eventId, total],
  );
  const vendorId = v.rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json, is_default_seeded)
     VALUES ($1, $2, $3::jsonb, false)`,
    [eventId, vendorId, JSON.stringify([inst(0, 50_000), inst(1, 50_000)])],
  );
  return { eventId, vendorId };
}

async function planOf(vendorId: string) {
  const r = await db.query<{ instances_json: ReplotInstance[]; replot_history: Array<{ from_php: number; to_php: number; source: string; instances: ReplotInstance[] }> }>(
    `SELECT instances_json, replot_history FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!;
}

async function pay(eventId: string, vendorId: string, seq: number, amount: number, refused = false) {
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, schedule_instance_seq, payment_refused_at)
     VALUES ($1, $2, $3, $4, ${refused ? 'now()' : 'NULL'})`,
    [eventId, vendorId, amount, seq],
  );
}

test('2 + 4 · an accepted change line re-plots the unpaid instalment and keeps the old plan', async () => {
  const { eventId, vendorId } = await seed('change');
  await pay(eventId, vendorId, 0, 50_000);
  await db.query(
    `INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php, is_change_delta)
     VALUES ($1, $2, 'Changes you both agreed', 20000, TRUE)`,
    [eventId, vendorId],
  );
  const p = await planOf(vendorId);
  assert.deepEqual(p.instances_json.map((i) => [i.seq, Number(i.amount_php)]), [
    [0, 50_000],
    [1, 70_000],
  ], 'the unpaid instalment did not take the change (or the paid one moved)');
  assert.equal(p.replot_history.length, 1, 'the plan before was not kept');
  assert.equal(Number(p.replot_history[0]!.from_php), 100_000);
  assert.equal(Number(p.replot_history[0]!.to_php), 120_000);
  assert.equal(p.replot_history[0]!.source, 'change');
  assert.deepEqual(p.replot_history[0]!.instances.map((i) => Number(i.amount_php)), [50_000, 50_000]);
});

test('3 · a couple re-pricing a supplier they added re-plots too', async () => {
  const { vendorId } = await seed('price');
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 150000 WHERE vendor_id = $1`, [vendorId]);
  const p = await planOf(vendorId);
  assert.deepEqual(p.instances_json.map((i) => Number(i.amount_php)), [75_000, 75_000]);
  assert.equal(p.replot_history.at(-1)!.source, 'price');
});

test('3b · a supplier with a Setnayan shop is NOT re-plotted on a headline write — only on a change line', async () => {
  const { vendorId } = await seed('shop');
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('replot-shop@example.com', jsonb_build_object('account_type','customer')) RETURNING id`,
  );
  const shop = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Replot Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  await db.query(`UPDATE public.event_vendors SET marketplace_vendor_id = $2 WHERE vendor_id = $1`, [vendorId, shop.rows[0]!.vendor_profile_id]);
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 150000 WHERE vendor_id = $1`, [vendorId]);
  const p = await planOf(vendorId);
  assert.deepEqual(p.instances_json.map((i) => Number(i.amount_php)), [50_000, 50_000]);
  assert.equal(p.replot_history.length, 0);
});

test('5 · a payment the supplier refused does not hold its instalment', async () => {
  const { eventId, vendorId } = await seed('refused');
  await pay(eventId, vendorId, 0, 50_000, true);
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 80000 WHERE vendor_id = $1`, [vendorId]);
  const p = await planOf(vendorId);
  assert.deepEqual(p.instances_json.map((i) => Number(i.amount_php)), [40_000, 40_000]);
});

test('the couple cannot call the re-plot themselves', async () => {
  const { vendorId } = await seed('direct');
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(db.query(`SELECT public.plan_replot_for_booking($1, 'price')`, [vendorId]));
  await db.exec('RESET ROLE');
});
