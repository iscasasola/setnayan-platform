/**
 * paid-placement-disclosure.ts — if money moved a card up, the card has to say so.
 *
 * ── The finding (register SUP-74 / EX-7, measured 2026-09-22) ───────────────
 * The marketplace sort chain is `ad_rank → review_count → rating`, and
 * `ad_rank` is not a neutral score. Production's view defines it as:
 *
 *     CASE WHEN vaa.tier = 'sponsored' THEN 2
 *          WHEN vaa.tier = 'boosted'   THEN 1
 *          ELSE 0 END AS ad_rank
 *
 * — derived from `vendor_active_ads`, i.e. from a supplier having **paid**.
 * So the first sort key on the public marketplace is purchased position.
 *
 * 🔑 AND THE TIER NEVER REACHES A CARD. `ad_rank` is selected for ORDER BY;
 * `ad_tier` is selected nowhere in the read path and no card component takes
 * it. Measured: zero occurrences of `ad_tier`/`adTier` in any marketplace card.
 * **A card could not disclose paid placement even if it wanted to** — the fact
 * that would justify the label is dropped between the sort and the render.
 *
 * Same shape as everything else found this session: the measurement exists and
 * does not reach the render.
 *
 * ── Why this is worth doing BEFORE anyone pays ─────────────────────────────
 * Measured the same day: `vendor_active_ads` holds **0 rows**, both live shops
 * have `ad_rank = 0`, `ad_tier = null`, `ad_live = false`. **Nothing is paid
 * today**, so ordering is unaffected and nothing is currently undisclosed.
 *
 * That is exactly why now. Undisclosed paid placement is a consumer-protection
 * problem, and the first advertiser will not arrive on a day anybody planned
 * for. A disclosure built after the fact is an apology; built before, it is
 * just a label.
 *
 * ⚠ WHAT THIS MODULE DOES NOT DO. It does not render anything. The remaining
 * half is a visible label on the card, and it needs someone who can look at the
 * result — see `the-marketplace-can-disclose-paid-placement.test.ts` for the
 * exact gap and what closing it requires.
 */

/** The tiers `vendor_active_ads` can report. Anything else is not paid placement. */
export type AdTier = 'sponsored' | 'boosted';

/**
 * What a couple must be shown when this card's position was purchased.
 * `null` means nothing was paid and nothing should be said — a label on an
 * unpaid card is its own kind of lie.
 *
 * 🔒 FAIL CLOSED TOWARDS DISCLOSURE IS WRONG HERE, AND THAT IS DELIBERATE.
 * Elsewhere in this repo an unknown value resolves to "off". Here an unknown
 * tier must resolve to "no label", because labelling an organic result as paid
 * misleads in the opposite direction and is equally untrue. The safe default is
 * silence; the guard's job is to make sure silence is never the answer for a
 * card that DID pay.
 */
export function paidPlacementLabel(tier: string | null | undefined): string | null {
  if (tier === 'sponsored') return 'Sponsored';
  if (tier === 'boosted') return 'Promoted';
  return null;
}

/** True when this row's position was purchased, whatever the tier is called. */
export function isPaidPlacement(tier: string | null | undefined): boolean {
  return paidPlacementLabel(tier) !== null;
}

/**
 * The columns a marketplace read must select for a card to be able to disclose.
 * `ad_rank` alone is not enough: it is an integer used for ORDER BY and carries
 * no vocabulary a person could be shown.
 */
export const DISCLOSURE_COLUMNS = ['ad_rank', 'ad_tier'] as const;
