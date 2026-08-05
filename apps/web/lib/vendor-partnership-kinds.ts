/**
 * THE FOUR PARTNERSHIP KINDS — one definition, used by every surface.
 *
 * ── ⚠ READ THIS BEFORE YOU TRUST THE COLUMN VALUES ──────────────────────────
 * Two of the stored values are called `sponsored_included` and
 * `sponsored_discounted`, and **"sponsored" here has nothing to do with paying
 * Setnayan.** Nobody buys placement. The vendor is sponsoring their PARTNER'S
 * SERVICE FOR THE COUPLE:
 *
 *   · `sponsored_included`   — the partner is in my package, free to the couple
 *   · `sponsored_discounted` — the partner discounts when booked alongside me
 *
 * The name reads as advertising and has already caused one reviewer to conclude
 * the marketplace was being reordered by paid placement. It is not. Owner,
 * 2026-08-05: **no payment for any of these.** All four are free, forever, on
 * both sides.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * The same four kinds were ranked in TWO PLACES, in OPPOSITE ORDERS. The
 * vendor's public page picked a badge alphabetically (so `accredited` always
 * won) while Explore ranked `sponsored_included` highest. A vendor holding both
 * got the strongest position in search and the weaker badge on their profile,
 * and no single file said which was intended.
 *
 * Now there is one order, one set of words, and every surface reads them here.
 */

export const PARTNERSHIP_KINDS = [
  'sponsored_included',
  'sponsored_discounted',
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
  sponsored_included: 4,
  sponsored_discounted: 3,
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
  sponsored_included: 'Included in their package',
  sponsored_discounted: 'Discounted together',
  accredited: 'Accredited',
  general: 'Works with',
};

/** A short plain-English gloss, for a tooltip or a caption. */
export const PARTNERSHIP_PUBLIC_HINT: Record<PartnershipKind, string> = {
  sponsored_included: 'Booked through them, at no extra cost to you',
  sponsored_discounted: 'A discount when you book both',
  accredited: 'They formally certify this vendor',
  general: 'They work together often',
};

/** What a VENDOR is told, choosing a kind. Long form, on the proposal form. */
export const PARTNERSHIP_VENDOR_LABEL: Record<PartnershipKind, string> = {
  sponsored_included:
    'Included in package — recommended vendor is part of your offering at no extra cost',
  sponsored_discounted:
    'Discounted — recommended vendor offers a discount when booked alongside you',
  accredited: 'Accredited — you formally certify this vendor',
  general: 'General referral — informal "works well with" recommendation',
};

/** Short form, for a chip on an existing row. */
export const PARTNERSHIP_VENDOR_LABEL_SHORT: Record<PartnershipKind, string> = {
  sponsored_included: 'Included in package',
  sponsored_discounted: 'Discounted',
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
  return kind === 'sponsored_included' || kind === 'sponsored_discounted';
}
