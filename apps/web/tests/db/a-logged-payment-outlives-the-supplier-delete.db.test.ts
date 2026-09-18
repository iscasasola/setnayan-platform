/**
 * A LOGGED PAYMENT OUTLIVES THE SUPPLIER DELETE — SUP-67 (BUD-8), 2026-09-18.
 *
 * 🚨 THE BUG. The budget page's "record a cost" door (`recordWithSupplier` in
 * `app/dashboard/[eventId]/budget/cost-actions.ts`) creates the supplier at
 * `status = 'contracted'` and writes what was already handed over as an
 * `event_vendor_payments` row. Both couple-side delete paths —
 * `deleteVendor()` and `cancelBookingAsHost()` — guarded with a STATUS LIST
 * (`deposit_paid / delivered / complete`) plus the legacy `deposit_paid_php`
 * field, and this door sets neither. `event_vendor_payments` hangs off
 * `event_vendors` with `ON DELETE CASCADE`, so removing that supplier silently
 * destroyed the record of real money.
 *
 * 🔑 THE FIX IS THE PROPERTY, NOT A LONGER LIST. A delete is refused whenever
 * ANY payment row exists for the supplier — whatever the status says, whichever
 * action issued it. The list is exactly what drifted; a fifth status would have
 * drifted the same way. The refusal lives in the database
 * (`event_vendors_refuse_delete_with_payments`) so a new delete path cannot
 * forget it; the actions ask first only so the couple is told why in words.
 *
 * Every write below goes through a REAL couple session under RLS — the same
 * statements the server actions issue — not as the table owner.
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
const uniq = () => `sup67-${++seq}-${Date.now()}`;

async function reset() {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}
async function asUser(uid: string) {
  await reset();
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}

/** A couple who owns one wedding. Seeded as the owner; everything after is a session. */
async function newCouple(): Promise<{ couple: string; eventId: string }> {
  await reset();
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const couple = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1,'wedding','civil','garden') RETURNING event_id`,
    [`Wedding ${uniq()}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, couple],
  );
  return { couple, eventId };
}

/**
 * The "record a cost" door, statement for statement: the supplier row LOCKED
 * at `contracted`, the cost as a line item, and what was already paid as a
 * payment row. `deposit_paid_php` is untouched — exactly as the action leaves it.
 */
async function recordCostWithSupplier(
  couple: string,
  eventId: string,
  paidPhp: number,
): Promise<string> {
  await asUser(couple);
  const v = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, vendor_name, category, status, covers_plan_groups, source)
     VALUES ($1, 'Tita Baby''s Catering', 'misc', 'contracted', ARRAY['catering'], 'host_manual')
     RETURNING vendor_id`,
    [eventId],
  );
  const vendorId = v.rows[0]!.vendor_id;
  await db.query(
    `INSERT INTO public.event_vendor_line_items (event_id, vendor_id, label, amount_php)
     VALUES ($1, $2, 'Catering for 150', 180000)`,
    [eventId, vendorId],
  );
  if (paidPhp > 0) {
    await db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method)
       VALUES ($1, $2, $3, 'Recorded on the budget page')`,
      [eventId, vendorId, paidPhp],
    );
  }
  await reset();
  return vendorId;
}

/** Counted as the table owner, so RLS cannot hide a row that survived. */
async function paymentsFor(vendorId: string): Promise<number> {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_vendor_payments WHERE vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!.n;
}
async function supplierExists(vendorId: string): Promise<boolean> {
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!.n === 1;
}

/** The delete both `deleteVendor` and `cancelBookingAsHost` issue, as the couple. */
async function coupleDeletesSupplier(
  couple: string,
  eventId: string,
  vendorId: string,
): Promise<string | null> {
  await asUser(couple);
  let error: string | null = null;
  try {
    await db.query(`DELETE FROM public.event_vendors WHERE vendor_id = $1 AND event_id = $2`, [
      vendorId,
      eventId,
    ]);
  } catch (e) {
    error = (e as Error).message;
  }
  await reset();
  return error;
}

test('SUP-67: deleting a recorded-cost supplier does not destroy the payment logged against it', async () => {
  const { couple, eventId } = await newCouple();
  const vendorId = await recordCostWithSupplier(couple, eventId, 20000);
  assert.equal(await paymentsFor(vendorId), 1, 'fixture: the payment row was not logged');

  const error = await coupleDeletesSupplier(couple, eventId, vendorId);

  const left = await paymentsFor(vendorId);
  assert.equal(
    left,
    1,
    `The couple's ₱20,000 payment row was destroyed by deleting its supplier (payments left: ${left}).`,
  );
  assert.ok(await supplierExists(vendorId), 'The supplier row is gone while its payment was kept.');
  // The refusal is the database's, and it names the reason the action translates.
  assert.match(error ?? '', /logged payment/i, `expected a refusal naming the payment, got: ${error}`);
});

test('the refusal is by the property, not the status — every status with a payment is kept', async () => {
  // The list that drifted. Each of these is a status a payment row can sit under;
  // none of them may decide whether the money survives.
  for (const status of ['considering', 'shortlisted', 'contracted', 'deposit_paid']) {
    const { couple, eventId } = await newCouple();
    const vendorId = await recordCostWithSupplier(couple, eventId, 5000);
    await db.query(`UPDATE public.event_vendors SET status = $2::vendor_status WHERE vendor_id = $1`, [
      vendorId,
      status,
    ]);
    await coupleDeletesSupplier(couple, eventId, vendorId);
    assert.equal(await paymentsFor(vendorId), 1, `status '${status}': the payment was destroyed`);
  }
});

test('a supplier with no payment still deletes — the guard asks about money, nothing else', async () => {
  const { couple, eventId } = await newCouple();
  const vendorId = await recordCostWithSupplier(couple, eventId, 0);

  const error = await coupleDeletesSupplier(couple, eventId, vendorId);

  assert.equal(error, null, `a payment-free supplier was refused: ${error}`);
  assert.equal(await supplierExists(vendorId), false, 'the payment-free supplier was not deleted');
});

test('removing the payment first is the way through — then the supplier deletes', async () => {
  const { couple, eventId } = await newCouple();
  const vendorId = await recordCostWithSupplier(couple, eventId, 7500);

  // `deletePayment` on the budget page: the couple removes the money on purpose.
  await asUser(couple);
  await db.query(`DELETE FROM public.event_vendor_payments WHERE vendor_id = $1 AND event_id = $2`, [
    vendorId,
    eventId,
  ]);
  await reset();

  const error = await coupleDeletesSupplier(couple, eventId, vendorId);
  assert.equal(error, null, `the supplier stayed undeletable after its payment was removed: ${error}`);
  assert.equal(await supplierExists(vendorId), false);
});

test('deleting the whole celebration is not blocked by a recorded payment', async () => {
  /* The guard must not resurrect the bug `the_money_outlives_the_event` fixed:
     a couple who deletes their event takes a typed-in supplier and its payment
     with it (there is no supplier record to keep). The cascade from `events`
     must pass through. */
  const { couple, eventId } = await newCouple();
  const vendorId = await recordCostWithSupplier(couple, eventId, 3000);

  let failure: string | null = null;
  try {
    await db.query(`DELETE FROM public.events WHERE event_id = $1`, [eventId]);
  } catch (e) {
    failure = (e as Error).message;
  }
  assert.equal(failure, null, `the couple can no longer delete their celebration: ${failure}`);
  assert.equal(await supplierExists(vendorId), false);
});
