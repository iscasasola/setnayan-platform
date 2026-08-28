/**
 * THE COUPLE KEEPS THEIR RECORD — the deposit refusal marks, it does not erase.
 *
 * Owner ruling 2026-08-27: **"yes they keep their record."** A supplier can
 * declare that a recorded deposit never reached them; before this, that
 * declaration DELETED the couple's own amount, receipt, method and ledger row,
 * leaving their screen reading as though they had never paid anything.
 *
 * 🔑 THIS FILE ALSO PINS THE CONTRACTS THE MIGRATION REPRODUCED. Two live money
 * functions were `CREATE OR REPLACE`d, and this repo has silently reverted a
 * guard that way before — so the ownership gate, the `not_recorded`
 * precondition, the benign `already`, and the single-winner WHERE are asserted
 * here as well as the new behaviour. A future replacement that keeps the new
 * half and drops an old one fails.
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
const uniq = () => `keeps-${++seq}-${Date.now()}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

async function newVendor(): Promise<{ vendorProfileId: string; userId: string }> {
  const userId = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Keeps Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

/** A booking with a deposit the couple has recorded, proof and all. */
async function seedClaim(opts: { recorded?: boolean } = {}): Promise<{
  eventId: string;
  eventVendorId: string;
  vendorUserId: string;
  coupleUserId: string;
}> {
  const { vendorProfileId, userId: vendorUserId } = await newVendor();
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
        deposit_paid_php, deposit_recorded_at, deposit_proof_url,
        deposit_method_label)
     VALUES ($1, 'photographer', 'Keeps Studio', 'contracted', $2,
             10000, ${opts.recorded === false ? 'NULL' : 'NOW()'},
             ${opts.recorded === false ? 'NULL' : `'https://example.test/receipt.png'`},
             ${opts.recorded === false ? 'NULL' : `'GCash'`})
     RETURNING vendor_id`,
    [eventId, vendorProfileId],
  );
  const eventVendorId = ev.rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, notes)
     VALUES ($1,$2,10000,'GCash','Downpayment (lock · awaiting vendor confirmation)')`,
    [eventId, eventVendorId],
  );
  return { eventId, eventVendorId, vendorUserId, coupleUserId };
}

type Row = {
  deposit_recorded_at: string | null;
  deposit_proof_url: string | null;
  deposit_method_label: string | null;
  deposit_acknowledged_at: string | null;
  deposit_declined_at: string | null;
  deposit_decline_reason: string | null;
  deposit_declined_by_user_id: string | null;
};

async function readRow(eventVendorId: string): Promise<Row> {
  const r = await db.query<Row>(
    `SELECT deposit_recorded_at, deposit_proof_url, deposit_method_label,
            deposit_acknowledged_at, deposit_declined_at, deposit_decline_reason,
            deposit_declined_by_user_id
       FROM public.event_vendors WHERE vendor_id = $1`,
    [eventVendorId],
  );
  return r.rows[0]!;
}

async function ledgerCount(eventVendorId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendor_payments WHERE vendor_id = $1`,
    [eventVendorId],
  );
  return Number(r.rows[0]!.n);
}

test('a refusal KEEPS everything the couple entered — and their ledger row', async () => {
  const { eventVendorId, vendorUserId } = await seedClaim();
  const before = await readRow(eventVendorId);
  assert.ok(before.deposit_recorded_at, 'seed failed: nothing recorded');
  assert.equal(await ledgerCount(eventVendorId), 1);

  await setAuthUid(db, vendorUserId);
  const res = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1, $2) AS out`,
    [eventVendorId, '  no payment received  '],
  );
  assert.equal(res.rows[0]!.out.status, 'ok');

  const after = await readRow(eventVendorId);
  // THE WHOLE POINT: the couple's own record is untouched.
  // ⚠ deepEqual, not equal: the driver hands timestamps back as Date OBJECTS, so
  // strictEqual compares identity and fails on two equal instants — a failure
  // that looks exactly like the erasure this test exists to catch.
  assert.deepEqual(
    after.deposit_recorded_at,
    before.deposit_recorded_at,
    'the claim date was erased',
  );
  assert.equal(after.deposit_proof_url, before.deposit_proof_url, 'their receipt was erased');
  assert.equal(after.deposit_method_label, before.deposit_method_label, 'their method was erased');
  assert.equal(await ledgerCount(eventVendorId), 1, "the couple's ledger row was deleted");
  // And the supplier's answer is on the row, trimmed.
  assert.ok(after.deposit_declined_at, 'the refusal was not recorded at all');
  assert.equal(after.deposit_decline_reason, 'no payment received');
  assert.equal(after.deposit_declined_by_user_id, vendorUserId);
});

