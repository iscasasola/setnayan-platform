/**
 * lib/pay-path.ts — the ONE address of the ONE payment page.
 *
 * Every buy button that mints an order ends with a redirect here, and there are
 * a dozen of them. Re-deriving the URL at each call site is how one of them
 * ends up encoding the reference differently, or pointing at a route that has
 * moved, and nothing notices until a buyer cannot pay.
 *
 * Pure — no `server-only` — so it is importable from client components too
 * (a link into the page is as legitimate as a redirect).
 */

/** The payment page for this order's reference code. */
export function payPath(referenceCode: string): string {
  return '/pay/' + encodeURIComponent(referenceCode.trim());
}
