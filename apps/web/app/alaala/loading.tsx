/**
 * The loading boundary for /alaala.
 *
 * 🔴 IT EXISTS SO THE PRESS STAYS INSTANT. This page became `force-dynamic` so
 * the shared shell could read the session — and a dynamic route with NO
 * `loading.tsx` prefetches an EMPTY tree. Measured on this app: a force-static
 * page prefetched 72,197 bytes (cache HIT, instant); a force-dynamic route
 * WITHOUT a boundary prefetched 162 bytes — nothing; WITH one, 58,473 bytes.
 * Without this file the rail row that points here stops being an immediate
 * press and becomes a wait on a blank frame — and that press is the exact
 * click this conversion exists to fix.
 *
 * ⚠ IT RENDERS NOTHING ON PURPOSE. The shared shell is already painted and does
 * not re-render for this boundary, so a skeleton here would flash a second set
 * of furniture inside the first.
 *
 * 🪤 A `loading.tsx` FORCES STREAMING, which commits the HTTP status before the
 * page body runs — that is how `/v/[slug]` shipped a soft-404 (HTTP 200 on a
 * shop that does not exist), and it is why this must never be added to a route
 * that can `notFound()`. Checked, not assumed:/alaala never calls notFound() — it is a static marketing page that is always found.
 */
export default function AlaalaLoading() {
  return null;
}
