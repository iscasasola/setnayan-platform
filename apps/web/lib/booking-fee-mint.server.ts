import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import {
  collectBookingFeeAtLock,
  resolveFeeAnchorRowId,
  type CollectBookingFeeResult,
} from '@/lib/booking-fee-lock.server';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * THE ONE PLACE A BOOKING FEE IS MADE.
 *
 * ⚖ OWNER, 2026-10-12 — "APPROVE ALL: THE BOOKING-FEE QUESTIONS (14)", answer 1:
 * *the fee is CREATED at the supplier's YES ("no handshake, no access"); it
 * supersedes the 2026-07-27 ruling 5 timing — at launch it is waived at that
 * same moment.* (corpus DECISION_LOG 2026-10-12, commit 81292dc.)
 *
 * Until this file the fee was made only when the supplier ACKNOWLEDGED THE
 * COUPLE'S FIRST PAYMENT (`runDepositAcknowledgedEffects`). So a booked shop
 * held the event — "no charge" counted as unlocked — from its yes until a
 * payment, and forever on the paths that never reach an acknowledgement (a
 * Locked-QR claim, an admin dispute settlement).
 *
 * ── THE HANDSHAKES — every door calls THIS, nothing else calls the collector ─
 *   · `supplier_yes`         — `vendorAgreeToLock`, the yes to a couple's ask.
 *   · `locked_qr_claim`      — `claimLockedQr`: the supplier's own printed QR IS
 *                              their yes; the couple's claim completes it.
 *   · `deposit_acknowledged` — `runDepositAcknowledgedEffects`: the supplier
 *                              confirming a payment is a yes too, and on the
 *                              paths with no ask (a direct lock while the
 *                              handshake flag is off) it is the FIRST one.
 *   · `catch_up`             — the render-time sweep below, for a handshake
 *                              made before this shipped, or whose mint failed.
 * `lib/booking-fee-single-trigger.test.ts` keeps the collector to this file and
 * the door set to exactly these.
 *
 * 🔑 MORE THAN ONE DOOR IS NOT DOUBLE BILLING. `booking_fee_open_lock_charge`
 * opens at most ONE live primary charge per booking (a second call returns the
 * same charge, `reused:true`), and the bill is keyed on that charge by a unique
 * index. The yes makes the fee; the acknowledgement later finds it made.
 *
 * ── A WAIVER SETTLES AT THE SAME INSTANT, SO IT HOLDS THE DATE THEN ─────────
 * A paid fee holds the supplier's date (owner 2026-09-18) when the admin
 * approves the payment (`lib/sku-activation.ts`). A WAIVED one — first five,
 * a free window, a supplier's own client — is settled the moment it is made,
 * and `vendor_hold_date_on_fee_settled` already counts it settled; nothing
 * called it. It is called here. The function itself refuses an unsettled or a
 * cancelled booking, so calling it on every outcome with a charge is safe.
 *
 * ── CONTRACT ─────────────────────────────────────────────────────────────
 * • NEVER throws. The yes / the claim / the acknowledgement is already
 *   committed; nothing here may undo it.
 * • `admin` must be the service-role client. The collector writes the bill
 *   through the money writer, which refuses the dev anon-key fallback.
 */
export type BookingFeeMintDoor =
  | 'supplier_yes'
  | 'locked_qr_claim'
  | 'deposit_acknowledged'
  | 'catch_up';

export type BookingFeeMintOutcome = {
  door: BookingFeeMintDoor;
  eventVendorId: string;
  /** The money row; NULL ⇒ nothing is billed (covered row, archived, orphaned). */
  anchorId: string | null;
  /** Set only when `anchorId` is NULL because a read was REFUSED. */
  anchorUnreadable: string | null;
  feeEnabled: boolean;
  fee: CollectBookingFeeResult | null;
  /** The date-hold answer for a waived (settled) charge, or null. */
  hold: string | null;
  thrown: string | null;
};

/** Collector outcomes whose charge is settled the instant it is made. */
const SETTLED_AT_MINT: ReadonlySet<CollectBookingFeeResult['status']> = new Set([
  'free',
  'zero_fee',
]);

