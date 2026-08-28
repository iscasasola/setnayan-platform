/**
 * A DISPUTE IS NOT AN ERASER — Setnayan settles "it never reached me" by hand.
 *
 * ⚖ Owner 2026-08-28: **"no. do not. we will confirm it manually."**
 *
 * 🔑 WHAT THIS FILE IS ACTUALLY GUARDING. The erasure itself was already fixed
 * (PR #4927) and `the-couple-keeps-their-record.db.test.ts` pins that. What had
 * no referee was the SETTLEMENT: a refusal reached the couple and NOBODY at
 * Setnayan. This file pins the three things that can silently go wrong with the
 * fix:
 *
 *   1. A couple can forge the referee's decision. `event_vendors_couple_write`
 *      is a PERMISSIVE `FOR ALL` policy and `authenticated` holds UPDATE on all
 *      76 columns, so the trigger is the ONLY thing standing between a couple
 *      and writing "Setnayan ruled the payment stands" onto their own booking.
 *   2. Settling DELETES the very evidence the session is named for.
 *   3. 🪤 THE ONE THAT WOULD NEVER HAVE BEEN NOTICED: a SECOND refusal after a
 *      settlement inherits the stale "already settled" and never reaches the
 *      queue again. No error, no log — a queue quietly wrong about how much
 *      work is waiting. Covered by the reopening test at the bottom.
 */
import { test, before, after } from 'node:test';
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

let seq = 0;
const uniq = () => `dispute-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

/** An admin, made the way is_admin() actually reads it: users.account_type. */
async function newAdmin(): Promise<string> {
  const uid = await newUser();
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [uid, `${uniq()}-admin@test.local`],
  );
  return uid;
}

async function seedRefusedClaim(): Promise<{
  eventId: string;
  eventVendorId: string;
  vendorUserId: string;
  coupleUserId: string;
}> {
  const vendorUserId = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Referee Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [vendorUserId],
  );
  const vendorProfileId = v.rows[0]!.vendor_profile_id;
  const coupleUserId = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUserId],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        deposit_paid_php, deposit_recorded_at, deposit_proof_url, deposit_method_label)
     VALUES ($1,'photographer','Referee Studio','contracted',$2,
             10000, NOW(), 'https://example.test/receipt.png', 'GCash')
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  const eventVendorId = ev.rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes)
     VALUES ($1,$2,10000,'GCash','Downpayment (lock · awaiting vendor confirmation)')`,
    [eventId, eventVendorId],
  );
  // The supplier says it never arrived.
  await setAuthUid(db, vendorUserId);
  const r = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1,$2) AS out`,
    [eventVendorId, 'nothing landed in our account'],
  );
  assert.equal(r.rows[0]!.out.status, 'ok', 'seed failed: the refusal did not take');
  return { eventId, eventVendorId, vendorUserId, coupleUserId };
}

type Row = {
  deposit_recorded_at: string | null;
  deposit_proof_url: string | null;
  deposit_method_label: string | null;
  deposit_paid_php: string | null;
  deposit_acknowledged_at: string | null;
  deposit_declined_at: string | null;
  deposit_decline_reason: string | null;
  deposit_dispute_settled_at: string | null;
  deposit_dispute_outcome: string | null;
  deposit_dispute_note: string | null;
  deposit_dispute_settled_by_user_id: string | null;
};

async function readRow(id: string): Promise<Row> {
  const r = await db.query<Row>(
    `SELECT deposit_recorded_at, deposit_proof_url, deposit_method_label, deposit_paid_php,
            deposit_acknowledged_at, deposit_declined_at, deposit_decline_reason,
            deposit_dispute_settled_at, deposit_dispute_outcome, deposit_dispute_note,
            deposit_dispute_settled_by_user_id
       FROM public.event_vendors WHERE vendor_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function ledgerCount(id: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE vendor_id = $1`,
    [id],
  );
  return Number(r.rows[0]!.n);
}

/**
 * Run as a real PostgREST caller would: role `authenticated`, RLS on.
 *
 * 🪤 IT OWNS ITS OWN TRANSACTION, AND THAT IS NOT TIDINESS. A refused write
 * leaves the connection in an aborted transaction, so any cleanup issued after
 * it (`RESET ROLE`) throws too — and because every test in this file shares one
 * PGlite connection, the first expected refusal poisoned all eight. Rolling
 * back both undoes the probe AND restores the role (`SET LOCAL` is
 * transaction-scoped), and ROLLBACK is legal on an aborted transaction.
 */
async function asAuthenticated<T>(uid: string, fn: () => Promise<T>): Promise<string | null> {
  await setAuthUid(db, uid);
  await db.exec(`BEGIN`);
  try {
    await db.exec(`SET LOCAL ROLE authenticated`);
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    await db.exec(`ROLLBACK`);
  }
}

/* ── 1 · THE FORGERY ──────────────────────────────────────────────────────── */

test('a couple CANNOT forge the referee decision on their own booking', async () => {
  const { eventVendorId, coupleUserId } = await seedRefusedClaim();
  const err = await asAuthenticated(coupleUserId, async () => {
    await db.query(
      `UPDATE public.event_vendors
          SET deposit_dispute_settled_at = NOW(),
              deposit_dispute_outcome    = 'payment_stands'
        WHERE vendor_id = $1`,
      [eventVendorId],
    );
  });
  assert.ok(
    err && /Setnayan-set only/.test(err),
    'a couple wrote their own settlement — the row is theirs, but this field is NOT: ' + err,
  );
});

test('only Setnayan may settle — the booked supplier is refused', async () => {
  const { eventVendorId, vendorUserId } = await seedRefusedClaim();
  await setAuthUid(db, vendorUserId);
  await assert.rejects(
    () =>
      db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received',NULL)`, [
        eventVendorId,
      ]),
    /Setnayan-only/,
    'the supplier who raised the dispute could also decide it',
  );
});

