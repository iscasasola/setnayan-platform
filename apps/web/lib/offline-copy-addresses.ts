/**
 * 📶 THE SAVED COPY'S ADDRESSES — which addresses a copy may be kept for, and whose event each belongs to (EV3 +
 * "Your schedule" + R18's whole Event Hub; the shapes are `OFFLINE_COPY_SHAPES` and the guest's kept pages
 * `GUEST_HUB_TABS_KEPT` / `GUEST_HUB_ROOMS_KEPT` in `./offline-copies.ts`). Its own module because a guest's address
 * asks the reserved-word list (`./reserved-slugs.ts`), which no page's client code needs — the shared bundle has bytes
 * of room (`scripts/check-bundle-size.mjs`). The server and the tests import this; `public/sw.js` holds a COPY, and
 * `app/sw-offline-copies.test.ts` runs both over one table.
 *
 * PURE — no I/O.
 */
import { GUEST_HUB_ANSWER, GUEST_HUB_ROOMS_KEPT, GUEST_HUB_TABS_KEPT, OFFLINE_COPY_SHAPES } from './offline-copies';
import { RESERVED_SLUGS } from './reserved-slugs';
import { SHOP_SUB_PAGES } from './shop-address';
import { U_SUBPATH_ROUTES } from './u-nesting';

/**
 * An event's own pages — the folders under `app/[slug]/` that serve a URL. The address move (PR #7868) keeps the same
 * list as `EVENT_SUB_ROUTES` in `lib/u-nesting.ts`; until it merges it lives here, and `app/sw-offline-copies.test.ts`
 * holds it equal to the folders on disk, so a new event page cannot be added without joining it.
 */
export const EVENT_PAGE_FOLDERS: readonly string[] = [
  'announcement', 'avatar', 'cached', 'everyone', 'find-my-table', 'find-seat', 'hub', 'icon', 'invite',
  'live-pulse', 'live-wall', 'manifest.webmanifest', 'open-as-pass', 'pabuya', 'print', 'recap', 'redeem',
  'request', 'seat', 'sign-out', 'venue', 'welcome',
];

/**
 * 🔗 THE SECOND WORDS THAT ARE NEVER AN EVENT UNDER A PERSON (the address move's rule, `isNotANestedEvent` in #7868):
 * in `/{a}/{b}`, a `{b}` that is one of an event's pages, a shop's page under its bare address (`SHOP_SUB_PAGES`) or a
 * person's chapter (`U_SUBPATH_ROUTES`) means `/{a}` is the event (or shop) and `{b}` its page. Any other `{b}` is an
 * event under the person `{a}`. Names are one pool, so the second word alone decides — no database question.
 */
export const HUB_PAGE_WORDS: ReadonlySet<string> = new Set([...EVENT_PAGE_FOLDERS, ...SHOP_SUB_PAGES, ...U_SUBPATH_ROUTES]);

/** An event's word and a username, as they stand in an address (`lib/slugs.ts`, `users_slug_format`). */
const WORD = /^[a-z0-9-]{3,32}$/;
const KEPT_TABS: ReadonlySet<string> = new Set(GUEST_HUB_TABS_KEPT);
const KEPT_ROOMS: ReadonlySet<string> = new Set([...GUEST_HUB_ROOMS_KEPT, GUEST_HUB_ANSWER]);

/** A guest's Event Hub address, read: its event, what follows the event (`''`, `?tab=me`, `/find-my-table`…), and
 *  the ONE key its copy is kept under — the bare form, `/<event><suffix>`, whichever form was asked. */
export type GuestHubAddress = { event: string; suffix: string; key: string; nested: boolean };

/**
 * 📶 R18 — a guest Event Hub page this copy keeps, in either address form, or null:
 *   `/<event>` · `/<event>?tab=<kept tab>` · `/<event>/<kept room>` · `/<event>/announcement`
 *   `/{username}/<event>` · `/{username}/<event>?tab=<kept tab>` · `/{username}/<event>/<kept room>` · …/announcement
 * Never a reserved first word (an app page), never an event that is a page word, never any other query or page.
 */
export function guestHubAddress(path: string): GuestHubAddress | null {
  const q = path.indexOf('?');
  const pathname = q === -1 ? path : path.slice(0, q);
  const search = q === -1 ? '' : path.slice(q);
  const tab = /^\?tab=([a-z]+)$/.exec(search)?.[1] ?? null;
  if (search !== '' && (tab === null || !KEPT_TABS.has(tab))) return null;
  if (!pathname.startsWith('/')) return null;
  const parts = pathname.slice(1).split('/');
  if (parts.some((p) => p === '')) return null;
  const word = (w: string | undefined): w is string => !!w && WORD.test(w) && !RESERVED_SLUGS.has(w);
  const read = (event: string, suffix: string, nested: boolean): GuestHubAddress => ({
    event,
    suffix,
    key: `/${event}${suffix}`,
    nested,
  });
  const [a, b, c] = parts;
  if (parts.length === 1) return word(a) ? read(a, search, false) : null;
  if (parts.length === 2) {
    if (!word(a)) return null;
    if (KEPT_ROOMS.has(b!)) return search === '' ? read(a, `/${b}`, false) : null;
    if (HUB_PAGE_WORDS.has(b!) || !word(b)) return null;
    return read(b, search, true);
  }
  if (parts.length === 3) {
    if (search !== '' || !word(a) || !word(b) || HUB_PAGE_WORDS.has(b) || !KEPT_ROOMS.has(c!)) return null;
    return read(b, `/${c}`, true);
  }
  return null;
}

/** True when `path` (a pathname, plus the query where the shape has one) is one of the shapes. */
export function isOfflineCopyPath(path: string): boolean {
  return offlineCopyEventId(path) !== undefined;
}

/**
 * The event a path belongs to — its event segment (a guest's page: its event word) — or `null` for the supplier Hub,
 * which is the supplier's own page (it names no event, and it is kept under whichever event saved it). `undefined` =
 * not a copy path at all.
 */
export function offlineCopyEventId(path: string): string | null | undefined {
  for (const re of OFFLINE_COPY_SHAPES) {
    const m = re.exec(path);
    if (m) return m[1] ?? null;
  }
  return guestHubAddress(path)?.event;
}

/** The key a copy of `path` is kept under — the path itself, or a guest page's bare form — or null (not a copy path). */
export function offlineCopyKey(path: string): string | null {
  for (const re of OFFLINE_COPY_SHAPES) if (re.test(path)) return path;
  return guestHubAddress(path)?.key ?? null;
}

/** 📶 The event's bare hub address (`/<event>`, the key of its arrival page), or null for a word that is not one. */
export function guestHubBase(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  const g = guestHubAddress(`/${s}`);
  return g && g.event === s ? g.key : null;
}

/** 📅 The guest's own day: Event Hub › Me. Its key in the registry is the event word (lower-case). */
export function guestMePath(slug: string): string | null {
  const base = guestHubBase(slug);
  return base ? `${base}?tab=me` : null;
}
