/**
 * lib/love-story-cap.ts — the free Love Story cap, on its own so a client list can read it.
 *
 * `FREE_MOMENT_CAP` lives here, not in `lib/love-story-moments.ts`, so the Pro list (`lib/website-pro-items.ts`, imported by
 * client components) can COMPUTE "more than 5 moments" without pulling the Love Story reader and `lib/hub-canvas.ts` into every
 * bundle that draws the list. `lib/love-story-moments.ts` re-exports it, so every existing import is unchanged. Owner 2026-10-22:
 * a free event keeps 5 word-only moments; photos and more moments are Event Hub Pro.
 */

/** Free couples: at most this many stories. The sixth needs Event Hub Pro. */
export const FREE_MOMENT_CAP = 5;
