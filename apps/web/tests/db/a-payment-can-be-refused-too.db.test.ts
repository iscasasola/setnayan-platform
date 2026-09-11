/**
 * A PAYMENT CAN BE REFUSED TOO — "Not received", one path for every payment.
 * Register session H4 · migration 20271222394035.
 *
 * ⚖ Owner 2026-09-11: the deposit keeps its existing path; installments get the
 * same one, refereed on the same disputes page; and confirming a deposit in the
 * chat also confirms it on the booking, so the two can never disagree.
 *
 * Everything below is asserted BY BEHAVIOUR against the replayed schema — the
 * real triggers, the real functions, the real roles — never by reading DDL.
 *
 *   1. WHICH ROW IS THE DEPOSIT — decided by the database, once, and no session
 *      can claim or disown it.
 *   2. THE FORGERIES AND THE ERASURES — a couple can neither refuse on the
 *      supplier's behalf, settle on Setnayan's, INSERT a row already
 *      "confirmed" (the hole 20271008178212 recorded as known-not-fixed), nor
 *      CLEAR or DELETE a refusal or a ruling off their own row (orchestrator
 *      review of #5443) — proven, then neutralised to show the proof bites.
 *   3. ONE PATH — refusing the deposit's row IS reject_vendor_deposit; the ledger
 *      row never carries a second refusal of the same money.
 *   4. THE TWO ANSWERS NEVER DRIFT — confirm the deposit's row and the deposit is
 *      acknowledged; acknowledge the deposit (card, or Setnayan) and its row is
 *      confirmed.
 *   5. THE INSTALLMENT'S REFEREE — settle_vendor_payment_dispute, and the
 *      invariant that a fresh refusal is a fresh question.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271222394035_a_payment_can_be_refused_too.sql';
const DOWNPAYMENT_NOTE = 'Downpayment (lock · awaiting vendor confirmation)';
const DEPOSIT_NOTE = 'Deposit (date held · awaiting vendor confirmation)';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `h4-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

async function newAdmin(): Promise<string> {
  const uid = await newUser();
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1, $2, 'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [uid, `${uniq()}-admin@test.local`],
  );
  return uid;
}

type Booking = { eventId: string; eventVendorId: string; supplier: string; couple: string };

/** A booked supplier and a couple. The deposit is NOT recorded yet. */
async function newBooking(): Promise<Booking> {
  const supplier = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Ledger Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier],
  );
  const couple = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, couple],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'photographer','Ledger Studio','contracted',$2) RETURNING vendor_id`,
    [eventId, v.rows[0]!.vendor_profile_id],
  );
  return { eventId, eventVendorId: ev.rows[0]!.vendor_id, supplier, couple };
}

/**
 * Run `fn` as a signed-in user under the real `authenticated` role — RLS and
 * the guards both apply. Commits on success; returns the error text on failure.
 */
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

/** The couple records their deposit the way the app does: stamp, then log. */
async function coupleRecordsDeposit(b: Booking, amount = 10000, note = DOWNPAYMENT_NOTE): Promise<string> {
  const r = await as(b.couple, async () => {
    await db.query(
      `UPDATE public.event_vendors SET deposit_recorded_at = NOW(), deposit_method_label = 'GCash'
        WHERE vendor_id = $1`,
      [b.eventVendorId],
    );
    const p = await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes)
       VALUES ($1,$2,$3,'GCash',$4) RETURNING payment_id`,
      [b.eventId, b.eventVendorId, amount, note],
    );
    return p.rows[0]!.payment_id;
  });
  assert.equal(r.error, undefined, `seed failed: ${r.error}`);
  return r.value!;
}

