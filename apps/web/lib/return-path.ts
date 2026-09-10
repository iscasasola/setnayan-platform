/**
 * return-path.ts — the path a server action REVALIDATES is not the URL it
 * REDIRECTS to.
 *
 * ── THE TRAP ────────────────────────────────────────────────────────────────
 * The chat's reply actions (`respondAppointment`, `respondAmendmentFromChat`
 * and their siblings) take one `return_path` and do both:
 *
 *     revalidatePath(returnPath);
 *     redirect(returnPath);
 *
 * That was harmless while every return path was a bare pathname. It stops
 * being harmless the moment a return path carries a query — which it now does,
 * because the conversation's Decisions view lives in `?view=decisions` and a
 * reply made from that view must land back on it.
 *
 * Measured in Next 15.5's own source
 * (`next/dist/server/web/spec-extension/revalidate.js`): `revalidatePath`
 * builds its cache tag by concatenating the path VERBATIM onto the implicit tag
 * prefix. So `revalidatePath('/x/messages/abc?view=decisions')` produces a tag
 * that no route ever carries, and **silently purges nothing** — no error, no
 * warning. The reply would succeed and the page would show the old card.
 *
 * So: revalidate the pathname, redirect to the whole thing.
 */

/**
 * The part of an in-app path that names a ROUTE — no query, no fragment.
 *
 * For every return path the app built before 2026-09-10 (bare pathnames) this
 * returns its input unchanged, which is what keeps routing the existing call
 * sites through it behaviour-preserving.
 */
export function revalidationTarget(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}
