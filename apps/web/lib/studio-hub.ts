/**
 * studio-hub.ts — where "everything else on the shelf" lives, and what it is called.
 *
 * ─── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────
 * The hub's address and its name are decided by ONE flag, and that flag was
 * being read and branched on in three separate places — the desktop nav
 * builder, the phone's menu SSOT, and (from today) the rail's Studio group,
 * which needs the same answer for its "All services" row. Three copies of one
 * `flag ? A : B` is three chances for the rail to send somebody to a page the
 * bottom bar calls something else, with nothing thrown and nothing logged.
 *
 * So the branch lives here once. `NEXT_PUBLIC_SUITE` is inlined at build time,
 * so this neutral module reads the same value on the server and in the client
 * bundle — no hydration split.
 *
 * ⚠ SINCE 2026-10-02 THE FLAG DECIDES ONLY THE WORD ("More Services" vs
 * "Studio"). The two hub pages are deleted; the address is the More menu's
 * (`studioHubHref` below). The product pages under `/studio/<key>` are
 * untouched — only the index pages went.
 */
import { envFlagEnabled } from './env-flag';

/** Suite replaces the Studio hub when this is on (owner 2026-07-19). */
export const SUITE_NAV_ON = envFlagEnabled(process.env.NEXT_PUBLIC_SUITE);

/**
 * 🧭 THE MORE MENU IS THE ONE PLACE (owner 2026-10-02, tracker d1: *"remove
 * the old page — the More menu is the one place; old links forward"*).
 *
 * The full-page hub (`/suite`, and `/studio` before it) is GONE. "More
 * Services" is now only the menu: the rail's expanding row on a laptop and the
 * phone's "More" chooser sheet. Neither is a page, so its address is the
 * event's Home with `?more=services` — the bottom bar opens the sheet on it
 * and the rail opens the row on it (`asksForMoreServices`). Every link that
 * used to say "open the services" lands there, and the two retired paths
 * forward to it (`lib/legacy-redirects.ts`).
 *
 * The flag above no longer decides an address — only the row's word.
 */
export const MORE_SERVICES_PARAM = 'more';
export const MORE_SERVICES_VALUE = 'services';

/** Where "the services" opens for one event: Home, with the More menu open. */
export function studioHubHref(eventId: string): string {
  return `/dashboard/${eventId}?${MORE_SERVICES_PARAM}=${MORE_SERVICES_VALUE}`;
}

/** Does this query string (`location.search`) ask for the More menu open? */
export function asksForMoreServices(search: string): boolean {
  return new URLSearchParams(search).get(MORE_SERVICES_PARAM) === MORE_SERVICES_VALUE;
}

/**
 * What the hub is called in a menu that lists it BESIDE the Studio group.
 *
 * 🔑 NOT "Studio". Inside an event the rail now carries the Studio group
 * itself — the named products — so a second row also called Studio reads as a
 * different place. The same trap the Marketplace row already documents: the
 * same word twice in one rail is two places in the reader's head.
 */
export const STUDIO_HUB_ALL_LABEL = 'All services';