async function coupleLogsInstallment(b: Booking, amount = 25000): Promise<string> {
  const r = await as(b.couple, async () => {
    const p = await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes, schedule_instance_seq)
       VALUES ($1,$2,$3,'BPI transfer','Second installment',2) RETURNING payment_id`,
      [b.eventId, b.eventVendorId, amount],
    );
    return p.rows[0]!.payment_id;
  });
  assert.equal(r.error, undefined, `seed failed: ${r.error}`);
  return r.value!;
}

type Ledger = {
  is_deposit_record: boolean;
  vendor_confirmed_at: string | null;
  payment_refused_at: string | null;
  payment_refusal_reason: string | null;
  payment_refused_by_user_id: string | null;
  payment_dispute_settled_at: string | null;
  payment_dispute_outcome: string | null;
  payment_dispute_note: string | null;
  amount_php: string;
};
async function ledger(paymentId: string): Promise<Ledger> {
  const r = await db.query<Ledger>(
    `SELECT is_deposit_record, vendor_confirmed_at, payment_refused_at, payment_refusal_reason,
            payment_refused_by_user_id, payment_dispute_settled_at, payment_dispute_outcome,
            payment_dispute_note, amount_php::text
       FROM public.event_vendor_payments WHERE payment_id = $1`,
    [paymentId],
  );
  return r.rows[0]!;
}
type Deposit = { deposit_acknowledged_at: string | null; deposit_declined_at: string | null; deposit_decline_reason: string | null };
async function deposit(eventVendorId: string): Promise<Deposit> {
  const r = await db.query<Deposit>(
    `SELECT deposit_acknowledged_at, deposit_declined_at, deposit_decline_reason
       FROM public.event_vendors WHERE vendor_id = $1`,
    [eventVendorId],
  );
  return r.rows[0]!;
}

async function rpc(uid: string, sql: string, params: unknown[]): Promise<{ out?: Record<string, unknown>; error?: string }> {
  const r = await as(uid, async () => (await db.query<{ out: Record<string, unknown> }>(sql, params)).rows[0]?.out);
  return { out: r.value ?? undefined, error: r.error };
}
const refuse = (uid: string, paymentId: string, reason: string | null) =>
  rpc(uid, `SELECT public.refuse_vendor_payment($1, $2) AS out`, [paymentId, reason]);
const confirm = (uid: string, paymentId: string) =>
  rpc(uid, `SELECT public.confirm_vendor_payment($1) IS NULL AS out`, [paymentId]);
const settle = (uid: string, paymentId: string, outcome: string, note: string) =>
  rpc(uid, `SELECT public.settle_vendor_payment_dispute($1, $2, $3) AS out`, [paymentId, outcome, note]);

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

/* ── 1 · WHICH ROW IS THE DEPOSIT ────────────────────────────────────────── */

test('the deposit record is the first deposit-noted row after the deposit is recorded — decided by the database', async () => {
  const b = await newBooking();
  // Before the deposit is recorded, a deposit-noted row is just a row.
  const early = await coupleLogsInstallment(b, 1);
  await as(b.couple, () =>
    db.query(`UPDATE public.event_vendor_payments SET notes = $2 WHERE payment_id = $1`, [early, DOWNPAYMENT_NOTE]),
  );
  const pre = await as(b.couple, async () =>
    (await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, notes)
       VALUES ($1,$2,1,$3) RETURNING payment_id`,
      [b.eventId, b.eventVendorId, DOWNPAYMENT_NOTE],
    )).rows[0]!.payment_id,
  );
  assert.equal((await ledger(pre.value!)).is_deposit_record, false, 'no deposit recorded yet → not the deposit');

  const real = await coupleRecordsDeposit(b);
  assert.equal((await ledger(real)).is_deposit_record, true);

  // A second deposit-noted row, and a row that ASKS to be the deposit, are not.
  const second = await as(b.couple, async () =>
    (await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, notes, is_deposit_record)
       VALUES ($1,$2,1,$3,TRUE) RETURNING payment_id`,
      [b.eventId, b.eventVendorId, DEPOSIT_NOTE],
    )).rows[0]!.payment_id,
  );
  assert.equal(second.error, undefined);
  assert.equal((await ledger(second.value!)).is_deposit_record, false, 'one deposit record per booking');

  // …and no session can move the mark afterwards.
  const disown = await as(b.couple, () =>
    db.query(`UPDATE public.event_vendor_payments SET is_deposit_record = FALSE WHERE payment_id = $1`, [real]),
  );
  assert.match(disown.error ?? '', /decided by the database/);
  const claim = await as(b.couple, () =>
    db.query(`UPDATE public.event_vendor_payments SET is_deposit_record = TRUE WHERE payment_id = $1`, [second.value!]),
  );
  assert.match(claim.error ?? '', /decided by the database/);
});

test('both deposit writers\' notes stamp the record', async () => {
  for (const note of [DOWNPAYMENT_NOTE, DEPOSIT_NOTE]) {
    const b = await newBooking();
    assert.equal((await ledger(await coupleRecordsDeposit(b, 5000, note))).is_deposit_record, true, note);
  }
});

/* ── 2 · THE FORGERIES ────────────────────────────────────────────────────── */

test('a couple cannot INSERT a row already confirmed — the hole the old UPDATE-only guard left open', async () => {
  const b = await newBooking();
  const r = await as(b.couple, () =>
    db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, vendor_confirmed_at, vendor_confirmed_by)
       VALUES ($1,$2,50000,NOW(),$3)`,
      [b.eventId, b.eventVendorId, b.supplier],
    ),
  );
  assert.match(r.error ?? '', /vendor confirmation may only be set via confirm_vendor_payment/);
  // The guard now runs on INSERT — pinned so a future CREATE TRIGGER cannot quietly drop it.
  const t = await db.query<{ ins: boolean; upd: boolean }>(
    `SELECT (tgtype & 4) <> 0 AS ins, (tgtype & 16) <> 0 AS upd, (tgtype & 8) <> 0 AS del FROM pg_trigger
      WHERE tgname = 'trg_guard_vendor_payment_confirmation' AND NOT tgisinternal`,
  );
  assert.deepEqual(t.rows[0], { ins: true, upd: true, del: true });
});

