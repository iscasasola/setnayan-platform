/**
 * 📖 THE STORY OPENS AFTER THE DAY — `/{slug}/recap` before the day (the live walk after #7596).
 *
 * The old Recap page folds into the story (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER
 * SCREEN) — SIX CALLS SETTLED" (5)): `/{slug}/recap` sends to the event's page. Before the day that page is the
 * invitation, and the visitor who asked for the story was sent there with nothing said. So the recap route adds
 * `?story=later`, and the event's page — whose own body is the one answer to "is the story out?" — draws this one
 * line until it is. The route itself reads nothing, so it stays as fast as a redirect.
 */

/** The `?story=` value `/{slug}/recap` sends. */
export const STORY_LATER = 'later';

/** The one plain line, drawn until the story is the page. */
export const STORY_LATER_WORDS = 'The story of the day opens here after the day.';

/** Where `/{slug}/recap` sends a visitor. */
export function recapHref(slug: string): string {
  return `/${encodeURIComponent(slug)}?story=${STORY_LATER}`;
}
