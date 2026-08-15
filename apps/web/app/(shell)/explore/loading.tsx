/**
 * The marketplace's loading boundary.
 *
 * 🔄 THIS REPLACED A `GridPageSkeleton` (2026-08-15). The skeleton was right
 * while /explore painted its own chrome: it drew a card grid so the page did
 * not flash empty. Now the page wears the shared shell, and the shell — rail,
 * top bar, the page's own pinned strip — is already on screen and does NOT
 * re-render for this boundary. A skeleton here would paint a second set of
 * furniture inside the first, which is the same "the furniture jumps" defect
 * this conversion exists to remove, just one frame long.
 *
 * 🔴 THE FILE STILL HAS TO EXIST. /explore is `force-dynamic`, and a dynamic
 * route with NO loading boundary prefetches an EMPTY tree. Measured on this
 * app: force-static prefetched 72,197 bytes (cache hit, instant); dynamic with
 * no boundary prefetched 162 bytes — nothing; dynamic WITH one prefetched
 * 58,473 bytes. Deleting this file does not restore a skeleton, it deletes the
 * prefetch, and the rail's "Find a supplier" press becomes a blank wait.
 *
 * 🪤 A `loading.tsx` FORCES STREAMING, which commits the HTTP status before the
 * page body runs — that is how `/v/[slug]` shipped a soft-404 (HTTP 200 on a
 * shop that does not exist). Safe here, checked rather than assumed:
 * `app/explore/page.tsx` contains ZERO calls to `notFound()`; an empty
 * marketplace is a legitimate 200 with a "nothing matched" body.
 */
export default function ExploreLoading() {
  return null;
}
