/**
 * shop-back.ts — the way BACK from a shop page, as one rule.
 *
 * Owner, 7 Nov 2026, verbatim: *"there are links on the supplier website that is incorrect. example. back to
 * suppliers? it went to a wrong shell … i tapped setnaprod then pressed inquire. then pressing back to suppliers led
 * to this."* — "this" being `/explore`, the public marketplace, reached from a shop he had opened on Discover.
 *
 * ── WHAT WAS BROKEN ─────────────────────────────────────────────────────────────────────────────────────
 * The shop page's only back control (the foot of the Inquire section — on a phone the header draws none) was a
 * fixed `<Link href="/explore">Back to suppliers</Link>`. Every arrival got `/explore`: from Discover, from an
 * event's Suppliers page, from a saved supplier, from a shared link. Only the `/explore` arrival was right.
 *
 * 🔑 THE DESTINATION IS READ FROM THE ARRIVAL, NOT INVENTED. The shop page already carries "where did you come
 * from" — `?src=` (the arrival tag `/explore` cards, saved suppliers and Journal credits put on the link, read by
 * the inquiry's attribution, `lib/inquiry-source.ts`) and `?event=` (the event the couple is choosing for, CHECKED
 * against their own events before it is believed — `app/v/[slug]/page.tsx`). This module turns those two into the
 * back door, so no second back mechanism exists. The doors that open a shop now say where they are
 * (`SHOP_ARRIVAL_SRC`), and every screen the shop opens carries the arrival on (`withShopArrival`), so the back
 * door is still right after Check a date, the event picker, the reviews pager or the waitlist.
 *
 * ⚖ NO ARRIVAL, NO "BACK". A shared link or a search engine has nothing of ours behind it. The door then goes to the
 * shop page's home in `lib/page-home.ts`'s sense — the marketplace — and SAYS so ("See more suppliers"), so it never
 * claims to go back somewhere the person never was.
 *
 * Pure and dependency-free: the server page, the client check-a-date calendar and the guard all ask it.
 * 🔒 lib/shop-back.test.ts
 */

/** The arrival tags a door into a shop page may carry. Free text on the view row; these are the ones with a back. */
export const SHOP_ARRIVAL_SRC = {
  /** `/explore` — the marketplace's cards and compare table. */
  explore: 'explore',
  /** The Discover tab's (`/`) shelf of shops. */
  discover: 'discover',
  /** Discover's own search results and the signed-in search (`/dashboard/search`, which forwards to `/` with no words). */
  search: 'search',
  /** Memories › Saved suppliers (`/dashboard/library?tab=vendors`). */
  favorites: 'favorites',
} as const;

/** The query keys that say where a person came from. Never shared, always carried. */
export const SHOP_ARRIVAL_KEYS = ['src', 'event'] as const;

export type ShopArrival = {
  /** `?src=` as it arrived (any value — only the ones above choose a back). */
  src: string | null;
  /** `?event=` — ONLY once the page has checked it is one of the viewer's own events. Never the raw param. */
  eventId: string | null;
};

export type ShopBackDoor = {
  /** Always an in-app absolute path. */
  href: string;
  /** Names where it goes — the root map's "doors whose words do not match where they land" check. */
  label: string;
  /** True when it returns to where the person came from; false for the cold arrival's forward door. */
  back: boolean;
};

export const SHOP_BACK_COLD: ShopBackDoor = { href: '/explore', label: 'See more suppliers', back: false };

/** The one rule. An explicit origin wins over the event, which wins over nothing. */
export function shopBackDoor({ src, eventId }: ShopArrival): ShopBackDoor {
  switch (src) {
    case SHOP_ARRIVAL_SRC.explore:
      return { href: '/explore', label: 'Back to suppliers', back: true };
    case SHOP_ARRIVAL_SRC.discover:
    case SHOP_ARRIVAL_SRC.search:
      return { href: '/', label: 'Back to Discover', back: true };
    case SHOP_ARRIVAL_SRC.favorites:
      return { href: '/dashboard/library?tab=vendors', label: 'Back to saved suppliers', back: true };
    default:
      break;
  }
  if (eventId) return { href: `/dashboard/${encodeURIComponent(eventId)}/vendors`, label: 'Back to suppliers', back: true };
  return SHOP_BACK_COLD;
}

/** A tidy arrival from a URL's raw values (the event still UNCHECKED — the caller checks it). */
export function arrivalParams(search: { src?: unknown; event?: unknown }): { src: string | null; event: string | null } {
  const clean = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v.trim()) ? v.trim() : null);
  return { src: clean(search.src), event: clean(search.event) };
}

/**
 * `href` with the arrival carried on (and `extra` set), keeping its own query and `#hash`. Used for every screen the
 * shop opens and every way back onto it, so the back door survives the round trip.
 */
export function withShopArrival(
  href: string,
  arrival: { src: string | null; event?: string | null; eventId?: string | null },
  extra: Readonly<Record<string, string>> = {},
): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf('?');
  const path = qAt >= 0 ? noHash.slice(0, qAt) : noHash;
  const q = new URLSearchParams(qAt >= 0 ? noHash.slice(qAt + 1) : '');
  const event = arrival.eventId ?? arrival.event ?? null;
  if (arrival.src && !q.has('src')) q.set('src', arrival.src);
  if (event && !q.has('event')) q.set('event', event);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  const qs = q.toString();
  return `${path}${qs ? `?${qs}` : ''}${hash}`;
}

/**
 * A door into a shop from INSIDE an event (its Suppliers pages, a package, a review): the shop page checks the event
 * is the viewer's own, scopes Inquire to it, and its back door returns to that event's Suppliers.
 */
export function shopHrefForEvent(slug: string, eventId: string, hash = ''): string {
  return withShopArrival(`/v/${encodeURIComponent(slug)}${hash}`, { src: null, eventId });
}

/**
 * The address to SHARE: the shop page without where THIS person came from. Share used to send
 * `window.location.href` whole — so a friend's copy said they came from Discover, and an event id rode along.
 */
export function shareableShopUrl(href: string): string {
  try {
    const u = new URL(href);
    for (const k of [...SHOP_ARRIVAL_KEYS, 'wl', 'reviewsPage']) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return href;
  }
}
