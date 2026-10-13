import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readInChunks } from '@/lib/read-all-pages';
import {
  COUPLE_MONEY_NOT_YET,
  coupleBookingStanding,
  decidingCoupleFee,
  type CoupleBookingStanding,
  type CoupleFeeFact,
} from '@/lib/couple-booked-and-settled';

/**
 * THE READ behind `coupleBookingStanding` — for many bookings at once.
 *
 * Service-role, deliberately: `booking_fee_charges` has NO couple-side policy
 * (the supplier's fee is not the couple's business, R12), so the couple's own
 * session reads zero rows and would see every billed booking as settled. This
 * returns only a STANDING per booking — never a status, an amount or a word
 * about a fee — so nothing about the fee can reach a couple surface through it.
 *
 * The caller has already proved the viewer may see these bookings (they are
 * read from the couple's own event under their own RLS); this only adds the
 * one fact the couple's session cannot read.
 *
 * ⚠ FAIL OPEN. Any refused read answers `booked` for the bookings it could not
 * judge, through the rule's own `unreadable` arm — a couple is never told their
 * booked supplier is not booked because a query failed.
 */
export type CoupleBookingRead = {
  standing: CoupleBookingStanding;
  /** `marketplace_vendor_id` is set. NULL when the booking row itself was unreadable. */
  onPlatform: boolean | null;
};

export async function readCoupleBookingStandings(
  admin: SupabaseClient,
  eventVendorIds: readonly string[],
): Promise<Map<string, CoupleBookingRead>> {
  const out = new Map<string, CoupleBookingRead>();
  const ids = [...new Set(eventVendorIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const feeMinting = isBookingFeeEnabled();

  const rows = await readInChunks<{
    vendor_id: string;
    status: string | null;
    marketplace_vendor_id: string | null;
    lock_request_state: string | null;
    deposit_acknowledged_at: string | null;
  }>(ids, (part) =>
    admin
      .from('event_vendors')
      .select('vendor_id, status, marketplace_vendor_id, lock_request_state, deposit_acknowledged_at')
      .in('vendor_id', part),
  );
  if (rows.error) {
    logQueryError('couple-booked-and-settled.bookings', rows.error);
    for (const id of ids) out.set(id, { standing: 'booked', onPlatform: null });
    return out;
  }

  const fees = new Map<string, string[]>();
  let feeUnreadable = false;
  const claimed = new Set<string>();
  if (feeMinting) {
    const charges = await readInChunks<{ event_vendor_id: string | null; status: string }>(ids, (part) =>
      admin
        .from('booking_fee_charges')
        .select('event_vendor_id, status')
        .eq('kind', 'primary')
        .in('event_vendor_id', part),
    );
    if (charges.error) {
      logQueryError('couple-booked-and-settled.charges', charges.error);
      feeUnreadable = true;
    }
    for (const c of charges.rows) {
      if (!c.event_vendor_id) continue;
      fees.set(c.event_vendor_id, [...(fees.get(c.event_vendor_id) ?? []), c.status]);
    }
    const tokens = await readInChunks<{ claimed_event_vendor_id: string | null }>(ids, (part) =>
      admin
        .from('vendor_locked_qr_tokens')
        .select('claimed_event_vendor_id')
        .eq('status', 'claimed')
        .in('claimed_event_vendor_id', part),
    );
    if (tokens.error) logQueryError('couple-booked-and-settled.qr', tokens.error);
    for (const t of tokens.rows) if (t.claimed_event_vendor_id) claimed.add(t.claimed_event_vendor_id);
  }

  for (const r of rows.rows) {
    const fee: CoupleFeeFact = feeUnreadable
      ? { kind: 'unreadable' }
      : decidingCoupleFee(fees.get(r.vendor_id) ?? []);
    out.set(r.vendor_id, {
      onPlatform: !!r.marketplace_vendor_id,
      standing: coupleBookingStanding(
        {
          status: r.status,
          onPlatform: !!r.marketplace_vendor_id,
          handshaken:
            r.lock_request_state === 'agreed' || !!r.deposit_acknowledged_at || claimed.has(r.vendor_id),
          fee,
        },
        feeMinting,
      ),
    });
  }
  return out;
}


/**
 * "NO HANDSHAKE, NO RECORD" (owner 2026-10-07; audit C6 / F2, build item 13).
 * A payment, a deposit or a change order may be recorded against an
 * on-platform supplier only once the booking is booked AND settled as the
 * couple sees it. Returns the sentence to refuse with, or null to proceed.
 *
 * ⚠ ONLY WHILE THE HANDSHAKE IS ON (`isLockHandshakeEnabled`). With it off the
 * couple books directly and the supplier's FIRST yes is confirming that first
 * payment — refusing the payment would leave no way to make the booking at
 * all. An off-platform (manual) supplier is never refused: it is the couple's
 * own record and carries no fee.
 */
export async function coupleMoneyNotYet(
  admin: SupabaseClient,
  eventVendorId: string,
  handshakeOn: boolean,
): Promise<string | null> {
  if (!handshakeOn) return null;
  const read = (await readCoupleBookingStandings(admin, [eventVendorId])).get(eventVendorId);
  // A row the read could not find is the caller's own "not found" to say; an
  // unreadable one fails open; a manual supplier is the couple's own record.
  if (!read || read.onPlatform !== true || read.standing === 'booked') return null;
  return COUPLE_MONEY_NOT_YET[read.standing];
}