test('an unknown outcome is refused rather than silently stored', async () => {
  const { eventVendorId } = await seedRefusedClaim();
  await setAuthUid(db, await newAdmin());
  await assert.rejects(
    () =>
      db.query(`SELECT public.settle_vendor_deposit_dispute($1,'whatever',NULL)`, [eventVendorId]),
    /unknown settlement outcome/,
  );
});

/* ── 2 · NEITHER OUTCOME ERASES ANYTHING ──────────────────────────────────── */

test('not_received: the refusal STANDS and the couple keeps every part of their record', async () => {
  const { eventVendorId } = await seedRefusedClaim();
  const before = await readRow(eventVendorId);
  assert.equal(await ledgerCount(eventVendorId), 1);

  await setAuthUid(db, await newAdmin());
  const res = await db.query<{ out: { status: string; outcome: string; claim: string } }>(
    `SELECT public.settle_vendor_deposit_dispute($1,'not_received','  we checked the bank, nothing arrived  ') AS out`,
    [eventVendorId],
  );
  assert.equal(res.rows[0]!.out.status, 'ok');
  assert.equal(res.rows[0]!.out.outcome, 'not_received');
  // The supplier's own words come back so the audit row can keep them verbatim.
  assert.equal(res.rows[0]!.out.claim, 'nothing landed in our account');

  const after = await readRow(eventVendorId);
  assert.deepEqual(after.deposit_recorded_at, before.deposit_recorded_at, 'the receipt was erased');
  assert.equal(after.deposit_proof_url, before.deposit_proof_url, 'the proof was erased');
  assert.equal(after.deposit_method_label, before.deposit_method_label, 'the method was erased');
  assert.equal(after.deposit_paid_php, before.deposit_paid_php, 'the amount was erased');
  assert.equal(await ledgerCount(eventVendorId), 1, 'the ledger row was deleted');
  // The refusal stands; the couple is the one who must act next.
  assert.ok(after.deposit_declined_at, 'the refusal was lifted by a not_received settlement');
  assert.equal(after.deposit_acknowledged_at, null);
  assert.equal(after.deposit_dispute_outcome, 'not_received');
  assert.equal(after.deposit_dispute_note, 'we checked the bank, nothing arrived', 'not trimmed');
  assert.ok(after.deposit_dispute_settled_by_user_id, 'nobody is recorded as having settled it');
});

test('payment_stands: the booking proceeds AND the record still survives', async () => {
  const { eventVendorId } = await seedRefusedClaim();
  const before = await readRow(eventVendorId);
  await setAuthUid(db, await newAdmin());
  const res = await db.query<{ out: { status: string } }>(
    `SELECT public.settle_vendor_deposit_dispute($1,'payment_stands','receipt matches the bank record') AS out`,
    [eventVendorId],
  );
  assert.equal(res.rows[0]!.out.status, 'ok');

  const after = await readRow(eventVendorId);
  assert.ok(after.deposit_acknowledged_at, 'the deposit was not confirmed');
  // The one-way CHECK forbids confirmed+refused together, so the refusal is
  // lifted — but the ROW still says a dispute happened and how it ended.
  assert.equal(after.deposit_declined_at, null);
  assert.equal(after.deposit_dispute_outcome, 'payment_stands');
  assert.ok(after.deposit_dispute_settled_at, 'the settlement left no trace on the row');
  assert.deepEqual(after.deposit_recorded_at, before.deposit_recorded_at);
  assert.equal(after.deposit_proof_url, before.deposit_proof_url);
  assert.equal(await ledgerCount(eventVendorId), 1);
});

