import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import { fetchGiftLadder } from '@/lib/setnayan-gift.server';
import { giftLadderIsPriceable, type GiftQuoteBasis } from '@/lib/setnayan-gift';
import { standingForGiftArm, type PapicQuoteStanding } from '@/lib/papic-on-a-quote';

/**
 * The DB half of "how much exclusive Papic can this quote carry?" — the I/O
 * beside the pure `lib/papic-on-a-quote.ts`, which makes every decision and
 * composes every sentence. Nothing here formats a number or picks an arm.
 *
 * READ-ONLY: it opens no charge, mints no order and grants no credits. The
 * gift is sized and billed by SQL (`booking_fee_charges_size_the_gift`) when
 * the lock charge opens, and reaches the couple through
 * `booking_fee_grant_setnayan_gift` when that bill is paid.
 *
 * 🔑 WHY IT REPLACED `giftQuoteBasis` — that sibling was DELETED on 2026-09-22,
 * once this was the only caller path left. It answered "is a gift promised?"
 * with a basis or `null`, throwing away WHICH of four reasons a `null` was —
 * and the supplier's question ("how much CAN I add?") needs the reason.
 * This asks the same RPC once and returns both answers;
 * `giftBasisFrom(standing)` is what the gift block then reads. One read, one
 * answer, so the two lines under one total cannot be resolved against two
 * different moments.
 *
 * 🔑 AND WHY THE ARM MAPPING IS NOT HERE. `server-only` means a unit test can
 * never import this file, so a guard over it could only grep. The decision
 * lives in `standingForGiftArm` and is EXECUTED; this file keeps only the two
 * reads and the order they happen in.
 */

/**
 * WHERE THIS BOOKING STANDS ON THE EXCLUSIVE PAPIC DEAL.
 *
 * MUST be called with the service-role client (`setnayan_gift_quote_applies`
 * is granted to `service_role` only), and only after the caller has proved the
 * viewer is the supplier on this thread.
 *
 * ⚠ FAILURE DIRECTION. The fee flag being off and `'no_booking'` are the only
 * two silences; every READ problem answers `unreadable`. A supplier told "no
 * Papic here" by a failed query would be the exact shape of defect — a failure
 * that renders identically to an absence — this lane exists to remove.
 *
 * ⚠ WHAT TRAVELS TO THE BROWSER, and how it differed from `giftQuoteBasis`
 * (deleted 2026-09-22):
 * that function let only the PRESENCE of a basis cross; this lets the standing
 * of the supplier's own booking cross too. The schedule is owner-set and
 * already disclosed to suppliers, the ladder is the public retail catalogue,
 * and the standing is a fact about the viewer's own booking. No third party's
 * data is in it.
 */
export async function resolvePapicQuoteStanding(
  admin: SupabaseClient,
  args: { eventId: string | null | undefined; vendorProfileId: string | null | undefined },
): Promise<PapicQuoteStanding> {
  if (!isBookingFeeEnabled()) return { kind: 'silent' };
  if (!args.eventId || !args.vendorProfileId) return { kind: 'silent' };

  try {
    const { data, error } = await admin.rpc('setnayan_gift_quote_applies', {
      p_event_id: args.eventId,
      p_vendor_profile_id: args.vendorProfileId,
    });
    // ⚠ Supabase RESOLVES with { error } — it does not throw. An empty arm
    // string is one `standingForGiftArm` does not recognise, so a refused read
    // and an unparseable answer both come out `unreadable`.
    if (error) {
      console.error('[supabase-error] papic-on-a-quote: setnayan_gift_quote_applies', error);
      return { kind: 'unreadable' };
    }
    const arm = typeof data === 'string' ? data : '';

    // Only the two eligible arms need the live arithmetic — the others are
    // decided by the arm alone, so a free or imported booking costs no reads.
    let basis: GiftQuoteBasis | null = null;
    if (arm === 'applies' || arm === 'card_says_no') {
      const [schedule, ladder] = await Promise.all([
        getBookingFeeSchedule(admin),
        fetchGiftLadder(admin),
      ]);
      // A ladder that cannot price the cap cannot bound the maximum. `null`
      // here becomes `unreadable`, never "no deal" — the difference between a
      // broken catalogue and an honest absence.
      if (ladder && giftLadderIsPriceable(ladder)) basis = { schedule, ladder };
    }
    return standingForGiftArm(arm, basis);
  } catch {
    return { kind: 'unreadable' };
  }
}