export async function mintBookingFeeForBooking(
  admin: SupabaseClient,
  args: { eventVendorId: string; door: BookingFeeMintDoor },
): Promise<BookingFeeMintOutcome> {
  const outcome: BookingFeeMintOutcome = {
    door: args.door,
    eventVendorId: args.eventVendorId,
    anchorId: null,
    anchorUnreadable: null,
    feeEnabled: isBookingFeeEnabled(),
    fee: null,
    hold: null,
    thrown: null,
  };
  try {
    // The MONEY ROW first. A package's cascade rows can reach a door, and
    // billing one would freeze a ledger ordinal on a row that never carries
    // money. NULL ⇒ bill nothing.
    outcome.anchorId = await resolveFeeAnchorRowId(admin, args.eventVendorId, (why) => {
      outcome.anchorUnreadable = why;
    });
    if (!outcome.anchorId || !outcome.feeEnabled) return outcome;

    outcome.fee = await collectBookingFeeAtLock(createMoneyWriterClient(), {
      eventVendorId: outcome.anchorId,
    });

    if (SETTLED_AT_MINT.has(outcome.fee.status) && 'chargeId' in outcome.fee) {
      const { data, error } = await admin.rpc('vendor_hold_date_on_fee_settled', {
        p_charge_id: outcome.fee.chargeId,
      });
      if (error) {
        logQueryError('booking-fee-mint.hold', error, { chargeId: outcome.fee.chargeId });
        outcome.hold = `error:${error.message}`;
      } else {
        const r = (data ?? {}) as { held?: boolean; skipped?: string };
        outcome.hold = r.held ? 'held' : `skipped:${r.skipped ?? 'unknown'}`;
      }
    }
  } catch (e) {
    outcome.thrown = e instanceof Error ? e.message : String(e);
  }
  recordMint(outcome);
  return outcome;
}

/** The fee answers that need a human. Everything else is the rules working. */
const MINT_FINE: ReadonlySet<string> = new Set([
  'free',
  'zero_fee',
  'ordered',
  'order_exists',
  'already_billed',
]);

function recordMint(o: BookingFeeMintOutcome): void {
  try {
    const fee = o.fee
      ? 'reason' in o.fee && o.fee.reason
        ? `${o.fee.status}:${o.fee.reason}`
        : o.fee.status
      : o.feeEnabled
        ? 'not-attempted'
        : 'off';
    const line =
      `[booking-fee-mint] door=${o.door} event_vendor=${o.eventVendorId} ` +
      `anchor=${o.anchorId ?? 'none'} fee=${fee} hold=${o.hold ?? 'n/a'}`;
    const fine =
      !o.thrown && !o.anchorUnreadable && (!o.fee || MINT_FINE.has(o.fee.status) ||
        (o.fee.status === 'skipped' && o.fee.reason === 'not_verified_vendor'));
    if (fine) console.info(line);
    else console.error(`${line} — ATTENTION${o.thrown ? `: threw ${o.thrown}` : ''}${o.anchorUnreadable ? `: ${o.anchorUnreadable}` : ''}`);
  } catch {
    /* recording must never break the booking */
  }
}

/** How many handshaken bookings one render may look at, and mint for. */
const CATCH_UP_SCAN_LIMIT = 200;
const CATCH_UP_MAX_MINTS = 10;

/** Booking statuses the lock RPC will charge (`booking_fee_open_lock_charge`). */
const BOOKED_STATUSES = ['contracted', 'deposit_paid', 'delivered', 'complete'] as const;

/** Every live charge status — a booking holding one of these is already made. */
const LIVE_CHARGE_STATUSES = [
  'pending',
  'paid',
  'waived_import',
  'waived_free5',
  'waived_promo',
  // The launch offer (migration 20271268832636) — a made, ₱0 charge.
  'waived_launch',
] as const;

