/**
 * share-card-look.ts — pure (no sharp, no server-only), because `generateMetadata` on `/[slug]` calls it and must
 * not load the image pipeline just to build an address.
 */

/**
 * What the share card's address must move with, besides the story's version: the mark it draws. A crawler caches a
 * card by its URL (`lib/a-withdrawal-reaches-every-copy.ts` says why nothing on the server can reach that cache), so
 * a couple who changes their logo — or flips the switch — must get a new address, or every share keeps the old face.
 *
 * `CARD_LOOK_EDITION` moves every address once, for the day the card itself changes what it draws (2026-10-20: the
 * logo replaced the typed initials), so the next share — and every platform that re-scrapes the page — asks for an
 * address nobody has cached. ⚠ A post somebody ALREADY shared holds the old address; this cannot reach it (Facebook's
 * Sharing Debugger can, by re-scraping the page).
 * A short FNV-1a hash — this is a cache key, not a secret, and it must be cheap enough for `generateMetadata`.
 */
export const CARD_LOOK_EDITION = 'logo1';

export function shareCardLookToken(look: {
  markSvg: string | null | undefined;
  monogramText?: string | null;
  monogramColor?: string | null;
}): string {
  const drawn = look.markSvg
    ? `mark:${look.markSvg}`
    : `letters:${look.monogramText ?? ''}:${look.monogramColor ?? ''}`;
  const input = `${CARD_LOOK_EDITION}|${drawn}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
