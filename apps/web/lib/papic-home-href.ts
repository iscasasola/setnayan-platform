/**
 * papic-home-href.ts — WHERE PAPIC LIVES NOW: the one Papic card on Home › Today (owner 2026-10-26, DECISION_LOG
 * "THE PAPIC CARD LIVES ON HOME › TODAY; THE STANDALONE PAPIC PAGE IS REMOVED": *"that papic frame with toggle, place
 * that on home and remove that page"* · *"it should be on the today"*).
 *
 * `/dashboard/<id>/studio/papic` is no longer a page. Every link and every save that used to land there lands on Home
 * with the card open (`?papic=open`, which the card reads and clears) and scrolled to (`#papic`, the card's id). An
 * outcome a save reports (`style_set=…`, `papic_pool_error=…`) rides along as its own query key, and the card's
 * outcome line says it (`papic-outcome-banners.tsx`). Old links are forwarded by `lib/legacy-redirects.ts`, which uses
 * the same helper so the two can never disagree. Pure — `papic-lives-on-home.test.ts`.
 */

export const PAPIC_CARD_ANCHOR = 'papic';

/** Home › Today with the Papic card open — plus an outcome query (`style_set=MONO`), when a save reports one. */
export function papicHomeHref(eventId: string, outcome?: string | null): string {
  const q = outcome ? outcome.replace(/^[?&]+/, '') : '';
  return `/dashboard/${eventId}?papic=open${q ? `&${q}` : ''}#${PAPIC_CARD_ANCHOR}`;
}

/** `href` with one more query piece, keeping its fragment last — so `${back}?x=1` never lands after a `#`. */
export function withQuery(href: string, qs: string): string {
  const at = href.indexOf('#');
  const path = at === -1 ? href : href.slice(0, at);
  const hash = at === -1 ? '' : href.slice(at);
  const q = qs.replace(/^[?&]+/, '');
  return q ? `${path}${path.includes('?') ? '&' : '?'}${q}${hash}` : href;
}

/** The PATH of an href (no query, no fragment) — what `revalidatePath` takes. */
export function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] ?? href;
}
