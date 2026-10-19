/**
 * The loading boundary for the /features hub — and ONLY the hub.
 *
 * It exists so the rail press into /features commits at once (the hub is
 * force-dynamic under the shared shell; a dynamic route with no boundary
 * prefetches an empty tree — `the-press-commits-now.test.ts`).
 *
 * 🔑 WHY IT SITS IN `(hub)/` AND NOT IN `features/`. A boundary wraps every
 * segment beneath it, and `/features/[slug]` calls `notFound()`: a boundary at
 * `features/` would make an unknown slug stream HTTP 200 before its body runs —
 * the /v/[slug] soft-404, on a crawlable page. The `(hub)` route group is
 * invisible in the URL, so the hub keeps its address and gets a boundary its
 * siblings do not inherit.
 *
 * ⚠ IT RENDERS NOTHING ON PURPOSE — the shell is already painted.
 */
export default function FeaturesHubLoading() {
  return null;
}
