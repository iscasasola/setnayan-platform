import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readInChunks } from '@/lib/read-all-pages';
import { bookingFeeLockServiceKey } from '@/lib/booking-fee-lock';
import {
  eventAccessUnlocked,
  isFeeUnlocksEventEnabled,
  resolveEventAccessStage,
  type BookingFeeChargeFacts,
  type EventAccessDecision,
  type EventAccessStage,
} from '@/lib/event-access-stage';

/**
 * THE READ behind the fee gate — the DB-touching half of
 * `lib/event-access-stage.ts`, which holds the rule and stays pure.
 *
 * ── WHY THE ADMIN CLIENT ────────────────────────────────────────────────────
 * `booking_fee_charges` DOES carry a vendor-side SELECT policy
 * (`booking_fee_charges_vendor_read` · `vendor_profile_id IN
 * current_vendor_profile_ids()`), so a shop OWNER can read their own charges
 * through their own session. A TEAM MEMBER cannot — `current_vendor_profile_ids()`
 * is the team-row resolution and the charge belongs to the profile — and the
 * day-of console has a GRANTEE path where the caller is a crew member acting
 * for the shop. Reading through the caller's session would therefore return
 * ZERO ROWS for those two roles, silently, and RLS denial is indistinguishable
 * from "no fee". Zero rows would UNLOCK (fail open), so nobody would be harmed
 * — but the gate would be inert for exactly the people it is meant to cover.
 * So the read is service-role and scoped in SQL to the `vendorProfileId` the
 * caller already proved, the same shape `vendor-room-reads.ts` uses and for the
 * same reason.
 *
 * 🔒 THIS IS AN AUTHORIZATION READ. It returns a status, an amount and a due
 * date — no event content ever passes through here.
 *
 * ── FAIL OPEN, AND SAY SO ───────────────────────────────────────────────────
 * Every error path returns `{ kind: 'unreadable' }`, which
 * `eventAccessUnlocked` UNLOCKS, and logs through `logQueryError`. A supplier
 * is never locked out of a wedding because a SELECT was refused.
 */

/** The charge columns the rule needs. Nothing about the event, by design. */
const CHARGE_SELECT = 'charge_id, event_id, status, amount_charged_centavos, expires_at';

type ChargeRow = {
  charge_id: string;
  event_id: string;
  status: string | null;
  amount_charged_centavos: number | string | null;
  expires_at: string | null;
};

/**
 * The LIVE charge for one (shop × event), plus the `orders` row that bills it.
 *
 * ⚠ A shop can hold more than one charge row on one event over time (a failed
 * attempt does not block a fresh one — see
 * `booking_fee_charges_one_live_per_proposal`). The one that decides access is
 * the one that says money is owed: an unsettled row WINS over a settled one, so
 * a supplier who paid charge A and then had charge B re-derived by an amendment
 * is locked until B is settled too. Ordering by `created_at` alone would let a
 * stale settled row unlock a live bill.
 */
export async function readEventFeeCharge(
  vendorProfileId: string,
  eventId: string,
): Promise<BookingFeeChargeFacts> {
  const map = await readEventFeeCharges(vendorProfileId, [eventId]);
  return map.get(eventId) ?? { kind: 'none' };
}

/**
 * The same read for many events at once — one query for the whole Event Hub
 * list instead of one per row. Chunked (`IN_LIST_CHUNK`) because past ~600 ids
 * a single `in.()` is refused 400, which would make the gate unreadable — and
 * therefore inert — for exactly the busiest shops.
 */
export async function readEventFeeCharges(
  vendorProfileId: string,
  eventIds: readonly string[],
): Promise<Map<string, BookingFeeChargeFacts>> {
  const out = new Map<string, BookingFeeChargeFacts>();
  if (eventIds.length === 0) return out;
  // The gate is inert while the flag is off, so do not spend a query on it.
  if (!isFeeUnlocksEventEnabled()) {
    for (const id of eventIds) out.set(id, { kind: 'none' });
    return out;
  }

  const admin = createAdminClient();
  const unique = [...new Set(eventIds)];

  const { rows, error } = await readInChunks<ChargeRow>(unique, (chunk) =>
    admin
      .from('booking_fee_charges')
      .select(CHARGE_SELECT)
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', chunk),
  );

  if (error) {
    logQueryError('readEventFeeCharges.booking_fee_charges', error, {
      vendor_profile_id: vendorProfileId,
    });
    // 🚨 One refused chunk poisons the WHOLE answer, not just its own ids. A
    // per-chunk `unreadable` would be right, but the rows we DID read cannot be
    // trusted to be the live ones for ids we never asked about. Unreadable
    // unlocks, so this is the safe direction and it is logged above.
    for (const id of unique) out.set(id, { kind: 'unreadable' });
    return out;
  }

  // Pick the deciding row per event: an unsettled charge beats a settled one.
  const best = new Map<string, ChargeRow>();
  for (const r of rows) {
    const current = best.get(r.event_id);
    if (!current) {
      best.set(r.event_id, r);
      continue;
    }
    const rLocks = eventAccessUnlocked({
      charge: chargeFacts(r, null),
      enforced: true,
    }).unlocked === false;
    if (rLocks) best.set(r.event_id, r);
  }

  // The bill, so the locked screen's button goes to the right pay page. A
  // waived charge has no order and never will; a refused read here leaves the
  // orderId null, which degrades the CTA to the fees hub rather than the exact
  // bill — the supplier can still pay.
  const orderByCharge = await readFeeOrderIds(admin, [...best.values()].map((r) => r.charge_id));

  for (const id of unique) {
    const row = best.get(id);
    out.set(id, row ? chargeFacts(row, orderByCharge.get(row.charge_id) ?? null) : { kind: 'none' });
  }
  return out;
}