test('a couple cannot WRITE the supplier\'s refusal or Setnayan\'s settlement — on either verb', async () => {
  const b = await newBooking();
  const ins = await as(b.couple, () =>
    db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, payment_refused_at)
       VALUES ($1,$2,1,NOW())`,
      [b.eventId, b.eventVendorId],
    ),
  );
  assert.match(ins.error ?? '', /refusal is supplier-set only/);
  const pay = await coupleLogsInstallment(b);
  const upd = await as(b.couple, () =>
    db.query(`UPDATE public.event_vendor_payments SET payment_refused_at = NOW() WHERE payment_id = $1`, [pay]),
  );
  assert.match(upd.error ?? '', /refusal is supplier-set only/);
  const forged = await as(b.couple, () =>
    db.query(
      `UPDATE public.event_vendor_payments SET payment_dispute_settled_at = NOW(), payment_dispute_outcome = 'payment_stands'
        WHERE payment_id = $1`,
      [pay],
    ),
  );
  assert.match(forged.error ?? '', /settlement is Setnayan-set only/);
});

/** The couple clears the supplier's refusal off their own row. */
const CLEAR_REFUSAL = `UPDATE public.event_vendor_payments
    SET payment_refused_at = NULL, payment_refusal_reason = NULL, payment_refused_by_user_id = NULL
  WHERE payment_id = $1`;
const CLEAR_SETTLEMENT = `UPDATE public.event_vendor_payments
    SET payment_dispute_settled_at = NULL, payment_dispute_outcome = NULL,
        payment_dispute_note = NULL, payment_dispute_settled_by_user_id = NULL
  WHERE payment_id = $1`;

test('ERASURE · a couple cannot clear the refusal, clear the ruling, or delete the disputed row', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  assert.equal((await refuse(b.supplier, pay, 'not in our account')).out?.status, 'ok');

  assert.match((await as(b.couple, () => db.query(CLEAR_REFUSAL, [pay]))).error ?? '', /refusal is supplier-set only/);
  // One column at a time too — the clause is per column, not per set.
  const oneColumn = await as(b.couple, () =>
    db.query(`UPDATE public.event_vendor_payments SET payment_refusal_reason = NULL WHERE payment_id = $1`, [pay]),
  );
  assert.match(oneColumn.error ?? '', /refusal is supplier-set only/);

  const admin = await newAdmin();
  assert.equal((await settle(admin, pay, 'not_received', 'no transfer on the statement')).out?.status, 'ok');
  assert.match((await as(b.couple, () => db.query(CLEAR_SETTLEMENT, [pay]))).error ?? '', /settlement is Setnayan-set only/);

  // The same erasure by the other verb — the budget page deletes through the couple's session.
  const del = await as(b.couple, () => db.query(`DELETE FROM public.event_vendor_payments WHERE payment_id = $1`, [pay]));
  assert.match(del.error ?? '', /cannot be deleted/);

  const row = await ledger(pay);
  assert.ok(row.payment_refused_at, 'the refusal survived');
  assert.equal(row.payment_dispute_outcome, 'not_received', 'the ruling survived');
});

test('a couple can still delete a payment nobody has disputed — the budget page\'s delete is unchanged', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  const del = await as(b.couple, () =>
    db.query<{ payment_id: string }>(`DELETE FROM public.event_vendor_payments WHERE payment_id = $1 RETURNING payment_id`, [pay]),
  );
  assert.equal(del.error, undefined);
  assert.equal((del.value as { rows: unknown[] }).rows.length, 1, 'the delete really happened — a BEFORE DELETE that returned NULL would skip it silently');
});

test('deletes that are not a session still delete — erasure, and the event\'s own deletion — even of a disputed row', async () => {
  // A BEFORE DELETE trigger that returns NULL does not error: it skips the row
  // and reports success. Erasure (service_role) and keep_supplier_bookings_on_
  // event_delete (SECURITY DEFINER) must never be silently turned into no-ops.
  const b = await newBooking();
  const disputed = await coupleLogsInstallment(b);
  await refuse(b.supplier, disputed, 'never arrived');
  const direct = await db.query<{ payment_id: string }>(
    `DELETE FROM public.event_vendor_payments WHERE payment_id = $1 RETURNING payment_id`,
    [disputed],
  );
  assert.equal(direct.rows.length, 1, 'an owner-context delete of a disputed row happened');

  const c = await newBooking();
  const unconfirmed = await coupleLogsInstallment(c);
  await db.query(`DELETE FROM public.events WHERE event_id = $1`, [c.eventId]);
  const left = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE payment_id = $1`,
    [unconfirmed],
  );
  assert.equal(left.rows[0]!.n, 0, 'the event\'s deletion still drops payments the supplier never confirmed');
});

