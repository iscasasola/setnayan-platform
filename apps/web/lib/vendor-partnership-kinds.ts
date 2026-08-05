/**
 * THE FOUR PARTNERSHIP KINDS — one definition, used by every surface.
 *
 * ── NOBODY PAYS FOR ANY OF THESE ────────────────────────────────────────────
 * Owner, 2026-08-05: **no payment for any kind.** All four are free, forever, on
 * both sides. Two of them are offers the vendor makes to the COUPLE:
 *
 *   · `included_in_package` — the partner is in my package, free to the couple
 *   · `discounted_together` — the partner discounts when booked alongside me
 *
 * ⚠ These were called `sponsored_included` / `sponsored_discounted` until
 * 2026-08-05 (migration `20271108090000`). The word "sponsored" sent two
 * independent readers to the same wrong conclusion — that the marketplace was
 * being reordered by paid advertising — and one of those readings reached the
 * owner as a pricing recommendation before the vendor-facing form was read.
 * If you meet the old names in an archived doc or an old branch, that is what
 * they meant: sponsoring a PARTNER'S SERVICE, never buying placement.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The same four kinds were ranked in TWO PLACES, in OPPOSITE ORDERS. The
 * vendor's public page picked a badge alphabetically (so `accredited` always
 * won) while Explore ranked `included_in_package` highest. A vendor holding both
 * got the strongest position in search and the weaker badge on their profile,
 * and no single file said which was intended.
 *
 * Now there is one order, one set of words, and every surface reads them here.
 */

export const PARTNERSHIP_KINDS = [
  'included_in_package',
  'discounted_together',
  'accredited',
  'general',
] as const;

export type PartnershipKind = (typeof PARTNERSHIP_KINDS)[number];

export function isPartnershipKind(value: unknown): value is PartnershipKind {
  return typeof value === 'string' && (PARTNERSHIP_KINDS as readonly string[]).includes(value);
}

/**
 * Rank order — **by what the COUPLE actually gets**, strongest first.
 *
 * Getting a vendor free beats getting them cheaper, which beats a formal
 * certification, which beats "we work together". That is the honest ordering
 * for a couple deciding, and it is why Explore was already right. The profile
 * page's alphabetical tie-break was the half that was wrong.
 *
 * Higher number = stronger.
 */
export const PARTNERSHIP_RANK: Record<PartnershipKind, number> = {
  included_in_package: 4,
  discounted_together: 3,
  accredited: 2,
  general: 1,
};

/** The strongest kind in a set, or null when empty. One badge per endorser. */
export function strongestPartnershipKind(
  kinds: ReadonlyArray<string>,
): PartnershipKind | null {
  let best: PartnershipKind | null = null;
  for (const k of kinds) {
    if (!isPartnershipKind(k)) continue;
    if (best === null || PARTNERSHIP_RANK[k] > PARTNERSHIP_RANK[best]) best = k;
  }
  return best;
}

/**
 * What a COUPLE is told, on the vendor's public page.
 *
 * ⚠ The two bundle kinds used to BOTH render as "Preferred partner" — a phrase
 * that means nothing and threw away the only part a couple cares about. Being
 * told a florist is included in your coordinator's package at no extra cost is
 * the single most useful thing on that row; "Preferred partner" is a shrug.
 *
 * Written from the couple's side ("their package", not "our package") because
 * it appears under someone else's name.
 */
export const PARTNERSHIP_PUBLIC_LABEL: Record<PartnershipKind, string> = {
  included_in_package: 'Included in their package',
  discounted_together: 'Discounted together',
  accredited: 'Accredited',
  general: 'Works with',
};

/** A short plain-English gloss, for a tooltip or a caption. */
export const PARTNERSHIP_PUBLIC_HINT: Record<PartnershipKind, string> = {
  included_in_package: 'Booked through them, at no extra cost to you',
  discounted_together: 'A discount when you book both',
  accredited: 'They formally certify this vendor',
  general: 'They work together often',
};

/** What a VENDOR is told, choosing a kind. Long form, on the proposal form. */
export const PARTNERSHIP_VENDOR_LABEL: Record<PartnershipKind, string> = {
  included_in_package:
    'Included in package — recommended vendor is part of your offering at no extra cost',
  discounted_together:
    'Discounted — recommended vendor offers a discount when booked alongside you',
  accredited: 'Accredited — you formally certify this vendor',
  general: 'General referral — informal "works well with" recommendation',
};

/** Short form, for a chip on an existing row. */
export const PARTNERSHIP_VENDOR_LABEL_SHORT: Record<PartnershipKind, string> = {
  included_in_package: 'Included in package',
  discounted_together: 'Discounted',
  accredited: 'Accredited',
  general: 'General referral',
};

/**
 * Does moving to this kind make a claim about the OTHER vendor's pricing?
 *
 * "Included in my package" and "discounts alongside me" both commit the partner
 * to money they have not agreed to here. Changing INTO one of these has to go
 * back to them for acceptance — the same consent the original proposal needed.
 * Dropping to `accredited` or `general` claims nothing new about them, so it
 * does not.
 */
export function claimsPartnerPricing(kind: PartnershipKind): boolean {
  return kind === 'included_in_package' || kind === 'discounted_together';
}