test('a refusal is idempotent, and a confirmation clears it', async () => {
  const { eventVendorId, vendorUserId } = await seedClaim();
  await setAuthUid(db, vendorUserId);
  await db.query(`SELECT public.reject_vendor_deposit($1, NULL)`, [eventVendorId]);
  const again = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1, NULL) AS out`,
    [eventVendorId],
  );
  assert.equal(again.rows[0]!.out.status, 'already', 'a re-call must be benign, not an error');

  // The money turned up: confirming clears the refusal, so the couple never
  // reads a refusal beside a confirmation.
  const ack = await db.query<{ out: { status: string } }>(
    `SELECT public.acknowledge_vendor_deposit($1) AS out`,
    [eventVendorId],
  );
  assert.equal(ack.rows[0]!.out.status, 'ok');
  const row = await readRow(eventVendorId);
  assert.ok(row.deposit_acknowledged_at, 'the confirmation did not land');
  assert.equal(row.deposit_declined_at, null, 'the refusal survived a confirmation');
  assert.equal(row.deposit_decline_reason, null);
  assert.equal(row.deposit_declined_by_user_id, null);

  // And a confirmed claim can no longer be refused — that reversal moves the
  // booking fee and the schedule pool, so it is not this function's to make.
  const after = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1, NULL) AS out`,
    [eventVendorId],
  );
  assert.equal(after.rows[0]!.out.status, 'already_confirmed');
});

test('the contracts the migration reproduced still hold', async () => {
  // not_recorded: nothing claimed, nothing to answer — BOTH functions.
  const bare = await seedClaim({ recorded: false });
  await setAuthUid(db, bare.vendorUserId);
  const r1 = await db.query<{ out: { status: string } }>(
    `SELECT public.reject_vendor_deposit($1, NULL) AS out`,
    [bare.eventVendorId],
  );
  assert.equal(r1.rows[0]!.out.status, 'not_recorded');
  const r2 = await db.query<{ out: { status: string } }>(
    `SELECT public.acknowledge_vendor_deposit($1) AS out`,
    [bare.eventVendorId],
  );
  assert.equal(r2.rows[0]!.out.status, 'not_recorded');

  // OWNERSHIP: a stranger cannot answer somebody else's money question. The
  // functions are DEFINER and granted to authenticated, so the gate is the only
  // thing standing between a signed-in stranger and this row.
  const mine = await seedClaim();
  const stranger = await newUser();
  await setAuthUid(db, stranger);
  await assert.rejects(
    () => db.query(`SELECT public.reject_vendor_deposit($1, NULL)`, [mine.eventVendorId]),
    /not_your_booking/,
    'a stranger refused somebody else’s deposit',
  );
  await assert.rejects(
    () => db.query(`SELECT public.acknowledge_vendor_deposit($1)`, [mine.eventVendorId]),
    /not_your_booking/,
    'a stranger confirmed somebody else’s deposit',
  );
});

test('an answer is one way or the other — the database refuses both', async () => {
  const { eventVendorId } = await seedClaim();
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.event_vendors
            SET deposit_acknowledged_at = NOW(), deposit_declined_at = NOW()
          WHERE vendor_id = $1`,
        [eventVendorId],
      ),
    /event_vendors_deposit_answer_is_one_way/,
    'a row can be confirmed AND refused at once',
  );
});

test('the couple may CLEAR the refusal and may never SET one', async () => {
  const { eventVendorId, vendorUserId, coupleUserId } = await seedClaim();
  await setAuthUid(db, vendorUserId);
  await db.query(`SELECT public.reject_vendor_deposit($1, 'nothing arrived')`, [eventVendorId]);

  // Now act as the couple through their OWN session, which is what PostgREST
  // gives a signed-in person: role `authenticated` + their auth.uid().
  await setAuthUid(db, coupleUserId);
  await db.exec(`SET ROLE authenticated`);
  try {
    // FORGERY: planting the supplier's answer must be refused by the guard.
    await assert.rejects(
      () =>
        db.query(
          `UPDATE public.event_vendors SET deposit_declined_at = NOW() WHERE vendor_id = $1`,
          [eventVendorId],
        ),
      /vendor-set only/,
      'a couple could plant their own supplier’s refusal',
    );

    /*
      🔑 AND THE OTHER DIRECTION MUST SUCCEED, OR THIS TEST PROVES NOTHING.
      If RLS simply denied the couple this row, the rejection above would be
      "zero rows updated" rather than the guard firing, and a permanently
      unanswerable refusal would read as a passing guard. Clearing IS the couple
      re-sending their proof, and it is deliberately permitted.
    */
    const cleared = await db.query<{ vendor_id: string }>(
      `UPDATE public.event_vendors
          SET deposit_declined_at = NULL, deposit_decline_reason = NULL,
              deposit_declined_by_user_id = NULL
        WHERE vendor_id = $1 RETURNING vendor_id`,
      [eventVendorId],
    );
    assert.equal(
      cleared.rows.length,
      1,
      'the couple cannot clear a refusal — then re-sending their proof can never reach the supplier',
    );
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
  }
  const row = await readRow(eventVendorId);
  assert.equal(row.deposit_declined_at, null);
  assert.ok(row.deposit_recorded_at, 're-sending must not disturb the claim itself');
});