test('NEUTRALISATION · put the old "clearing is allowed" clause back and the erasure lands — so the test above measures the guard', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  await refuse(b.supplier, pay, 'never arrived');

  const def = (
    await db.query<{ d: string }>(`SELECT pg_get_functiondef('public.guard_vendor_payment_confirmation()'::regprocedure) AS d`)
  ).rows[0]!.d;
  let permissive = def;
  for (const col of [
    'payment_refused_at',
    'payment_refusal_reason',
    'payment_refused_by_user_id',
    'payment_dispute_settled_at',
    'payment_dispute_outcome',
    'payment_dispute_note',
    'payment_dispute_settled_by_user_id',
  ]) {
    const strict = `NEW.${col} IS DISTINCT FROM OLD.${col}`;
    assert.ok(permissive.includes(strict), `the live guard no longer reads "${strict}" — re-derive this neutralisation`);
    permissive = permissive.replace(strict, `(${strict} AND NEW.${col} IS NOT NULL)`);
  }

  await setAuthUid(db, b.couple);
  await db.exec('BEGIN');
  try {
    await db.exec(permissive);
    await db.exec('SET LOCAL ROLE authenticated');
    await db.query(CLEAR_REFUSAL, [pay]);
    await db.exec('RESET ROLE');
    assert.equal((await ledger(pay)).payment_refused_at, null, 'with the old clause, the couple erases the refusal');
  } finally {
    await db.exec('ROLLBACK');
    await setAuthUid(db, null);
  }
  assert.ok((await ledger(pay)).payment_refused_at, 'rolled back — the real guard is in force again');
});

/* ── 3 · REFUSING — one door, and the deposit goes through its own ─────────── */

