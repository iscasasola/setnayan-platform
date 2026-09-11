/**
 * A DEPOSIT REFUSAL SURVIVES A RE-SEND — FOLLOW-UPS A item 1 · 20271223918326.
 *
 * Until this, the couple's re-send cleared the supplier's "it never reached me"
 * — and any Setnayan ruling on it — through the couple's own session, so the
 * dispute left /admin/disputes without a trace, and any couple could do the same
 * with one PATCH. Now the re-send goes through a server-only definer, every way a
 * refusal ENDS writes one history row, and a session may not clear the columns.
 *
 * Asserted by behaviour under the real roles, then neutralised to show it bites.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271223918326_a_deposit_refusal_survives_a_resend.sql';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `resend-${++seq}`;

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

/** A booking whose couple has recorded a deposit, and whose supplier refused it. */
async function refusedDeposit(reason = 'nothing landed in our GCash'): Promise<Booking> {
  const supplier = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'History Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier],
  );
  const couple = await newUser();
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [
    eventId,
    couple,
  ]);
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, deposit_paid_php, deposit_recorded_at)
     VALUES ($1,'photographer','History Studio','contracted',$2, 10000, NOW()) RETURNING vendor_id`,
    [eventId, v.rows[0]!.vendor_profile_id],
  );
  const eventVendorId = ev.rows[0]!.vendor_id;
  await setAuthUid(db, supplier);
  const r = await db.query<{ out: { status: string } }>(`SELECT public.reject_vendor_deposit($1,$2) AS out`, [
    eventVendorId,
    reason,
  ]);
  await setAuthUid(db, null);
  assert.equal(r.rows[0]!.out.status, 'ok', 'seed: the refusal did not take');
  return { eventId, eventVendorId, supplier, couple };
}

/** Run as a signed-in user under the real `authenticated` role; commit on success. */
async function as<T>(uid: string, fn: () => Promise<T>): Promise<{ value?: T; error?: string }> {
  await setAuthUid(db, uid);
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE authenticated');
    const value = await fn();
    await db.exec('COMMIT');
    return { value };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { error: (e as Error).message };
  } finally {
    await setAuthUid(db, null);
  }
}

/** The re-send, the way recordDeposit calls it: server-side, with who re-sent. */
async function resend(b: Booking): Promise<string> {
  const r = await db.query<{ out: { status: string } }>(`SELECT public.resend_vendor_deposit($1,$2) AS out`, [
    b.eventVendorId,
    b.couple,
  ]);
  return r.rows[0]!.out.status;
}

type History = {
  reason: string | null;
  refused_by_user_id: string | null;
  dispute_outcome: string | null;
  dispute_note: string | null;
  closed_by: string;
  closed_by_user_id: string | null;
  vendor_name: string | null;
};
async function history(eventVendorId: string): Promise<History[]> {
  const r = await db.query<History>(
    `SELECT reason, refused_by_user_id, dispute_outcome, dispute_note, closed_by, closed_by_user_id, vendor_name
       FROM public.event_vendor_deposit_refusals WHERE event_vendor_id = $1 ORDER BY closed_at, refusal_id`,
    [eventVendorId],
  );
  return r.rows;
}
async function booking(eventVendorId: string) {
  const r = await db.query<{ declined: string | null; reason: string | null; outcome: string | null; acked: string | null }>(
    `SELECT deposit_declined_at AS declined, deposit_decline_reason AS reason,
            deposit_dispute_outcome AS outcome, deposit_acknowledged_at AS acked
       FROM public.event_vendors WHERE vendor_id = $1`,
    [eventVendorId],
  );
  return r.rows[0]!;
}

const CLEAR_REFUSAL = `UPDATE public.event_vendors
    SET deposit_declined_at = NULL, deposit_decline_reason = NULL, deposit_declined_by_user_id = NULL
  WHERE vendor_id = $1`;

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

/* ── 1 · a session can no longer erase it ─────────────────────────────── */

test('ERASURE · a couple cannot clear the refusal or the ruling off their booking', async () => {
  const b = await refusedDeposit();
  assert.match((await as(b.couple, () => db.query(CLEAR_REFUSAL, [b.eventVendorId]))).error ?? '', /vendor-set only/);
  const one = await as(b.couple, () =>
    db.query(`UPDATE public.event_vendors SET deposit_decline_reason = NULL WHERE vendor_id = $1`, [b.eventVendorId]),
  );
  assert.match(one.error ?? '', /vendor-set only/, 'one column at a time too');

  const admin = await newAdmin();
  await setAuthUid(db, admin);
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received','no such transfer')`, [b.eventVendorId]);
  await setAuthUid(db, null);
  const ruling = await as(b.couple, () =>
    db.query(
      `UPDATE public.event_vendors SET deposit_dispute_settled_at = NULL, deposit_dispute_outcome = NULL,
              deposit_dispute_note = NULL, deposit_dispute_settled_by_user_id = NULL
        WHERE vendor_id = $1`,
      [b.eventVendorId],
    ),
  );
  assert.match(ruling.error ?? '', /Setnayan-set only/);
  const row = await booking(b.eventVendorId);
  assert.ok(row.declined, 'the refusal survived');
  assert.equal(row.outcome, 'not_received', 'the ruling survived');
  assert.equal((await history(b.eventVendorId)).length, 0, 'nothing ended, so nothing was archived');
});

