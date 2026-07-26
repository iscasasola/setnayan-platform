/**
 * Chat "Lock this deal" IS the booking (Option A · owner 2026-07-24) — END-TO-END
 * DB verification of the WRITE PATH `bookVendorAtChatLock` drives (migrations
 * replayed). The TS core is thin I/O; the money-critical invariants it leans on
 * are SQL guards, asserted here against real SQL:
 *
 *   • the `event_vendors_require_verified_before_lock` trigger BLOCKS a chat lock
 *     (UPDATE considering→contracted) on an UNVERIFIED marketplace vendor;
 *   • PRICE PARITY — writing the NEGOTIATED total then opening the lock charge
 *     bills 5% of that EXACT number (not a stale pre-negotiation total);
 *   • CROSS-ENTRY IDEMPOTENCY — a chat re-lock after the vendor-page finalize
 *     (or vice-versa) reuses the one live charge → never a second charge;
 *   • off-platform chat lock (no marketplace link) → the flip succeeds but the
 *     fee RPC skips → zero charges.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

/** A VERIFIED (marketplace-linked, claimed) vendor identity. */
async function newVendor(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state)
     VALUES ($1, 'Chat Lock Vendor', 'Manila', ARRAY['photography']::text[], 'verified')
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

/** An UNVERIFIED vendor identity (pending_review — not bookable). */
async function newUnverifiedVendor(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state)
     VALUES ($1, 'Unverified Vendor', 'Manila', ARRAY['photography']::text[], 'pending_review')
     RETURNING vendor_profile_id`,
    [u.rows[0]!.id],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** A pre-lock event_vendors row (status 'considering') — the chat-lock anchor. */
async function newConsideringPick(
  eventId: string,
  vendorProfileId: string | null,
  totalCostPhp: number | null,
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, 'photographer', 'Chat Lock Vendor', 'considering', $2, $3)
     RETURNING vendor_id`,
    [eventId, totalCostPhp, vendorProfileId],
  );
  // Since 20271009140000 only Setnayan-SOURCED clients are billable, and "no
  // thread" reads as a client the vendor brought (free). A chat-lock fixture is
  // by definition a couple who came through the marketplace and messaged.
  if (vendorProfileId) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vendorProfileId],
    );
  }
  return r.rows[0]!.vendor_id;
}

/** Exactly what bookVendorAtChatLock's FIRST-lock write does: set the negotiated
 *  total + flip to 'contracted' with the money-status precondition. Returns the
 *  number of rows updated. */
async function chatLockWrite(
  eventVendorId: string,
  eventId: string,
  negotiatedTotalPhp: number,
): Promise<number> {
  const r = await db.query(
    `UPDATE public.event_vendors
        SET status = 'contracted',
            total_cost_php = $3,
            selection_match_rank = 1,
            linked_vendor_profile_id = marketplace_vendor_id,
            updated_at = now()
      WHERE vendor_id = $1 AND event_id = $2
        AND status NOT IN ('deposit_paid','delivered','complete')`,
    [eventVendorId, eventId, negotiatedTotalPhp],
  );
  return r.affectedRows ?? 0;
}

type LockChargeResult = {
  skipped?: string;
  charge_id?: string;
  status?: string;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  booking_ordinal?: number;
  is_free?: boolean;
  reused?: boolean;
};

