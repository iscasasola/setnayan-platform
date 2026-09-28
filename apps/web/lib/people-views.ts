/**
 * people-views.ts — the People page's views, by URL (owner 2026-09-28, the
 * People redesign, people-redesign.html).
 *
 * Owner: *"People is same as Alaga and Samahan"* — one page, one picker:
 * Requests · Connected · Following · Followers · Alaga · Samahan. The page reads
 * `?view=`, the rail lights by the SAME resolver, and the picker lists the same
 * keys — so the lit row, the open view and the picked option cannot disagree.
 *
 * A plain module (no `server-only`, no React): the page (server), the rail
 * (client) and the picker (client) all import it, and a unit test executes it.
 */

import { formatCount } from './format-number';

export const PEOPLE_VIEWS = [
  'requests',
  'connected',
  'following',
  'followers',
  'alaga',
  'samahan',
] as const;

export type PeopleView = (typeof PEOPLE_VIEWS)[number];

/** One word per concept. "Connected" is the view; the rail calls the same
 *  place "People" because the rail's heading is already "People". */
export const PEOPLE_VIEW_LABEL: Record<PeopleView, string> = {
  requests: 'Requests',
  connected: 'Connected',
  following: 'Following',
  followers: 'Followers',
  alaga: 'Alaga',
  samahan: 'Samahan',
};

export type PeopleViewGates = {
  /** `peopleConnectionsEnabled()` — Requests and Connected live on it. */
  showConnections: boolean;
  /** The dependents flag AND the privacy control — the Alaga view lives on it. */
  showDependents: boolean;
};

/** The views this account can open, in the picker's order. Following,
 *  Followers and Samahan are live product and never flagged. */
export function availablePeopleViews(g: PeopleViewGates): PeopleView[] {
  return PEOPLE_VIEWS.filter((v) => {
    if (v === 'requests' || v === 'connected') return g.showConnections;
    if (v === 'alaga') return g.showDependents;
    return true;
  });
}

/** The first view this account has — Connected when connections are on. */
export function defaultPeopleView(g: PeopleViewGates): PeopleView {
  return availablePeopleViews(g).find((v) => v !== 'requests') ?? 'samahan';
}

/**
 * `?view=` → the view that opens. Anything unknown, or a view this account
 * cannot open, lands on the default — never on an empty page.
 */
export function resolvePeopleView(raw: string | null | undefined, g: PeopleViewGates): PeopleView {
  const want = (raw ?? '').trim().toLowerCase();
  const open = availablePeopleViews(g);
  return (open as string[]).includes(want) ? (want as PeopleView) : defaultPeopleView(g);
}

/** The URL of a view. The default view is the bare page, so the bell's
 *  `/dashboard/people` and the Connected row are one address. */
export function peopleViewHref(view: PeopleView, g: PeopleViewGates): string {
  return view === defaultPeopleView(g) ? '/dashboard/people' : `/dashboard/people?view=${view}`;
}

/**
 * The picker's rows. Requests appears ONLY while somebody is waiting on you
 * (owner 2026-09-28: "pinned at top of Connected AND first in the dropdown,
 * with a dot, while any wait") — or while that count is UNKNOWN, because a
 * refused read must not hide a request. A count that could not be read is left
 * off the label rather than printed as 0.
 */
export function peopleViewOptions(
  g: PeopleViewGates,
  counts: Partial<Record<PeopleView, number | null>>,
  /** The open view — listed even at zero, so the picker never shows a blank. */
  current?: PeopleView,
): Array<{ key: PeopleView; label: string; dot?: boolean; dotNote?: string }> {
  return availablePeopleViews(g)
    .filter((v) => v !== 'requests' || counts.requests !== 0 || current === 'requests')
    .map((v) => {
      const n = counts[v];
      const label = typeof n === 'number' ? `${PEOPLE_VIEW_LABEL[v]} ${formatCount(n)}` : PEOPLE_VIEW_LABEL[v];
      return v === 'requests' && counts.requests !== 0
        ? { key: v, label, dot: true, dotNote: 'waiting on you' }
        : { key: v, label };
    });
}
