/**
 * PAYDAY READS THE DEPOSIT AND THE BALANCE — AREA-VENDOR · migration 20271233896417.
 *
 * 🔴 The owner, as the supplier Saysay (2026-09-18): the Today page said
 * "Confirmed cash-flow · No booked installments yet." for a shop that had just
 * confirmed a ₱2,000 deposit on a contracted ₱10,170 booking. The function under
 * that tile, `vendor_payday_installments()`, read only the frozen installment
 * plan — and production has never held one. Every supplier's cash-flow tile,
 * "Ongoing payments" and /payday were empty, and empty read as "none yet".
 *
 * Asserted BY BEHAVIOUR against the replayed schema, as the supplier, under the
 * real `authenticated` role, and then through the SAME `buildPaydayTimeline`
 * the Today tile renders from — so the number the owner saw is the number
 * checked here.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { buildPaydayTimeline, type PaydayInstallmentRow } from '../../lib/vendor-cashflow';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271233896417_payday_reads_the_deposit_and_the_balance.sql';
const DEPOSIT_NOTE = 'Deposit (date held · awaiting vendor confirmation)';
const TODAY = '2026-09-19';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let n = 0;
const uniq = () => `payday-${++n}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type Booking = { eventId: string; eventVendorId: string; supplier: string; couple: string };

async function newBooking(opts: { status?: string; total?: number | null; supplier?: string } = {}): Promise<Booking> {
  const supplier = opts.supplier ?? (await newUser());
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Saysay Test Band', 'Manila', ARRAY['band_dj']::text[], 'verified', NOW())
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [supplier],
  );
  const couple = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Rosa & Ben', 'birthday', DATE '2026-10-30') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, couple],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'band_dj','Saysay Test Band',$2::vendor_status,$3,$4) RETURNING vendor_id`,
    [eventId, opts.status ?? 'contracted', v.rows[0]!.vendor_profile_id, opts.total === undefined ? 10170 : opts.total],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id, supplier, couple };
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<{ value?: T; error?: string }> {
  await setAuthUid(db, uid);
  await db.exec(`BEGIN`);
  try {
    await db.exec(`SET LOCAL ROLE authenticated`);
    const value = await fn();
    await db.exec(`COMMIT`);
    return { value };
  } catch (e) {
    await db.exec(`ROLLBACK`);
    return { error: (e as Error).message };
  } finally {
    await setAuthUid(db, null);
  }
}

async function coupleRecordsDeposit(b: Booking, amount = 2000): Promise<string> {
  const r = await as(b.couple, async () => {
    await db.query(
      `UPDATE public.event_vendors SET deposit_recorded_at = NOW(), deposit_method_label = 'GCash'
        WHERE vendor_id = $1`,
      [b.eventVendorId],
    );
    const p = await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes, paid_at)
       VALUES ($1,$2,$3,'GCash',$4, DATE '2026-09-18') RETURNING payment_id`,
      [b.eventId, b.eventVendorId, amount, DEPOSIT_NOTE],
    );
    return p.rows[0]!.payment_id;
  });
  assert.equal(r.error, undefined, `seed failed: ${r.error}`);
  return r.value!;
}

async function coupleLogsPayment(b: Booking, amount: number): Promise<string> {
  const r = await as(b.couple, async () => {
    const p = await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes, paid_at)
       VALUES ($1,$2,$3,'BPI transfer','Second payment', DATE '2026-09-18') RETURNING payment_id`,
      [b.eventId, b.eventVendorId, amount],
    );
    return p.rows[0]!.payment_id;
  });
  assert.equal(r.error, undefined, `seed failed: ${r.error}`);
  return r.value!;
}

async function supplierConfirms(b: Booking, paymentId: string): Promise<void> {
  const r = await as(b.supplier, () => db.query(`SELECT public.confirm_vendor_payment($1)`, [paymentId]));
  assert.equal(r.error, undefined, `confirm failed: ${r.error}`);
}

async function payday(uid: string): Promise<PaydayInstallmentRow[]> {
  const r = await as(uid, async () =>
    (
      await db.query<PaydayInstallmentRow & { amount_php: string | null; event_date: string | Date | null; due_date: string | Date | null }>(
        `SELECT event_vendor_id, event_id, event_name, event_date::text AS event_date, seq, label,
                amount_php::text AS amount_php, due_date::text AS due_date, confirmed
           FROM public.vendor_payday_installments()`,
      )
    ).rows,
  );
  assert.equal(r.error, undefined, `payday read failed: ${r.error}`);
  return r.value!.map((row) => ({
    ...row,
    amount_php: row.amount_php == null ? null : Number(row.amount_php),
  })) as PaydayInstallmentRow[];
}

const forBooking = (rows: PaydayInstallmentRow[], b: Booking) =>
  rows.filter((r) => r.event_vendor_id === b.eventVendorId);

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

test('THE OWNER’S CASE — a confirmed ₱2,000 deposit on a ₱10,170 booking reaches the cash-flow tile', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b, 2000);
  await supplierConfirms(b, dep);

  const rows = forBooking(await payday(b.supplier), b);
  const deposit = rows.find((r) => r.label === 'Deposit');
  const balance = rows.find((r) => r.label === 'Balance');
  assert.ok(deposit, `no Deposit row: ${JSON.stringify(rows)}`);
  assert.equal(deposit.amount_php, 2000);
  assert.equal(deposit.confirmed, true);
  assert.ok(balance, `no Balance row: ${JSON.stringify(rows)}`);
  assert.equal(balance.amount_php, 8170);
  assert.equal(balance.confirmed, false);
  assert.equal(balance.due_date, null, 'nobody agreed a balance due date — none may be invented');

  // Through the very function the Today tile renders from.
  const totals = buildPaydayTimeline(rows, TODAY).totals;
  assert.equal(totals.confirmedPhp, 2000);
  assert.equal(totals.expectedPhp, 10170);
  assert.equal(totals.overdueCount, 0);
});

test('a deposit sent but not yet confirmed is shown as awaiting — never as received, never as overdue', async () => {
  const b = await newBooking();
  await coupleRecordsDeposit(b, 2000);
  const rows = forBooking(await payday(b.supplier), b);
  const deposit = rows.find((r) => r.label.startsWith('Deposit'));
  assert.ok(deposit, `no deposit row: ${JSON.stringify(rows)}`);
  assert.equal(deposit.confirmed, false);
  assert.match(deposit.label, /awaiting your confirmation/);
  const totals = buildPaydayTimeline(rows, TODAY).totals;
  assert.equal(totals.confirmedPhp, 0);
  assert.equal(totals.expectedPhp, 10170);
  assert.equal(totals.overdueCount, 0, 'a payment already made cannot be overdue');
});

test('a refused payment is not money received', async () => {
  const b = await newBooking();
  const p = await coupleLogsPayment(b, 3000);
  const refused = await as(b.supplier, () =>
    db.query(`SELECT public.refuse_vendor_payment($1, $2)`, [p, 'Never arrived']),
  );
  assert.equal(refused.error, undefined, `refuse failed: ${refused.error}`);
  const rows = forBooking(await payday(b.supplier), b);
  assert.equal(rows.filter((r) => r.label.startsWith('Payment')).length, 0, JSON.stringify(rows));
  assert.equal(rows.find((r) => r.label === 'Balance')?.amount_php, 10170);
});

test('a card still being considered is not a booking — no rows', async () => {
  const b = await newBooking({ status: 'considering' });
  assert.deepEqual(forBooking(await payday(b.supplier), b), []);
});

test('an empty [] plan (direct-pay) does not hide the money that was logged', async () => {
  const b = await newBooking();
  await db.query(
    `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json)
     VALUES ($1,$2,'[]'::jsonb)`,
    [b.eventId, b.eventVendorId],
  );
  const dep = await coupleRecordsDeposit(b, 2000);
  await supplierConfirms(b, dep);
  const totals = buildPaydayTimeline(forBooking(await payday(b.supplier), b), TODAY).totals;
  assert.equal(totals.confirmedPhp, 2000);
  assert.equal(totals.expectedPhp, 10170);
});

test('a real installment plan still wins — the ledger arm does not double-count it', async () => {
  const b = await newBooking();
  await db.query(
    `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json)
     VALUES ($1,$2,$3::jsonb)`,
    [
      b.eventId,
      b.eventVendorId,
      JSON.stringify([
        { seq: 1, label: 'Downpayment', amount_php: 5000, due_date: '2026-09-01' },
        { seq: 2, label: 'Final', amount_php: 5170, due_date: '2026-10-30' },
      ]),
    ],
  );
  await coupleRecordsDeposit(b, 2000);
  const rows = forBooking(await payday(b.supplier), b);
  assert.deepEqual(rows.map((r) => r.label).sort(), ['Downpayment', 'Final']);
});

test('another supplier sees none of it', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b, 2000);
  await supplierConfirms(b, dep);
  const stranger = await newUser();
  await db.query(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1,'Some Other Shop')`,
    [stranger],
  );
  assert.deepEqual(forBooking(await payday(stranger), b), []);
});