test('an installment: only the booked supplier can refuse it, the words are kept, nothing is deleted', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b, 25000);
  const stranger = await newUser();

  assert.match((await refuse(b.couple, pay, 'x')).error ?? '', /not_your_booking/);
  assert.match((await refuse(stranger, pay, 'x')).error ?? '', /not_your_booking/);
  assert.match(
    (await refuse(b.supplier, '00000000-0000-0000-0000-000000000000', 'x')).error ?? '',
    /not_your_booking/,
    'an unknown id gets the same answer as someone else\'s — no existence oracle',
  );

  const long = `  ${'n'.repeat(300)}  `;
  assert.equal((await refuse(b.supplier, pay, long)).out?.status, 'ok');
  const row = await ledger(pay);
  assert.ok(row.payment_refused_at);
  assert.equal(row.payment_refusal_reason, 'n'.repeat(240));
  assert.equal(row.payment_refused_by_user_id, b.supplier);
  assert.equal(row.amount_php, '25000.00', 'the couple\'s amount stands');
  assert.equal((await refuse(b.supplier, pay, 'again')).out?.status, 'already');
});

test('ONE PATH · refusing the deposit\'s row IS reject_vendor_deposit — the ledger row carries no second refusal', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b);
  const out = (await refuse(b.supplier, dep, 'nothing arrived')).out;
  assert.equal(out?.status, 'ok');
  assert.equal(out?.routed, 'deposit');
  const booking = await deposit(b.eventVendorId);
  assert.ok(booking.deposit_declined_at, 'the booking carries the refusal');
  assert.equal(booking.deposit_decline_reason, 'nothing arrived');
  assert.equal((await ledger(dep)).payment_refused_at, null, 'the ledger row does not');
  // And the database would refuse a second copy even from a definer.
  await assert.rejects(
    db.query(`UPDATE public.event_vendor_payments SET payment_refused_at = NOW() WHERE payment_id = $1`, [dep]),
    /deposit_refuses_on_the_booking/,
  );
});

test('a confirmed payment cannot be refused', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  assert.equal((await confirm(b.supplier, pay)).error, undefined);
  assert.equal((await refuse(b.supplier, pay, 'x')).out?.status, 'already_confirmed');
});

/* ── 4 · THE TWO ANSWERS NEVER DRIFT ─────────────────────────────────────── */

test('confirming the deposit\'s row acknowledges the deposit — and lifts an earlier refusal of it', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b);
  assert.equal((await refuse(b.supplier, dep, 'not yet')).out?.status, 'ok');
  assert.equal((await confirm(b.supplier, dep)).error, undefined);
  const booking = await deposit(b.eventVendorId);
  assert.ok(booking.deposit_acknowledged_at, 'the deposit is acknowledged');
  assert.equal(booking.deposit_declined_at, null, 'the refusal is lifted');
  assert.ok((await ledger(dep)).vendor_confirmed_at, 'and the row is confirmed');
});

test('acknowledging the deposit from its own card confirms its row', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b);
  const other = await coupleLogsInstallment(b);
  const r = await rpc(b.supplier, `SELECT public.acknowledge_vendor_deposit($1) AS out`, [b.eventVendorId]);
  assert.equal(r.out?.status, 'ok');
  assert.ok((await ledger(dep)).vendor_confirmed_at, 'the deposit row stopped asking');
  assert.equal((await ledger(other)).vendor_confirmed_at, null, 'and ONLY the deposit row');
});

test('Setnayan ruling "the payment stands" on the deposit confirms its row', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b);
  const admin = await newAdmin();
  assert.equal((await refuse(b.supplier, dep, 'nothing')).out?.status, 'ok');
  const r = await rpc(admin, `SELECT public.settle_vendor_deposit_dispute($1,'payment_stands','bank shows it') AS out`, [
    b.eventVendorId,
  ]);
  assert.equal(r.out?.status, 'ok');
  assert.ok((await ledger(dep)).vendor_confirmed_at);
});

test('confirming an installment clears its refusal and any settlement', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  const admin = await newAdmin();
  await refuse(b.supplier, pay, 'not in the account');
  assert.equal((await settle(admin, pay, 'not_received', 'no transfer on the statement')).out?.status, 'ok');
  assert.equal((await confirm(b.supplier, pay)).error, undefined);
  const row = await ledger(pay);
  assert.ok(row.vendor_confirmed_at);
  assert.deepEqual(
    [row.payment_refused_at, row.payment_refusal_reason, row.payment_dispute_settled_at, row.payment_dispute_outcome],
    [null, null, null, null],
  );
});

