import {
  TIER_CAPS,
  TIER_LABEL,
  canBuyExtraBookingsPerDate,
} from './vendor-tier-caps';

/**
 * A SERVICE CARD'S BOOKINGS PER DATE, INSIDE ITS PLAN — owner 2026-11-06 (DECISION_LOG "BOOKINGS PER DATE PER SERVICE
 * IS A PLAN ALLOWANCE"), verbatim: *"Solo has 1 per date/service, pro has 3 per date/service, ultra has 5 per
 * date/service"*. Free and Verified: 1 each, like Solo (owner click 2026-11-06, "BOOKINGS PER DATE PER SERVICE — FREE
 * AND VERIFIED"), so every plan has a cap and every plan's editor shows it.
 *
 * The card editor's number (`vendor_services.daily_capacity`, "How many a day · this card") may be LOWER than the
 * plan's, never higher. The DATABASE is the gate that counts (`service_card_daily_limit`, read by every day check);
 * this is the editor's half, so a supplier is never shown a number their plan will not honour.
 *
 * Pure — the caller passes the EFFECTIVE cap (plan + any bought "+1 booking per date", lib/vendor-effective-caps.ts).
 */

/** The words the editor shows beside the field: the cap, and — on Ultra — that more can be bought. */
export function bookingsPerDateHelp(tier: string | null | undefined, effectiveCap: number): string {
  const n = Math.max(0, Math.floor(effectiveCap));
  const head = `Your plan: up to ${n} ${n === 1 ? 'booking' : 'bookings'} per date on this card.`;
  if (canBuyExtraBookingsPerDate(tier)) return `${head} Add more on your Plan page (+1 booking per date).`;
  return `${head} ${TIER_LABEL.enterprise} takes ${TIER_CAPS.enterprise.bookingsPerDatePerService}, and can add more.`;
}

/**
 * Null when the number may be saved; otherwise the sentence the editor shows. Blank (null) always saves — a blank card
 * takes the plan's number. GRANDFATHERED: a card already holding a number above a lowered cap may be re-saved with
 * that SAME number (bookings it holds are never touched, and the database only ever honours the cap); only a NEW
 * number past the cap is refused.
 */
export function bookingsPerDateRefusal(input: {
  tier: string | null | undefined;
  effectiveCap: number;
  requested: number | null;
  stored: number | null;
}): string | null {
  const { tier, effectiveCap, requested, stored } = input;
  if (requested === null || !Number.isFinite(effectiveCap)) return null;
  if (requested <= effectiveCap) return null;
  if (stored !== null && requested === stored) return null;
  return bookingsPerDateHelp(tier, effectiveCap);
}
