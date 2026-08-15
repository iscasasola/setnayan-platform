/**
 * sample-ids.ts — which "event ids" are curated fixtures rather than real rows.
 *
 * ─── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────
 * `data.ts` owns the fixtures, but it transitively imports `server-only`, so
 * anything that needs only the ID SET cannot reach it — not `tsx --test`, and
 * not any future client-side caller. Same reasoning `song-desk-gate.ts` states
 * for staying `server-only`-free: a pure predicate should be testable.
 *
 * ─── WHAT IT IS FOR ──────────────────────────────────────────────────────
 * These ids are SENTINELS, not UUIDs. `events.event_id` is a `uuid` column, so
 * handing one to a query does not return an empty result — Postgres rejects the
 * whole statement with `22P02 invalid input syntax for type uuid`. That ran on
 * every render of all six sample stories from 2026-07-31 to 2026-08-15, twice
 * per render (the masthead monogram read and the paid-perk probe), because
 * `loadEditorialData` short-circuits the sentinel and the two calls after it
 * did not.
 *
 * Nothing looked broken — both sites fail soft to exactly the right answer for
 * a sample — so the only cost was two doomed round trips and two red 400s per
 * page in the log a REAL fault has to be noticed in.
 *
 * ─── THE LIST AND THE FIXTURE TABLE CANNOT DRIFT ─────────────────────────
 * 🔑 A SECOND HAND-TYPED LIST IS EXACTLY THE DEFECT THIS IS MEANT TO PREVENT,
 * so the correspondence is a MECHANISM, not a comment: `data.ts` declares its
 * fixture table as `Record<SampleEditorialId, …>`, which TypeScript will not
 * accept with a member missing or an extra key present. Add a seventh sample
 * to one of the two files and the build tells you about the other.
 */

/** The sentinel ids, in the order the fixtures are declared. */
export const SAMPLE_EDITORIAL_ID_LIST = [
  'sample-maria-and-juan',
  'sample-jack-and-jill',
  'sample-john-and-jane',
  'sample-peter-and-mary',
  'sample-jack-and-rose',
  'sample-sofia-reyes',
] as const;

export type SampleEditorialId = (typeof SAMPLE_EDITORIAL_ID_LIST)[number];

/**
 * Is this "event id" a curated fixture rather than a real event row?
 *
 * 🪤 A BARE `SAMPLE_EDITORIALS[eventId]` LOOKUP WOULD NOT DO. Object index
 * access answers truthy for `constructor`, `toString`, `valueOf` and friends,
 * so an event whose id happened to be one of those words would skip the real
 * reads and silently lose its monogram and its paid perk. Membership in an
 * explicit list has no prototype to inherit from.
 */
export function isSampleEditorialId(eventId: string): eventId is SampleEditorialId {
  return (SAMPLE_EDITORIAL_ID_LIST as readonly string[]).includes(eventId);
}
