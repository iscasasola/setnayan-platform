/**
 * Discover's pinned row: the numbers and the parts it lists (walker D2a, 18 Nov 2026).
 *
 * Ruling: DECISION_LOG 2026-10-28 "USER DASHBOARD PART 2 — EVENTS · DISCOVER · MEMORIES — APPROVED": *"Discover (the /
 * front page): Discover ▾ (… its own sections) · "N upcoming · N new" · Following (a toggle: only people you follow) · ⚙
 * … Counts from the real reads; never a default 0 on a refused read."* Drawn in
 * `prototypes/user_dashboard_clean_2026-11-17/user_dashboard_clean_2026-11-17_fable.html` ("approved 28 Oct, not yet in
 * the app").
 *
 * ⚠ "N new" IS NOT DRAWN. It counted the "New uploads" section, which the 16 Nov "Discover in six parts" ruling retired
 * (the drawing marks New uploads `now-only`). With no part of Discover that is "new", a number would have no source.
 * Named in the PR as an owner question, never filled with a guess.
 *
 * Pure: no React, no reads. Held by `lib/discover-pin.test.ts`.
 */
import type { DiscoverEventCard } from '@/lib/discover-events-core';

type Shelf<T> = { status: 'ok'; items: T[] } | { status: 'unavailable' };

/** `?following=1` — the toggle's one parameter. Anything else is off. */
export const DISCOVER_FOLLOWING_PARAM = 'following';

export function discoverFollowingOn(params: Record<string, string | string[] | undefined>): boolean {
  const v = params[DISCOVER_FOLLOWING_PARAM];
  return (Array.isArray(v) ? v[0] : v) === '1';
}

/** The address the toggle goes to — `/` with it on, `/` with it off. Nothing else rides along. */
export function discoverFollowingHref(on: boolean): string {
  return on ? '/' : `/?${DISCOVER_FOLLOWING_PARAM}=1`;
}

/**
 * How many upcoming events Discover is showing — the events the shelves actually read, each counted once (an event can
 * sit on both shelves). With Following on, only the people you follow.
 *
 * `null` = it could not be counted (a shelf it needs was refused). Never 0 for that: "0 upcoming" is a measured claim.
 */
export function discoverUpcomingCount(
  people: Shelf<DiscoverEventCard> | null,
  world: Shelf<DiscoverEventCard>,
  followingOnly: boolean,
): number | null {
  const shelves = followingOnly ? [people] : [people, world];
  const keys = new Set<string>();
  for (const s of shelves) {
    if (s === null) {
      if (followingOnly) return null;
      continue;
    }
    if (s.status !== 'ok') return null;
    for (const c of s.items) keys.add(c.key);
  }
  return keys.size;
}

/** The picker's options: Discover's own parts, in page order. `selector` is the part's mark on the page. */
export type DiscoverPart = { key: string; label: string; selector: string };

export const DISCOVER_PARTS: readonly DiscoverPart[] = [
  { key: 'all', label: 'All', selector: '[data-fd-page]' },
  { key: 'upcoming', label: 'Upcoming events', selector: '[data-discover-shelf="people"], [data-discover-shelf="world"]' },
  { key: 'suppliers', label: 'Suppliers', selector: '[data-discover-part="suppliers"]' },
  { key: 'people', label: 'People to follow', selector: '[data-discover-shelf="people-to-follow"]' },
  { key: 'service-cards', label: 'Service cards', selector: '[data-discover-part="service-cards"]' },
  { key: 'event-stories', label: 'Event stories', selector: '[data-discover-part="event-stories"]' },
  { key: 'articles', label: 'Articles', selector: '[data-discover-part="articles"]' },
  { key: 'inspiration', label: 'Inspiration', selector: '[data-discover-part="inspiration"]' },
];
