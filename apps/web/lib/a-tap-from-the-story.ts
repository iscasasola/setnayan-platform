/**
 * A TAP FROM THE STORY IS ATTRIBUTABLE TO THE STORY — `03` §2.3 · `08` step 4.2.
 *
 * A supplier credited on a published story could not tell that a visitor came
 * from it: the credit linked to `/v/{slug}` bare, so every arrival from a
 * celebration's story counted as untracked traffic. The receiving side already
 * ships — `/v/[slug]` validates `src` against a fixed set and stores it as the
 * inquiry's origin — so this is the missing half of a mechanism, not a new one.
 *
 * ⛔ REUSE `editorial`; DO NOT INVENT `src=story`. The enum on the receiving
 * side is closed, and an unrecognised value is DISCARDED rather than rejected —
 * a rejected query is an absence, and the only symptom would be attribution
 * quietly returning to nothing.
 *
 * 🔒 THE COPY RULE TRAVELS WITH THE LINK: a supplier may be told HOW MANY
 * people reached them, NEVER WHO TAPPED. The analytics model forbids identity
 * and carries a minimum-count floor. Nothing here carries a person.
 */

/** The one `src` a story may declare. Closed on purpose. */
export const STORY_TAP_SRC = 'editorial' as const;

/**
 * ⚠ THE CAMPAIGN CARRIES THE SLUG, NOT THE EVENT'S PUBLIC ID.
 *
 * `03` §2.3 writes `utm=story:{event public_id}`. Measured 2026-09-09: the
 * editorial loader selects **no** `public_id` at all (0 occurrences in
 * `data.ts`), so using one would mean widening a read on the busiest page in
 * the product to carry an identifier the page does not need.
 *
 * The slug is already in the address the reader is standing on, so it discloses
 * nothing they did not just see, and it names the story exactly as well. If a
 * public id is ever wanted here, it is a loader change and a migration of the
 * stored campaign values — not a silent swap.
 */
/**
 * ⚠ BOTH SLUGS ARE NULLABLE, AND THE SAMPLES ARE WHY. A curated sample has no
 * event row and so no slug, and a supplier credited without a marketplace
 * profile has none either. The types said so and the first cut of this function
 * ignored them — the typecheck caught it.
 *
 * `null` vendor → `null` href, so the CALLER omits the link rather than
 * rendering a dead one. `null` event → the link still works and simply carries
 * no campaign: attribution is worth having even when the story cannot name
 * itself, and a literal "story:null" would poison the reach numbers it exists
 * to feed.
 */
export function storyTapHref(vendorSlug: string | null, eventSlug: string | null): string | null {
  if (!vendorSlug) return null;
  const base = `/v/${vendorSlug}?src=${STORY_TAP_SRC}`;
  return eventSlug ? `${base}&utm=${encodeURIComponent(`story:${eventSlug}`)}` : base;
}

/**
 * The sentence a supplier may be shown about it.
 *
 * Exported so there is ONE wording, and so a guard can assert the product never
 * promises identity. `01` §3.9 and the 2026-09-07 review both flag "who tapped
 * them" as a promise the analytics model cannot keep.
 */
export const REACH_SENTENCE = 'how many people reached you from this story';

/** Words that would promise identity. A guard fails on any of them. */
export const REACH_MUST_NEVER_SAY = ['who tapped', 'who viewed', 'who opened', 'which guests'];
