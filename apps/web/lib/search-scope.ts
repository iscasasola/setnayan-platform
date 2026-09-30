/**
 * search-scope.ts — WHICH PLACE the top bar's search is pointed at.
 *
 * ─── THE RULE (owner 2026-09-23, DECISION_LOG.md) ────────────────────────
 * **The search searches the place you are standing in.** Owner, in his own
 * words: *"it must follow where they are pressing"* · *"on events, you want to
 * focus the search on the events of the user"* · *"Discover access everything
 * accessible from their account and everything public in the website"* — and
 * the reference that settles the shape: *"this concept is similar to shopee
 * when you enter a shop, you will only search inside the shop."*
 *
 * 🔑 DISCOVER IS NOT AN EXCEPTION. It looks like "the one that searches
 * everything", but it is the SAME rule at the widest node: Discover *is*
 * everything you may reach. The special case disappearing is how we know the
 * rule is the right one — and it is why this file has no "if discover" branch.
 *
 * ─── WHY THIS REUSES `activeRailKey` INSTEAD OF MATCHING PATHS ITSELF ────
 * The places NEST — Discover ⊃ Events ⊃ one event ⊃ that event's guests — so
 * resolving one requires "most specific wins", which is exactly the rule
 * `rail-active.ts` already implements and already tests (exact beats prefix,
 * then path length, then declared params, with list order as a stable
 * tie-break). A second path matcher here would be a second answer to one
 * question, and the two would drift the first time a route moved. So the
 * scopes are expressed as `RailMatchRow`s and handed to the shipped resolver.
 *
 * ─── 🛑 A SCOPE ONLY NARROWS WHEN IT HAS SOMETHING TO SEARCH ─────────────
 * This is the load-bearing rule in this file and the easiest one to break.
 * Narrowing the box to a place with no index does not make search better — it
 * makes the box PROMISE a search that returns nothing, which is precisely the
 * defect this repo keeps paying for (the public box promised "stories and
 * guides" for months with no resolver behind either noun; `public-search-
 * nouns.ts` exists because of it).
 *
 * So a place appears in `SCOPE_ROWS` only once a real source answers it.
 * Everything else falls through to the nearest scope that HAS one, which at
 * worst is `discover`. Memories, the vendor shop and inside-an-event are therefore
 * DELIBERATELY ABSENT for now: the rule is agreed for them and the index is not
 * built. Adding one is a row here plus a source there — never a row here alone.
 *
 * ✅ ONE EVENT'S GUESTS JOINED ON 2026-10-01 (owner 2026-09-30, DECISION_LOG
 * "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS; … THE TOP BAR SEARCHES
 * GUESTS": *"i thought we had a build that will make the search on the top to
 * do the search? so the text box on people will only be add?"* → *"ok"*). Its
 * source is the roster's own `?q=` filter, answered server-side by the Guest
 * list page — so on that page the top bar does not open the palette at all; it
 * IS the guest search (`guests-top-search.tsx`).
 *
 * ⚠ `/admin` IS ABSENT FOR THE OPPOSITE REASON — it already scopes itself.
 * The console hands `AppRailShell` its own `searchSlot` (`AdminSearchBox`, over
 * its pages, jobs and price rows), and a `searchSlot` wins over everything
 * here. Adding an 'admin' row would be a second, weaker answer to a question
 * that surface already answers well.
 *
 * ⚠ NEUTRAL BY DESIGN — no `server-only`. The placeholder and the labels are
 * read by the `'use client'` palette; the item filter is used on both sides.
 * Same reasoning as `public-search-nouns.ts`, which documents the RSC
 * value-export gotcha in full.
 */

import { activeRailKey, type RailMatchRow } from '@/app/_components/frontdoor/rail-active';

/** A place the search can be pointed at. Widen this only WITH a source. */
export type SearchScopeKey = 'discover' | 'events' | 'guests';

export type SearchScope = {
  key: SearchScopeKey;
  /**
   * What the box SAYS before anybody types.
   *
   * 🔑 THIS IS THE HALF OF THE SHOPEE PATTERN NOBODY WOULD INFER FROM
   * "narrow the results". On Shopee you do not discover you are in a shop's
   * search by getting shop-shaped results — the box tells you first. A box
   * that silently narrows is a box that looks broken to the one person whose
   * thing it just stopped finding.
   */
  placeholder: string;
  /** The same, shortened for a phone where the box is a fraction of a row. */
  shortPlaceholder: string;
  /**
   * The scope one step OUT, or null at the widest. The escape row climbs this,
   * so narrowing can never trap anybody with what they already typed.
   */
  widerKey: SearchScopeKey | null;
};

