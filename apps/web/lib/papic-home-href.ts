/**
 * papic-home-href.ts — WHERE PAPIC LIVES NOW: the one Papic card in **Memories**, under the keepsake row (THE ONE
 * BUILD, owner 8 Nov 2026: *"Papic + Thank You into Memories"*; supersedes 2026-10-26 "THE PAPIC CARD LIVES ON
 * HOME › TODAY"). The file keeps its name so every import stays put; the export is `papicCardHref` — the old
 * `papicHomeHref` stopped telling the truth the day the card left Home.
 *
 * `/dashboard/<id>/studio/papic` is no longer a page. Every link and every save that used to land there lands on
 * Memories with the card open (`?papic=open`, which the card reads and clears) and scrolled to (`#papic`, the card's
 * id). An outcome a save reports (`style_set=…`, `papic_pool_error=…`) rides along as its own query key, and the
 * card's outcome line says it (`papic-outcome-banners.tsx`). Old links — `/studio/papic…` AND the old card address
 * `/dashboard/<id>?papic=open…` that stored notifications still carry — are forwarded by `lib/legacy-redirects.ts`,
 * which uses the same helper so the two can never disagree. Pure — `papic-lives-in-memories.test.ts`.
 */

export const PAPIC_CARD_ANCHOR = 'papic';

/** Memories with the Papic card open — plus an outcome query (`style_set=MONO`), when a save reports one. */
export function papicCardHref(eventId: string, outcome?: string | null): string {
  const q = outcome ? outcome.replace(/^[?&]+/, '') : '';
  return `/dashboard/${eventId}/memories?papic=open${q ? `&${q}` : ''}#${PAPIC_CARD_ANCHOR}`;
}

/**
 * 🖨 The one code's printable poster — its OWN page, never a path tacked onto `papicCardHref` (which ends in
 * `?papic=open#papic`, so `${papicCardHref(id)}/crew/poster` lands inside the fragment and opens nothing — the Crew
 * page's "Print the poster" did exactly that). Held by `lib/dashboard-doors-resolve.test.ts`.
 */
export function papicCrewPosterHref(eventId: string): string {
  return `/dashboard/${eventId}/studio/papic/crew/poster`;
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

/**
 * 🏠→🖼 WHERE A SAVE MADE INSIDE THE CARD LANDS. The card's controls post `return_to=<seat>`; a fixed word picks a fixed
 * path, never a URL from the form. `memories` is the card's seat since 2026-11-08; `home` (Today, the event's front
 * page) is still honoured for a form already open on a phone when the build shipped — it lands on Today, as it did.
 * Anything else answers null (the caller's own page).
 */
export type PapicCardSeat = 'home' | 'memories';

export function papicSeatBack(eventId: string, raw: unknown): string | null {
  if (raw === 'memories') return `/dashboard/${eventId}/memories`;
  if (raw === 'home') return `/dashboard/${eventId}`;
  return null;
}