async function openLockCharge(eventVendorId: string): Promise<LockChargeResult> {
  const r = await db.query<{ result: LockChargeResult }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS result`,
    [eventVendorId],
  );
  return r.rows[0]!.result;
}

/** Push a vendor past free-5 so the NEXT booking is billable. */
async function warmPastFree5(vendorProfileId: string, label: string): Promise<void> {
  for (let i = 1; i <= 5; i++) {
    const evId = await newConsideringPick(await newEvent(`${label}-warm-${i}`), vendorProfileId, 10_000);
    await chatLockWrite(evId, (await db.query<{ event_id: string }>(
      `SELECT event_id FROM public.event_vendors WHERE vendor_id = $1`, [evId],
    )).rows[0]!.event_id, 10_000);
    await openLockCharge(evId);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('unverified marketplace vendor → chat lock is BLOCKED by the verified DB trigger', async () => {
  const vpid = await newUnverifiedVendor('unverified@chatlock.test');
  const eventId = await newEvent('unverified-chatlock');
  const evId = await newConsideringPick(eventId, vpid, 50_000);

  // The considering→contracted flip must RAISE (check_violation) — no lock.
  await assert.rejects(
    () => chatLockWrite(evId, eventId, 120_000),
    /vendor_not_verified/,
    'the trigger blocks a chat lock on an unverified vendor',
  );

  // Row untouched; nothing to charge.
  const row = await db.query<{ status: string; total_cost_php: string | null }>(
    `SELECT status, total_cost_php FROM public.event_vendors WHERE vendor_id = $1`, [evId],
  );
  assert.equal(row.rows[0]!.status, 'considering', 'stays considering');
  assert.equal(Number(row.rows[0]!.total_cost_php), 50_000, 'total untouched');
});

test('price parity: chat lock bills the TAPER on the NEGOTIATED total, not the stale one', async () => {
  const vpid = await newVendor('parity@chatlock.test');
  await warmPastFree5(vpid, 'parity');

  // Pre-lock pick carries an OLD ₱50,000 quote; the couple negotiated ₱120,000.
  const eventId = await newEvent('parity-6');
  const evId = await newConsideringPick(eventId, vpid, 50_000);

  const updated = await chatLockWrite(evId, eventId, 120_000);
  assert.equal(updated, 1, 'the lock write flipped exactly this row');

  const charge = await openLockCharge(evId);
  assert.equal(charge.is_free, false, '6th booking is billable');
  assert.equal(charge.status, 'pending');
  // Taper on the NEGOTIATED ₱120,000 = ₱5,000 + 1% of ₱20,000 = ₱5,200 = 520,000c
  // — NOT computed off the stale ₱50k.
  assert.equal(charge.computed_fee_centavos, 520_000, 'fee = taper on the negotiated total');
  assert.equal(charge.amount_charged_centavos, 520_000);

  // The charge base equals the exact number a thread would freeze
  // (agreed_price_centavos = round(negotiated * 100) = 12,000,000c).
  const base = await db.query<{ proposal_amount_centavos: number }>(
    `SELECT proposal_amount_centavos::int FROM public.booking_fee_charges WHERE charge_id = $1`,
    [charge.charge_id],
  );
  assert.equal(base.rows[0]!.proposal_amount_centavos, 12_000_000, 'charge base == frozen thread price');
});

test('cross entry-point: vendor-finalize then chat re-lock → ONE charge, never doubled', async () => {
  const vpid = await newVendor('crossentry@chatlock.test');
  await warmPastFree5(vpid, 'crossentry');

  // Entry point #1 — the vendor-page finalize contracts at ₱200,000 + charges.
  const eventId = await newEvent('crossentry-6');
  const evId = await newConsideringPick(eventId, vpid, 50_000);
  await chatLockWrite(evId, eventId, 200_000); // finalize's negotiated total
  const first = await openLockCharge(evId);
  assert.equal(first.reused, false, 'finalize mints the charge');
  assert.equal(first.computed_fee_centavos, 600_000, 'taper on ₱200,000 = ₱6,000');

  // Entry point #2 — the couple ALSO hits chat lock. bookVendorAtChatLock sees an
  // already-'contracted' row → refresh_fee_only → NO rewrite in the CORE. Here we
  // raw-write a NEW total to prove two guards at once: (a) the fee RPC still reuses
  // the ONE live charge (no second charge), and (b) the post-lock re-derive trigger
  // (migration 20270930120000) tracks the amended total IN PLACE — still one charge,
  // same id, its (pending, unpaid) amount re-derived to 5% of the new total.
  const rewritten = await chatLockWrite(evId, eventId, 999_999);
  assert.equal(rewritten, 1, 'raw update matched (core skips this; fee guard is the backstop)');
  const second = await openLockCharge(evId);
  assert.equal(second.reused, true, 're-lock reuses the live charge');
  assert.equal(second.charge_id, first.charge_id, 'same charge id — no second charge');
  assert.equal(
    second.computed_fee_centavos,
    1_399_999,
    'pending fee RE-DERIVED to the taper on ₱999,999 — not doubled, not stale',
  );

  const count = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges WHERE event_vendor_id = $1`, [evId],
  );
  assert.equal(count.rows[0]!.c, 1, 'exactly one charge across both entry points');
});

test('off-platform chat lock (no marketplace link) → flip succeeds, NO fee', async () => {
  const eventId = await newEvent('offplatform-chatlock');
  const evId = await newConsideringPick(eventId, null, 50_000); // marketplace_vendor_id NULL

  // The trigger skips off-platform rows → the flip commits.
  const updated = await chatLockWrite(evId, eventId, 120_000);
  assert.equal(updated, 1, 'off-platform lock commits');
  const row = await db.query<{ status: string }>(
    `SELECT status FROM public.event_vendors WHERE vendor_id = $1`, [evId],
  );
  assert.equal(row.rows[0]!.status, 'contracted');

  // But the fee RPC skips (no verified identity) → zero charges.
  const charge = await openLockCharge(evId);
  assert.equal(charge.skipped, 'not_verified_vendor');
  const count = await db.query<{ c: number }>(
    `SELECT count(*)::int c FROM public.booking_fee_charges WHERE event_vendor_id = $1`, [evId],
  );
  assert.equal(count.rows[0]!.c, 0, 'no charge for an off-platform chat lock');
});
