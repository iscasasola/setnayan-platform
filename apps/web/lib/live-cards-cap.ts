/**
 * 🔒 CARDS ARE UNLIMITED TO MAKE — THE PLAN COUNTS THE LIVE ONES.
 *
 * Owner, 19 Nov 2026, verbatim: "service cards. you can create to the limit of your cards. but you can choose if you
 * want to add all." → "or we keep it unlimited" → "sorry. we already agreed they can add as many" → "so we can
 * motivate them to upgrade". The same rule as DECISION_LOG 2026-11-10 "UNLIMITED CARDS, ONLY 3 LIVE" and the 17 Nov
 * rule. So: making a card is NEVER refused by plan; turning one LIVE (`vendor_services.is_active = true`) is, past the
 * plan's `serviceCardsTotal` — read from `TIER_CAPS` (+ bought add-ons, `fetchCapsWithAddOns`), never typed here.
 *
 * The count: this shop's live cards, branch copies excluded ("Copy to another branch" uses no card, owner
 * 2026-11-14), the card being turned live excluded (it is never counted against itself). A branch copy is never capped.
 * The reads live in `app/vendor-dashboard/services/actions.ts` (`liveCardsCapRefusal`); this file is the pure rule.
 */
import { formatCount } from '@/lib/format-number';

/** A count we could not read never turns a card on — publishing on no evidence (fails closed, like the publish gate). */
export const LIVE_CARDS_UNREAD =
  'We could not count your live cards just now, so this card was not turned on. Try again in a moment.';

/** Problem → Solution: what the plan shows, then the two ways forward. */
export function liveCardsCapMessage(cap: number): string {
  return `Your plan shows ${formatCount(cap)} service ${cap === 1 ? 'card' : 'cards'} live. Hide one, or upgrade to show more.`;
}

/** May this card go live? `null` = yes; otherwise the sentence. `liveOthers` = live non-copy cards besides this one. */
export function liveCardsVerdict(args: { cap: number; liveOthers: number; isBranchCopy: boolean }): string | null {
  if (args.isBranchCopy || !Number.isFinite(args.cap)) return null;
  return args.liveOthers >= args.cap ? liveCardsCapMessage(args.cap) : null;
}

/** What a NEW card asked to go live past the total is told: it is made, and hidden. */
export function heldHiddenMessage(refusal: string): string {
  return `Your card is saved and hidden. ${refusal}`;
}