export const SEARCH_SCOPES: Record<SearchScopeKey, SearchScope> = {
  discover: {
    key: 'discover',
    // The widest node says the product's name, not a list of nouns. The old
    // hard-coded "Search events, people, vendors" promised two things the
    // index cannot resolve as rows (a person, a supplier) while hiding the two
    // it answers well (our writing, the shops we publish).
    placeholder: 'Search Setnayan',
    shortPlaceholder: 'Search',
    widerKey: null,
  },
  events: {
    key: 'events',
    placeholder: 'Search your events',
    shortPlaceholder: 'Your events',
    widerKey: 'discover',
  },
  guests: {
    key: 'guests',
    placeholder: 'Search guests',
    shortPlaceholder: 'Guests',
    // One step out is the events board: "inside one event" has no index yet,
    // so the next place that answers is your events.
    widerKey: 'events',
  },
};

/**
 * The scopes, as rows the shipped resolver can rank.
 *
 * ⚠ `exact: true` ON `/dashboard`, AND IT IS NOT A STYLE CHOICE. Every account
 * spoke lives beneath it — profile, notifications, Alaala, people. Left
 * prefix-matching, a person reading their own settings would be told the
 * search is pointed at their events, and typing a guide's title on
 * `/dashboard/notifications` would silently return nothing. The rail row for
 * the same path carries the same flag for the same reason.
 *
 * `discover` has NO ROW on purpose: it is the fallback, and a row for it would
 * make `/` compete with rows that should beat it.
 */
const SCOPE_ROWS: ReadonlyArray<RailMatchRow> = [
  { key: 'events', href: '/dashboard', exact: true },
];

/**
 * The ONE event-shaped row: that event's Guest list, as a literal href.
 *
 * 🔑 NOT A SECOND MATCHER. The shipped resolver ranks literal hrefs; a place
 * that belongs to one event needs that event's id in its href, so the row is
 * WRITTEN from the URL (`/dashboard/<id>/guests`) and then ranked by
 * `activeRailKey` like every other row. `exact`: the list itself only — a
 * guest's own card and the door crew's check-in desk are not the list whose
 * `?q=` this box drives.
 */
function eventGuestsRow(pathname: string): RailMatchRow[] {
  const seg = pathname.split('/');
  // ['', 'dashboard', '<eventId>', 'guests']
  if (seg.length !== 4 || seg[1] !== 'dashboard' || !seg[2] || seg[3] !== 'guests') return [];
  return [{ key: 'guests', href: `/dashboard/${seg[2]}/guests`, exact: true }];
}

/**
 * Which place this URL is. Never throws, never returns null — an unrecognised
 * page is standing in Discover, which is true: it is the widest node and it
 * contains everything the person may reach.
 */
export function resolveSearchScope(pathname: string | null | undefined): SearchScope {
  if (!pathname) return SEARCH_SCOPES.discover;
  const key = activeRailKey([...SCOPE_ROWS, ...eventGuestsRow(pathname)], pathname);
  return (key && SEARCH_SCOPES[key as SearchScopeKey]) || SEARCH_SCOPES.discover;
}

/**
 * Does one indexed row belong to this scope?
 *
 * 🔑 KEYED ON `kind`, NOT ON A HAND-KEPT LIST OF IDS. The index grows (a new
 * Samahan, a new action row) and a list of ids would have to be remembered in
 * a second place every time — the shape of drift this file is written to
 * avoid. `kind` is already the field the index assigns and the palette groups
 * by.
 *
 * `discover` admits everything BECAUSE OF THE RULE, not as a shortcut: the
 * widest place contains all of it.
 */
export function itemInScope(kind: 'event' | 'space' | 'action', scope: SearchScopeKey): boolean {
  if (scope === 'discover') return true;
  // The guests scope has no palette rows at all: on the Guest list the top bar
  // IS the roster's `?q=` filter, never the palette over your own things.
  if (scope === 'guests') return false;
  // Your events board is about events. The action rows beneath it ("Profile &
  // account", "Notifications") are navigation, not contents — they are still
  // one keystroke away through the escape row, which climbs to Discover.
  return kind === 'event';
}