/* ── 3 · THE CONTRACT AROUND IT ───────────────────────────────────────────── */

test('settling twice is benign, and settling a booking with no dispute says so', async () => {
  const { eventVendorId } = await seedRefusedClaim();
  await setAuthUid(db, await newAdmin());
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received',NULL)`, [
    eventVendorId,
  ]);
  const again = await db.query<{ out: { status: string } }>(
    `SELECT public.settle_vendor_deposit_dispute($1,'payment_stands',NULL) AS out`,
    [eventVendorId],
  );
  assert.equal(again.rows[0]!.out.status, 'already', 'a second admin overwrote the first answer');

  // A booking nobody has refused.
  const fresh = await seedRefusedClaim();
  // seedRefusedClaim leaves the SUPPLIER signed in (it has to, to refuse) — so
  // become Setnayan again before asking the referee anything.
  await setAuthUid(db, await newAdmin());
  await db.query(
    `UPDATE public.event_vendors SET deposit_declined_at=NULL, deposit_decline_reason=NULL
      WHERE vendor_id=$1`,
    [fresh.eventVendorId],
  );
  const none = await db.query<{ out: { status: string } }>(
    `SELECT public.settle_vendor_deposit_dispute($1,'not_received',NULL) AS out`,
    [fresh.eventVendorId],
  );
  assert.equal(none.rows[0]!.out.status, 'no_dispute');
});

test('the supplier confirming later RETIRES the settlement (the parties settled it themselves)', async () => {
  const { eventVendorId, vendorUserId } = await seedRefusedClaim();
  await setAuthUid(db, await newAdmin());
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received',NULL)`, [
    eventVendorId,
  ]);
  assert.ok((await readRow(eventVendorId)).deposit_dispute_settled_at);

  // The couple sends it again — that lifts the refusal (couple-side path).
  await db.query(
    `UPDATE public.event_vendors
        SET deposit_declined_at=NULL, deposit_decline_reason=NULL, deposit_declined_by_user_id=NULL
      WHERE vendor_id=$1`,
    [eventVendorId],
  );
  await setAuthUid(db, vendorUserId);
  await db.query(`SELECT public.acknowledge_vendor_deposit($1)`, [eventVendorId]);

  const after = await readRow(eventVendorId);
  assert.ok(after.deposit_acknowledged_at);
  assert.equal(
    after.deposit_dispute_settled_at,
    null,
    'a confirmed deposit still carries a stale settlement from a dispute that is over',
  );
});

/* ── 4 · 🪤 THE SILENT MISS ───────────────────────────────────────────────── */

test('A SECOND REFUSAL RE-OPENS THE QUESTION — it does not inherit the old settlement', async () => {
  const { eventVendorId, vendorUserId } = await seedRefusedClaim();

  await setAuthUid(db, await newAdmin());
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received','round one') AS out`, [
    eventVendorId,
  ]);
  assert.ok((await readRow(eventVendorId)).deposit_dispute_settled_at, 'round one did not settle');

  // The couple sends it again — the refusal lifts and the question goes back to
  // the supplier.
  await db.query(
    `UPDATE public.event_vendors
        SET deposit_declined_at=NULL, deposit_decline_reason=NULL, deposit_declined_by_user_id=NULL
      WHERE vendor_id=$1`,
    [eventVendorId],
  );

  // …and the supplier refuses a SECOND time.
  await setAuthUid(db, vendorUserId);
  const second = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1,'still nothing') AS out`,
    [eventVendorId],
  );
  assert.equal(second.rows[0]!.out.status, 'ok', 'the second refusal did not take');

  const after = await readRow(eventVendorId);
  assert.ok(after.deposit_declined_at, 'the second refusal is not on the row');
  assert.equal(
    after.deposit_dispute_settled_at,
    null,
    'THE SILENT MISS: the second dispute inherited round one\'s settlement, so the admin queue ' +
      '(which counts declined AND not-yet-settled) would never show it. No error, no log — ' +
      'a queue quietly wrong about how much work is waiting.',
  );
  assert.equal(after.deposit_dispute_outcome, null, 'the stale outcome survived a fresh refusal');
  assert.equal(after.deposit_dispute_note, null, 'the stale note survived a fresh refusal');
});