function chargeFacts(row: ChargeRow, orderId: string | null): BookingFeeChargeFacts {
  return {
    kind: 'charge',
    status: row.status ?? '',
    amountPhp: Math.max(0, Number(row.amount_charged_centavos ?? 0)) / 100,
    dueAt: row.expires_at,
    orderId,
  };
}

async function readFeeOrderIds(
  admin: SupabaseClient,
  chargeIds: readonly string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (chargeIds.length === 0) return out;
  const keys = chargeIds.map((id) => bookingFeeLockServiceKey(id));
  const byKey = new Map(chargeIds.map((id) => [bookingFeeLockServiceKey(id), id]));
  const { rows, error } = await readInChunks<{ order_id: string; service_key: string }>(
    keys,
    (chunk) => admin.from('orders').select('order_id, service_key').in('service_key', chunk),
  );
  // A refused read leaves every orderId null: the locked screen's button falls
  // back to the fees hub instead of the exact bill. Logged, never swallowed —
  // but it must NOT make the gate unreadable, because the CHARGE was read fine
  // and "we could not find your bill's URL" is not "you owe nothing".
  if (error) logQueryError('readEventFeeCharges.orders', error);
  for (const o of rows) {
    const chargeId = byKey.get(o.service_key);
    if (chargeId) out.set(chargeId, o.order_id);
  }
  return out;
}

export type EventFeeGate = {
  stage: EventAccessStage;
  access: EventAccessDecision;
};

/**
 * THE ONE CALL A SURFACE MAKES. Give it the shop and the event (and whether the
 * shop is booked, which every caller already knows), get back the stage and the
 * decision.
 *
 * `booked` defaults to TRUE because every current caller is already inside a
 * booked-only surface; pass it explicitly where the page renders for a supplier
 * who may only be quoting.
 */
export async function resolveEventFeeGate(
  vendorProfileId: string,
  eventId: string,
  opts?: { booked?: boolean },
): Promise<EventFeeGate> {
  const charge = await readEventFeeCharge(vendorProfileId, eventId);
  return resolveEventAccessStage({ booked: opts?.booked ?? true, charge });
}

/** `resolveEventFeeGate` for a list — one query for the whole Event Hub. */
export async function resolveEventFeeGates(
  vendorProfileId: string,
  eventIds: readonly string[],
  opts?: { booked?: boolean },
): Promise<Map<string, EventFeeGate>> {
  const charges = await readEventFeeCharges(vendorProfileId, eventIds);
  const out = new Map<string, EventFeeGate>();
  for (const [eventId, charge] of charges) {
    out.set(eventId, resolveEventAccessStage({ booked: opts?.booked ?? true, charge }));
  }
  return out;
}

/**
 * THE SERVER-ACTION ARM OF THE GATE.
 *
 * 🔑 A UI THAT HIDES A BUTTON IS NOT A GATE. Every per-event supplier action
 * already refuses a shop that is not booked ("You are not booked on this
 * event."); this is the same refusal for a shop that is booked and has not
 * settled the fee, and it says something DIFFERENT, because "not booked" would
 * be a lie a supplier could not act on.
 *
 * Returns the message to refuse with, or `null` when the action may proceed —
 * which is what it returns for a settled fee, for no fee at all, for an
 * UNREADABLE fee, and always while the flag is off.
 */
export const FEE_LOCKED_ACTION_MESSAGE =
  'Settle your Setnayan booking fee to unlock this event. You can pay it under Booking fees — your conversation with the couple stays open.';

export async function eventFeeBlocksAction(
  vendorProfileId: string,
  eventId: string,
): Promise<string | null> {
  const gate = await resolveEventFeeGate(vendorProfileId, eventId);
  return gate.stage === 'unlocked' ? null : FEE_LOCKED_ACTION_MESSAGE;
}
