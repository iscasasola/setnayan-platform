/**
 * WHO SEES THE LINK PREVIEW — the one rule `/{slug}` and `/{slug}/recap` ask before their
 * metadata names the couple or carries their card.
 *
 * Owner ruling 2026-09-11 (DECISION_LOG ⚖️ row, NEEDS_THE_OWNER item 13 → A): a story that is
 * PUBLISHED shows its own share card even when the site is UNLISTED. Before, an Unlisted site —
 * the default after setup — always fell back to the generic Setnayan card, so a host who pressed
 * "Published — everyone can read it" sent a link whose preview said "Setnayan".
 *
 *   public                        → the couple's card, their names, indexable
 *   unlisted + something published → the couple's card, their names, NOT indexable
 *   anything else                  → nothing that names the couple (the stub title, noindex)
 *
 * ⚖ THE TITLE MAY CARRY THE NAMES ON AN UNLISTED SITE, deliberately: the reason names were kept
 * out was search snippets, and an Unlisted page is `noindex` — so no snippet exists; and the
 * card itself names the couple, so a title without them would only disagree with its own card.
 * 'private' and 'invited_accounts' never reach this: a lock screen for strangers must not be
 * narrated by its own preview. A story that is taken back, a draft, or shared only with guests
 * is not "published" — its site stays on the stub.
 *
 * Pure on purpose: the pages read the facts, this decides, and a unit test holds every row.
 */
export type LinkPreview = {
  /** The couple's share card (and the metadata that names them). */
  namesTheCouple: boolean;
  /** Whether search engines may index the page. */
  indexable: boolean;
};

export function linkPreviewFor(
  visibility: string | null | undefined,
  published: boolean,
): LinkPreview {
  if (visibility === 'public') return { namesTheCouple: true, indexable: true };
  if (visibility === 'unlisted' && published === true) return { namesTheCouple: true, indexable: false };
  return { namesTheCouple: false, indexable: false };
}
