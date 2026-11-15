/**
 * discover-way-back.ts — "A WAY BACK" FROM WHAT DISCOVER OPENS (2026-11-12).
 *
 * Owner, verbatim: *"and then when we enter a shop, event or anything, we should be able to go back to home"*.
 * DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED WITH FOUR ANSWERS" — the drawing's "Going
 * back" table (`prototypes/discover_with_suppliers_2026-11-12_fable.html`): every page opened from Discover has ONE
 * back button at the top left, the shipped `BackButton`, and it returns IN PLACE (the browser's back, so the list
 * comes back with its filters and scroll — `ReturnInPlace`, chat/chat-back.tsx). Only a page opened cold (a shared
 * link, nothing of ours behind it) uses a fixed address, and that address is "home": Discover signed out, Home
 * signed in.
 *
 * 🔑 THE HOST'S EVENT PAGE IS THE ONE EXCEPTION (answer 3). `/[slug]` is the host's own page in the host's own look;
 * an invited guest sees nothing from Setnayan there. So its back button shows ONLY to a visitor who arrived from
 * Discover — and the page can only know that if Discover's event cards SAY so. They put `?via=discover` on the link
 * (`withDiscoverArrival`); the event page reads it in the browser, draws the back button, and takes the marker back
 * OUT of the address at once (`withoutDiscoverArrival`), so it is never copied, shared or bookmarked.
 *
 * ⚠ WHY NOT `?src=discover` (the shop cards' tag, `lib/shop-back.ts`): `src` is one of the Event Hub's LIVE params
 * (`HUB_LIVE_PARAMS`, lib/hub-view-key.ts — the bare root forwards it to a shop), so every Discover visitor would
 * have skipped the cached Event Hub and cost a full server render. `via` is read by NO server code — only by the
 * browser — so the cached copy still answers and the server never sees the marker: it cannot reach a canonical
 * URL, an OG tag or the sitemap.
 *
 * Pure and dependency-free: Discover's card, the event page's button and the guards all ask it.
 * 🔒 lib/discover-way-back.test.ts
 */
import { HOME_HREF } from './home-segments';

/** The marker's query key and value: `?via=discover`. Read in the browser only — never by a server render. */
export const DISCOVER_ARRIVAL_PARAM = 'via';
export const DISCOVER_ARRIVAL_VALUE = 'discover';

/** Where a back from Discover goes when it cannot step back in place: Discover itself. */
export const DISCOVER_WAY_BACK = { href: '/', label: 'Discover' } as const;

/**
 * "Home" for a page opened cold — nothing of ours behind it (the drawing: *"A page opened cold … shows 'Discover'
 * signed out and 'Home' signed in"*). Home is the account bar's own Home (`HOME_HREF`).
 */
export function coldWayBack(signedIn: boolean): { href: string; label: string } {
  return signedIn ? { href: HOME_HREF, label: 'Home' } : { ...DISCOVER_WAY_BACK };
}

function splitHref(href: string): { path: string; q: URLSearchParams; hash: string } {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf('?');
  return {
    path: qAt >= 0 ? noHash.slice(0, qAt) : noHash,
    q: new URLSearchParams(qAt >= 0 ? noHash.slice(qAt + 1) : ''),
    hash,
  };
}

function joinHref(path: string, q: URLSearchParams, hash: string): string {
  const qs = q.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}

/** A Discover event card's link: the event's address with the arrival marker on (its own query and `#hash` kept). */
export function withDiscoverArrival(href: string): string {
  const { path, q, hash } = splitHref(href);
  q.set(DISCOVER_ARRIVAL_PARAM, DISCOVER_ARRIVAL_VALUE);
  return joinHref(path, q, hash);
}

/** Did this visit arrive from Discover? `search` is `location.search` (with or without its `?`). */
export function arrivedFromDiscover(search: string): boolean {
  return new URLSearchParams(search.replace(/^\?/, '')).get(DISCOVER_ARRIVAL_PARAM) === DISCOVER_ARRIVAL_VALUE;
}

/** The same address with the marker taken out — what the address bar shows once the page has read it. */
export function withoutDiscoverArrival(href: string): string {
  const { path, q, hash } = splitHref(href);
  q.delete(DISCOVER_ARRIVAL_PARAM);
  return joinHref(path, q, hash);
}
