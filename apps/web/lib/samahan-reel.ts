/**
 * The order a samahan's day is watched in.
 *
 * The strip on the page is NEWEST FIRST — it answers "what is new". A day is
 * watched the other way round: it starts where it started. So the reel is
 * chronological, and tapping any clip plays from there to now.
 *
 * Its own module, free of `server-only`, because the component that uses it is
 * a client component and its test is a plain node test — the same reason
 * samahan-notice-rules.ts sits beside samahan-notify.ts.
 */

/** Oldest first — the day in the order it happened. Never mutates the input. */
export function orderTheDay<T extends { created_at: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}