test('NEUTRALISATION · put the old "clearing is allowed" clauses back and the couple\'s clear lands', async () => {
  const b = await refusedDeposit();
  const def = (
    await db.query<{ d: string }>(`SELECT pg_get_functiondef('public.guard_event_vendor_deposit_ack()'::regprocedure) AS d`)
  ).rows[0]!.d;
  let permissive = def;
  for (const col of ['deposit_declined_at', 'deposit_decline_reason', 'deposit_declined_by_user_id']) {
    const strict = `NEW.${col} IS DISTINCT FROM OLD.${col}`;
    assert.ok(permissive.includes(strict), `the live guard no longer reads "${strict}" — re-derive this`);
    permissive = permissive.replace(strict, `(${strict} AND NEW.${col} IS NOT NULL)`);
  }
  await setAuthUid(db, b.couple);
  await db.exec('BEGIN');
  try {
    await db.exec(permissive);
    await db.exec('SET LOCAL ROLE authenticated');
    await db.query(CLEAR_REFUSAL, [b.eventVendorId]);
    await db.exec('RESET ROLE');
    assert.equal((await booking(b.eventVendorId)).declined, null, 'with the old guard, the couple erases the refusal');
  } finally {
    await db.exec('ROLLBACK');
    await setAuthUid(db, null);
  }
  assert.ok((await booking(b.eventVendorId)).declined, 'rolled back');
});

/* ── 2 · the re-send keeps working — and the history keeps what it cleared ── */