/**
 * CRON-FREE CATCH-UP for the yes — the house pattern beside
 * `maybeCatchUpAcknowledgedDeposits`, fired post-response from the supplier
 * dashboard layout for the signed-in supplier's OWN bookings only.
 *
 * Finds bookings this shop has HANDSHAKEN — agreed (`lock_request_state =
 * 'agreed'`, which the couple cannot forge) or a claimed Locked QR this shop
 * issued — that are still booked and carry no live charge, and makes the fee.
 * Every booking agreed before this shipped is that shape, and so is a yes whose
 * mint failed mid-way.
 *
 * 🔒 IT NEVER MINTS ON A BOOKING NOBODY AGREED TO. A couple can still write
 * `status = 'contracted'` on their own row (audit C7); a sweep that read status
 * alone would bill a supplier for a booking they never said yes to. The two
 * handshake markers are the only entry, exactly the two `admitRoomBookings`
 * admits a shop on.
 */
export async function maybeCatchUpHandshakesWithoutFee(userId: string): Promise<void> {
  if (!isBookingFeeEnabled()) return;
  try {
    const admin = createAdminClient();
    const { data: profiles, error: pErr } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', userId);
    if (pErr) {
      logQueryError('booking-fee-mint.catchUp.profiles', pErr);
      return;
    }
    const profileIds = ((profiles ?? []) as Array<{ vendor_profile_id: string }>).map(
      (p) => p.vendor_profile_id,
    );
    if (profileIds.length === 0) return;

    const { data: agreed, error: aErr } = await admin
      .from('event_vendors')
      .select('vendor_id')
      .in('marketplace_vendor_id', profileIds)
      .eq('lock_request_state', 'agreed')
      .in('status', [...BOOKED_STATUSES])
      .is('archived_at', null)
      .or('package_role.is.null,package_role.neq.covered')
      .order('created_at', { ascending: true })
      .limit(CATCH_UP_SCAN_LIMIT);
    if (aErr) {
      logQueryError('booking-fee-mint.catchUp.agreed', aErr);
      return;
    }

    const { data: claimed, error: qErr } = await admin
      .from('vendor_locked_qr_tokens')
      .select('claimed_event_vendor_id')
      .in('vendor_profile_id', profileIds)
      .eq('status', 'claimed')
      .not('claimed_event_vendor_id', 'is', null)
      .limit(CATCH_UP_SCAN_LIMIT);
    if (qErr) logQueryError('booking-fee-mint.catchUp.claimedQr', qErr);
    const claimedIds = ((claimed ?? []) as Array<{ claimed_event_vendor_id: string | null }>)
      .map((t) => t.claimed_event_vendor_id)
      .filter((id): id is string => !!id);

    // A claimed QR's row must still be booked and not archived to be billable.
    let claimedBooked: string[] = [];
    if (claimedIds.length > 0) {
      const { data: rows, error } = await admin
        .from('event_vendors')
        .select('vendor_id')
        .in('vendor_id', claimedIds)
        .in('status', [...BOOKED_STATUSES])
        .is('archived_at', null);
      if (error) logQueryError('booking-fee-mint.catchUp.claimedRows', error);
      claimedBooked = ((rows ?? []) as Array<{ vendor_id: string }>).map((r) => r.vendor_id);
    }

    const candidates = Array.from(
      new Set([
        ...((agreed ?? []) as Array<{ vendor_id: string }>).map((r) => r.vendor_id),
        ...claimedBooked,
      ]),
    );
    if (candidates.length === 0) return;

    const { data: charges, error: cErr } = await admin
      .from('booking_fee_charges')
      .select('event_vendor_id')
      .in('event_vendor_id', candidates)
      .in('status', [...LIVE_CHARGE_STATUSES]);
    // ⚠ A refused read is NOT "no charges" — read that way it would re-run the
    // mint for every booking. The RPC would reuse each charge, so nothing would
    // double-bill, but it is pointless work on a failing database. Stop.
    if (cErr) {
      logQueryError('booking-fee-mint.catchUp.charges', cErr);
      return;
    }
    const charged = new Set(
      ((charges ?? []) as Array<{ event_vendor_id: string | null }>)
        .map((c) => c.event_vendor_id)
        .filter((id): id is string => !!id),
    );

    let runs = 0;
    for (const eventVendorId of candidates) {
      if (charged.has(eventVendorId)) continue;
      if (runs >= CATCH_UP_MAX_MINTS) break;
      runs += 1;
      await mintBookingFeeForBooking(admin, { eventVendorId, door: 'catch_up' });
    }
  } catch (e) {
    console.error('[booking-fee-mint] catch-up sweep failed:', e);
  }
}
