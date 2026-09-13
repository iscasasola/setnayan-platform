/**
 * The doorway's loading boundary.
 *
 * 🔴 IT WAS MISSING FOR TWO WEEKS AND NOTHING SAID SO. `/pakanta` joined the
 * Studio group on 2026-08-21 but was never added to `DOORWAYS` in
 * `doorway-shell.test.ts` — the one guard that checks this — so the rule
 * existed, the page broke it, and CI stayed green. Repairing that list on
 * 2026-09-03 (while adding `/mood-board`) failed on the very first run and
 * named this file. A list that has stopped matching reality is not a weaker
 * guard; it is no guard at all.
 *
 * WHAT IT COSTS WITHOUT ONE: these pages are `force-dynamic` (the group layout
 * declares it) so the shared shell can read the session — and a dynamic route
 * with NO `loading.tsx` prefetches an EMPTY tree. Measured on this app: a
 * force-static doorway prefetched 72,197 bytes (cache HIT, instant); a
 * force-dynamic route WITHOUT a loading boundary prefetched 162 bytes —
 * nothing. A force-dynamic route WITH one prefetched 58,473 bytes. So the
 * Pakanta row in the rail was the one Studio press that waited on a blank frame.
 *
 * ⚠ IT RENDERS NOTHING ON PURPOSE. The shared shell (rail + top bar) is already
 * painted by the layout above and does not re-render for this boundary, so a
 * skeleton here would flash a second set of furniture inside the first.
 *
 * 🪤 A `loading.tsx` FORCES STREAMING, which commits the HTTP status before the
 * page body runs — that is how `/v/[slug]` shipped a soft-404 and it is why this
 * must never be added to a route that can `notFound()`. A doorway is always
 * found: it is a static marketing page.
 */
export default function DoorwayLoading() {
  return null;
}
