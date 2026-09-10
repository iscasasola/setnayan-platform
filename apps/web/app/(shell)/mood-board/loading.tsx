/**
 * The doorway's loading boundary.
 *
 * 🔴 IT EXISTS SO THE PRESS STAYS INSTANT. These pages are `force-dynamic` (the
 * group layout declares it) so the shared shell can read the session — and a
 * dynamic route with NO `loading.tsx` prefetches an EMPTY tree. Measured on this
 * app: a force-static doorway prefetched 72,197 bytes (cache HIT, instant); a
 * force-dynamic route WITHOUT a loading boundary prefetched 162 bytes —
 * nothing. A force-dynamic route WITH one prefetched 58,473 bytes.
 *
 * Without this file the exact click this page was added for — the new Mood Board
 * row in the rail's Studio group — stops being immediate and becomes a wait on a
 * blank frame.
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
