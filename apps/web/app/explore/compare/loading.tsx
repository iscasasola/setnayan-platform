/**
 * The compare page's loading boundary.
 *
 * 🔄 THIS REPLACED A `GridPageSkeleton` (2026-08-15), for the same reason as
 * `app/explore/loading.tsx`: the page now wears the shared shell, which is
 * already on screen and does NOT re-render for this boundary, so a skeleton
 * would paint a second set of furniture inside the first.
 *
 * 🔴 THE FILE STILL HAS TO EXIST — this route is `force-dynamic`, and a dynamic
 * route with no boundary prefetches an EMPTY tree (162 bytes, measured).
 *
 * ⚠ THIS ROUTE CALLS `redirect('/explore')` TWICE (no ids, and unresolvable
 * ids). A loading boundary forces streaming, which commits the response before
 * the body runs — so those become client-side redirects rather than a 307.
 * That is PRE-EXISTING, not introduced here: the skeleton this file replaced
 * forced streaming exactly the same way. Named so the next reader does not
 * discover it as a surprise, and so it is not mistaken for a regression of this
 * conversion.
 */
export default function CompareLoading() {
  return null;
}
