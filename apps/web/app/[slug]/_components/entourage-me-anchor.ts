/**
 * 🫵 Where the viewer's own marked name is on the page (`entourage-you.tsx`) — its own small file so the client's
 * "See where you are ↓" (`see-where-you-are.tsx`) carries no entourage drawing code into a guest's bundle.
 */

/** The id the first mark carries — `site-entourage` → `site-entourage-me`. */
export function meAnchorOf(sectionId: string | undefined): string {
  return `${sectionId ?? 'entourage'}-me`;
}

/** The event page's entourage section id (`site-body.tsx`) and the place Me's link goes to. */
export const SITE_ENTOURAGE_ID = 'site-entourage';
export const SITE_ENTOURAGE_ME = meAnchorOf(SITE_ENTOURAGE_ID);