/* ── 5 · THE INSTALLMENT'S REFEREE ────────────────────────────────────────── */

test('only Setnayan settles, and it must name a real outcome', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  await refuse(b.supplier, pay, 'nope');
  assert.match((await settle(b.supplier, pay, 'payment_stands', 'mine')).error ?? '', /Setnayan-only/);
  assert.match((await settle(b.couple, pay, 'payment_stands', 'mine')).error ?? '', /Setnayan-only/);
  const admin = await newAdmin();
  assert.match((await settle(admin, pay, 'split_the_difference', 'x')).error ?? '', /unknown settlement outcome/);
});

test('"the payment stands" confirms the row and hands back the supplier\'s words for the audit', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  const admin = await newAdmin();
  await refuse(b.supplier, pay, 'never saw it');
  const out = (await settle(admin, pay, 'payment_stands', 'BPI statement shows it on 3 Sep')).out;
  assert.equal(out?.status, 'ok');
  assert.equal(out?.claim, 'never saw it');
  const row = await ledger(pay);
  assert.ok(row.vendor_confirmed_at);
  assert.equal(row.payment_refused_at, null);
  assert.equal(row.payment_dispute_outcome, 'payment_stands');
  assert.equal(row.payment_dispute_note, 'BPI statement shows it on 3 Sep');
  assert.equal((await settle(admin, pay, 'not_received', 'again')).out?.status, 'no_dispute');
});

test('"it did not arrive" keeps the refusal — and if Setnayan reopens it, a FRESH refusal is a fresh question', async () => {
  const b = await newBooking();
  const pay = await coupleLogsInstallment(b);
  const admin = await newAdmin();
  await refuse(b.supplier, pay, 'nothing');
  assert.equal((await settle(admin, pay, 'not_received', 'no such transfer')).out?.status, 'ok');
  let row = await ledger(pay);
  assert.ok(row.payment_refused_at, 'the refusal stands');
  assert.equal(row.payment_dispute_outcome, 'not_received');
  assert.equal((await settle(admin, pay, 'payment_stands', 'x')).out?.status, 'already');

  // No session can clear a refusal any more; Setnayan's own tooling (service
  // role, not a session) is the only thing that could reopen one. When it does,
  // the supplier's next refusal must NOT inherit the old ruling.
  await db.query(
    `UPDATE public.event_vendor_payments
        SET payment_refused_at = NULL, payment_refusal_reason = NULL, payment_refused_by_user_id = NULL
      WHERE payment_id = $1`,
    [pay],
  );
  assert.equal((await refuse(b.supplier, pay, 'still nothing')).out?.status, 'ok');
  row = await ledger(pay);
  assert.equal(row.payment_dispute_settled_at, null, 'open again, so it reaches the queue');
  const open = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_payments
      WHERE payment_id = $1 AND payment_refused_at IS NOT NULL AND payment_dispute_settled_at IS NULL`,
    [pay],
  );
  assert.equal(open.rows[0]!.n, 1);
});

test('the deposit is never settled here — it has its own referee', async () => {
  const b = await newBooking();
  const dep = await coupleRecordsDeposit(b);
  const admin = await newAdmin();
  await refuse(b.supplier, dep, 'nothing');
  assert.equal((await settle(admin, dep, 'payment_stands', 'x')).out?.status, 'no_dispute');
});

/* ── 6 · who may call what ─────────────────────────────────────────────── */

test('anon calls neither function; nobody calls the trigger functions', async () => {
  const grants = await db.query<{ fn: string; anon: boolean; authed: boolean }>(
    `SELECT p.proname AS fn,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('refuse_vendor_payment', 'settle_vendor_payment_dispute',
                          'stamp_event_vendor_payment_deposit_record',
                          'confirm_deposit_record_on_acknowledgement')
      ORDER BY p.proname`,
  );
  assert.deepEqual(grants.rows, [
    { fn: 'confirm_deposit_record_on_acknowledgement', anon: false, authed: false },
    { fn: 'refuse_vendor_payment', anon: false, authed: true },
    { fn: 'settle_vendor_payment_dispute', anon: false, authed: true },
    { fn: 'stamp_event_vendor_payment_deposit_record', anon: false, authed: false },
  ]);
});
