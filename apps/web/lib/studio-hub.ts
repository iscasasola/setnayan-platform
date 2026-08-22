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
 * ⚠ THE FLAG DECIDES THE DOORWAY, NEVER WHETHER THE PAGES EXIST. Both
 * `/studio` and `/suite` sub-routes stay reachable by deep link either way;
 * only which one the menus point at changes.
 */
import { envFlagEnabled } from './env-flag';

/** Suite replaces the Studio hub when this is on (owner 2026-07-19). */
export const SUITE_NAV_ON = envFlagEnabled(process.env.NEXT_PUBLIC_SUITE);

/** The services hub for one event — the shelf holding every in-app service. */
export function studioHubHref(eventId: string): string {
  return `/dashboard/${eventId}/${SUITE_NAV_ON ? 'suite' : 'studio'}`;
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
