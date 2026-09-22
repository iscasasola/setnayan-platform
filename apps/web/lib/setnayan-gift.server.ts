import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { bookingFeePhp } from '@/lib/booking-fee';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import { getBookingFeeSchedule } from '@/lib/booking-fee-settings.server';
import {
  giftLadderFrom,
  giftLadderIsPriceable,
  setnayanGiftForFee,
  type GiftCatalogRow,
  type GiftRung,
  type GiftTierRow,
  type SetnayanGift,
} from '@/lib/setnayan-gift';
import {
  giftBasisFrom,
  standingForGiftArm,
  standingForQuoteSwitch,
} from '@/lib/papic-on-a-quote';

/**
 * The Setnayan gift, as a QUOTE shows it — the I/O half of lib/setnayan-gift.ts.
 *
 * ⚖ Owner 2026-09-09: *"the NUMBER appears on the QUOTE, not the card … the
 * moment a price exists — the proposal or the agreed figure — the exact photo
 * count is known and is the strongest line on it."*
 *
 * The count is shown ONLY when the bill will really carry it, which the
 * database answers (`setnayan_gift_quote_applies`, migration 20271222508050):
 * the booking's own card said yes, the client is Setnayan-sourced, and the
 * booking falls outside the supplier's first five free ones — "no fee. no
 * gift." A count promised on a booking that will never be billed for it would
 * be exactly the silent broken promise the owner warned about, so every doubt
 * (flag off, a refused read, an empty ladder) answers NOTHING, never a number.
 *
 * The arithmetic is the SAME as the bill's: the fee from lib/booking-fee.ts
 * under the LIVE owner-set schedule, the ladder read now from the catalog, and
 * `setnayanGiftForFee` — the mirror the db test pins to the SQL that prices
 * the supplier's order.
 *
 * MUST be called with the service-role client, and only AFTER the caller has
 * proved the viewer may see the quote (the proposal page's own RLS read does).
 */

/** The live gift ladder, or null when either table could not be read. */
export async function fetchGiftLadder(admin: SupabaseClient): Promise<GiftRung[] | null> {
  const [catalog, tiers] = await Promise.all([
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, retail_price_php, is_active, retired_at')
      .like('service_code', 'PAPIC_GUEST%'),
    admin
      .from('papic_pass_tiers')
      .select('service_code, points, is_active, is_topup')
      .like('service_code', 'PAPIC_GUEST%'),
  ]);
  // ⚠ Supabase RESOLVES with { error } — it does not throw.
  if (catalog.error || tiers.error) return null;
  return giftLadderFrom(
    (catalog.data ?? []) as GiftCatalogRow[],
    (tiers.data ?? []) as GiftTierRow[],
  );
}

/**
 * The gift a quote of `amountCentavos` from this supplier to this event would
 * carry — or null when the quote must say nothing about a gift.
 *
 * ── THE DEFECT THIS CLOSES (measured on origin/main, 2026-09-22) ───────────
 * The per-quote switch shipped the day before (migration 20271240324859) is
 * read by `setnayan_gift_offered_on` only once the quote is ACCEPTED. So on a
 * quote that was merely SENT:
 *
 *   status=sent   switch=ON card=OFF → setnayan_gift_offered_on = false
 *                                    → arm 'card_says_no' → this returned null
 *
 * The supplier's composer, which applies the switch itself, read *"Includes
 * your Setnayan gift — N free Papic photos"*. The couple opening that same
 * quote was shown NOTHING, and the photos appeared only after they accepted.
 *
 * ⚖ That is the owner's 2026-09-09 lock read backwards: *"a gift named at the
 * moment of decision closes; a gift revealed after booking is only a
 * thank-you."* The product was shipping the thank-you.
 *
 * ── ONE RULE, BOTH SCREENS ─────────────────────────────────────────────────
 * 🔑 The two screens disagreed because they were two mechanisms for one fact.
 * They now run the SAME two pure functions, in the same order, and there is no
 * third spelling anywhere:
 *
 *     standingForGiftArm(arm, basis)  →  standingForQuoteSwitch(…, quoteSwitch)
 *
 * The composer does exactly this over a standing resolved by
 * `resolvePapicQuoteStanding`; this does it over the arm it just read. A quote
 * therefore promises the couple precisely what the supplier was shown when
 * they wrote it — before acceptance, not after.
 *
 * ⛔ The switch moves ONLY between the two eligible arms. It cannot conjure a
 * gift out of a waived fee, an imported client or an unreadable ladder — those
 * arms are returned untouched, so "no fee, no gift" is as true as it was.
 */
export async function quoteSetnayanGift(
  admin: SupabaseClient,
  args: {
    eventId: string;
    vendorProfileId: string;
    amountCentavos: number;
    /**
     * THIS QUOTE'S OWN SWITCH — `vendor_proposals.includes_setnayan_gift`.
     * `true`/`false` is a decision this quote made; `null` or absent means it
     * said nothing and the database's answer (the card, or an already-accepted
     * quote) stands, exactly as before this argument existed.
     */
    quoteSwitch?: boolean | null;
  },
): Promise<SetnayanGift | null> {
  if (!isBookingFeeEnabled()) return null; // no fee is ever billed ⇒ no gift
  if (!Number.isFinite(args.amountCentavos) || args.amountCentavos <= 0) return null;

  const { data: applies, error } = await admin.rpc('setnayan_gift_quote_applies', {
    p_event_id: args.eventId,
    p_vendor_profile_id: args.vendorProfileId,
  });
  if (error) {
    console.error('[supabase-error] setnayan-gift: setnayan_gift_quote_applies (quote)', error);
    return null;
  }
  const arm = typeof applies === 'string' ? applies : '';

  /*
    ⚠ THE LADDER IS NOW READ FOR `card_says_no` TOO — one extra pair of reads on
    the one arm this quote's switch can move. Without it a switched-on quote has
    no ladder to price its own promise from, and would fall back to silence: the
    very defect this change exists to remove.
  */
  if (arm !== 'applies' && arm !== 'card_says_no') return null;

  const [schedule, ladder] = await Promise.all([
    getBookingFeeSchedule(admin),
    fetchGiftLadder(admin),
  ]);
  if (!ladder || !giftLadderIsPriceable(ladder)) return null;

  // ONE RULE, BOTH SCREENS — the same pair the composer runs.
  const standing = standingForQuoteSwitch(
    standingForGiftArm(arm, { schedule, ladder }),
    args.quoteSwitch,
  );
  // A basis reaches the couple's promise only on `included` — the contract
  // `giftBasisFrom` has always had, unchanged by the switch.
  if (!giftBasisFrom(standing)) return null;

  const feeCentavos = Math.round(bookingFeePhp(args.amountCentavos / 100, schedule) * 100);
  const gift = setnayanGiftForFee(feeCentavos, ladder);
  return gift.credits > 0 ? gift : null;
}

