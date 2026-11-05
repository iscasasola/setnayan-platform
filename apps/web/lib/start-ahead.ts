/**
 * apps/web/lib/start-ahead.ts — START A READ NOW, AWAIT IT WHERE IT ALWAYS WAS.
 *
 * ── WHY (measured on production, 2026-10-08) ───────────────────────────────
 * One guest page took 2.2 s to render for a real event, and its own timing line
 * (`[server-timing] slug/invitation-body`) said 1,150 ms of body with only 270 ms
 * inside the named phases: the rest was reads waiting in a queue of one. The
 * body is two dozen `await`s in a row, and almost none of them needs the answer
 * of the one before — each simply could not START until the one above it had
 * finished. With a database round trip of 25–50 ms, forty reads in single file
 * are one to two seconds of nothing.
 *
 * ── THE IDIOM (the page already used it once, for `skeletonHeroDesign`) ────
 * Call the read early, keep its promise, and `await` that SAME promise at the
 * line that always awaited it. Nothing downstream moves: the same value arrives
 * at the same line, a refused read throws the same error from the same `await`,
 * and no read is added — it only stops waiting for its neighbours.
 *
 *     const venues = startAhead(loadVenueBookings(admin, id));   // starts now
 *     …
 *     const venueBookings = await venues;                         // where it was
 *
 * For a loader wrapped in React's `cache()` the early call is enough on its own
 * (the later call with the SAME arguments gets the same promise) — but pass it
 * through here anyway, for the one thing this function does:
 *
 * ── 🔑 A REJECTION IS NEVER LOST AND NEVER LOUD ────────────────────────────
 * A promise that rejects before anything awaits it is an "unhandled rejection".
 * `startAhead` marks it as handled and returns the ORIGINAL promise, so the
 * `await` that was always there still receives the rejection and still throws.
 * A failure is not swallowed and not turned into a value — only kept quiet for
 * the moment between starting and awaiting.
 *
 * ⛔ ONLY START AHEAD WHAT EVERY PATH BELOW WILL AWAIT. A read started for a
 * branch the render never takes is a wasted request — the opposite of the
 * point. (And never anything that WRITES.)
 */
export function startAhead<T>(read: Promise<T>): Promise<T> {
  read.catch(() => {});
  return read;
}
