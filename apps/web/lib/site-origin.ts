/**
 * apps/web/lib/site-origin.ts — THE absolute site origin. One resolver.
 *
 * ⚠ WHY THIS EXISTS (2026-08-06). Four different environment variables were
 * each answering "what is this site's address?", and they disagreed about which
 * one to ask:
 *
 *   NEXT_PUBLIC_APP_URL           101 reads · the only one declared in .env.example
 *   NEXT_PUBLIC_SITE_URL            3 reads · undeclared
 *   SITE_URL                        (server fallback of the above) · undeclared
 *   NEXT_PUBLIC_SETNAYAN_BASE_URL   1 read  · undeclared · built the Maya
 *                                             payment success/failure return URL
 *
 * In production every chain ends at the same hardcoded 'https://www.setnayan.com',
 * so nothing was visibly broken — which is exactly why it survived. **The damage
 * is off production:** on a Vercel PREVIEW deployment `NEXT_PUBLIC_APP_URL` is
 * set to the preview origin while the three undeclared names are not, so a
 * preview's Samahan invite links, host-accept links, social card URLs and
 * payment return URL all silently pointed at PRODUCTION. Testing an invite on a
 * preview sent the tester to the live site.
 *
 * ORDER OF PREFERENCE — most-specific and best-maintained first:
 *   1. NEXT_PUBLIC_APP_URL          the declared, canonical, 101-consumer name
 *   2. NEXT_PUBLIC_SITE_URL         legacy, kept so an existing deploy that sets
 *   3. SITE_URL                     only these keeps working unchanged
 *   4. NEXT_PUBLIC_SETNAYAN_BASE_URL   legacy, billing-only
 *   5. https://www.setnayan.com     the same final fallback all four already had
 *
 * Purely additive: any deploy that set one of the legacy names still resolves to
 * that value when APP_URL is unset. Nothing about production changes.
 *
 * Always returns a value with no trailing slash, so callers can safely do
 * `${siteOrigin()}/path` — two of the old call sites concatenated without
 * trimming and would have produced a double slash on a trailing-slash value.
 */
export function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SETNAYAN_BASE_URL ??
    'https://www.setnayan.com';
  return raw.replace(/\/+$/, '');
}