test('THE RE-SEND · clears the refusal and the ruling, and the history keeps both, with who re-sent', async () => {
  const b = await refusedDeposit('nothing landed in our GCash');
  const admin = await newAdmin();
  await setAuthUid(db, admin);
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'not_received','no transfer on the statement')`, [
    b.eventVendorId,
  ]);
  await setAuthUid(db, null);

  assert.equal(await resend(b), 'ok');
  const row = await booking(b.eventVendorId);
  assert.equal(row.declined, null, 'the question is back with the supplier');
  assert.equal(row.outcome, null, 'and the old ruling no longer sits on the row');

  assert.deepEqual(await history(b.eventVendorId), [
    {
      reason: 'nothing landed in our GCash',
      refused_by_user_id: b.supplier,
      dispute_outcome: 'not_received',
      dispute_note: 'no transfer on the statement',
      closed_by: 'couple_resent',
      closed_by_user_id: b.couple,
      vendor_name: 'History Studio',
    },
  ]);

  // …and a SECOND refusal is a fresh question, not one that inherits the ruling.
  await setAuthUid(db, b.supplier);
  const again = await db.query<{ out: { status: string } }>(`SELECT public.reject_vendor_deposit($1,'still nothing') AS out`, [
    b.eventVendorId,
  ]);
  await setAuthUid(db, null);
  assert.equal(again.rows[0]!.out.status, 'ok');
  assert.equal((await booking(b.eventVendorId)).outcome, null);
});

test('a re-send with nothing to clear writes nothing', async () => {
  const b = await refusedDeposit();
  await setAuthUid(db, b.supplier);
  await db.query(`SELECT public.acknowledge_vendor_deposit($1)`, [b.eventVendorId]);
  await setAuthUid(db, null);
  const before = (await history(b.eventVendorId)).length;
  assert.equal(await resend(b), 'no_refusal');
  assert.equal((await history(b.eventVendorId)).length, before, 'no second row');
});

/* ── 3 · every other way a refusal ends is recorded too ─────────────────── */

test('the supplier confirming after all is recorded as supplier_confirmed', async () => {
  const b = await refusedDeposit('not yet');
  await setAuthUid(db, b.supplier);
  await db.query(`SELECT public.acknowledge_vendor_deposit($1)`, [b.eventVendorId]);
  await setAuthUid(db, null);
  const h = await history(b.eventVendorId);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.closed_by, 'supplier_confirmed');
  assert.equal(h[0]!.reason, 'not yet');
  assert.equal(h[0]!.closed_by_user_id, b.supplier);
});

test('Setnayan ruling "the payment stands" is recorded with the ruling', async () => {
  const b = await refusedDeposit('never saw it');
  const admin = await newAdmin();
  await setAuthUid(db, admin);
  await db.query(`SELECT public.settle_vendor_deposit_dispute($1,'payment_stands','bank shows it on 3 Sep')`, [
    b.eventVendorId,
  ]);
  await setAuthUid(db, null);
  const h = await history(b.eventVendorId);
  assert.equal(h.length, 1);
  assert.deepEqual(
    { closed_by: h[0]!.closed_by, outcome: h[0]!.dispute_outcome, note: h[0]!.dispute_note, reason: h[0]!.reason },
    { closed_by: 'setnayan_ruled_it_stands', outcome: 'payment_stands', note: 'bank shows it on 3 Sep', reason: 'never saw it' },
  );
});

test('the history outlives its booking — deleting the row archives the open refusal', async () => {
  const b = await refusedDeposit('gone');
  await db.query(`DELETE FROM public.event_vendors WHERE vendor_id = $1`, [b.eventVendorId]);
  const h = await history(b.eventVendorId);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.closed_by, 'booking_deleted');
  assert.equal(h[0]!.reason, 'gone');
});

test('a session cannot forge how a refusal ended — only the server-side re-send ever reads "couple_resent"', async () => {
  // A supplier who tries to label their own acknowledgement as the couple's
  // re-send (any session may call set_config) gets exactly what they did.
  const b = await refusedDeposit();
  await setAuthUid(db, b.supplier);
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE authenticated');
    await db.query(`SELECT set_config('setnayan.deposit_refusal_closed_by', 'couple_resent', true)`);
    await db.query(`SELECT set_config('setnayan.deposit_refusal_closed_by_user', $1, true)`, [b.couple]);
    await db.query(`SELECT public.acknowledge_vendor_deposit($1)`, [b.eventVendorId]);
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  } finally {
    await setAuthUid(db, null);
  }
  const h = await history(b.eventVendorId);
  assert.equal(h.length, 1);
  assert.equal(h[0]!.closed_by, 'supplier_confirmed');
  assert.equal(h[0]!.closed_by_user_id, b.supplier, 'the closer is the caller\'s own token, not a value they set');
});

test('the re-send is ONE history row — its own write and the trigger\'s backstop never both land', async () => {
  const b = await refusedDeposit();
  assert.equal(await resend(b), 'ok');
  const h = await history(b.eventVendorId);
  assert.equal(h.length, 1, 'the trigger fired on the clear and wrote nothing');
  assert.equal(h[0]!.closed_by, 'couple_resent');
});

/* ── 4 · who may touch any of it ────────────────────────────────────────── */

test('no session reads or writes the history, and only the server may re-send', async () => {
  const b = await refusedDeposit();
  for (const role of ['anon', 'authenticated'] as const) {
    if (role === 'authenticated') await setAuthUid(db, b.couple);
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(db.query(`SELECT * FROM public.event_vendor_deposit_refusals`), /permission denied/);
      await assert.rejects(
        db.query(
          `INSERT INTO public.event_vendor_deposit_refusals (event_vendor_id, refused_at, closed_by)
           VALUES ($1, NOW(), 'couple_resent')`,
          [b.eventVendorId],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query(`SELECT public.resend_vendor_deposit($1,$2)`, [b.eventVendorId, b.couple]),
        /permission denied/,
      );
    } finally {
      await db.exec('RESET ROLE');
      await setAuthUid(db, null);
    }
  }
  const grants = await db.query<{ fn: string; authed: boolean; svc: boolean }>(
    `SELECT p.proname AS fn,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('resend_vendor_deposit', 'archive_deposit_refusal')
      ORDER BY 1`,
  );
  assert.deepEqual(grants.rows, [
    { fn: 'archive_deposit_refusal', authed: false, svc: grants.rows[0]!.svc },
    { fn: 'resend_vendor_deposit', authed: false, svc: true },
  ]);
});
