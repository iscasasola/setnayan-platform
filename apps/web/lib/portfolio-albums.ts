/**
 * lib/portfolio-albums.ts — 🖼 PORTFOLIO, SIMPLER: ROW 1 AND THE ONE SORT BUTTON (owner 2026-11-19, *"portfolio simpler
 * approved"* · *"just one: show and sort"* · *"no word just icon"*; drawing artifact 7SfMdJW9mryK59pm7bKa5A). Pure: the
 * page, the lab and the guard share it. Tested in `lib/portfolio-albums.test.ts`.
 *
 *   ROW 1      the shop's ALBUMS in one strip — the page gallery, one per event, one per service card, one per
 *              inspiration part (`lib/portfolio-groups.ts`; no new album) — ordered by the Sort.
 *   SHOW       a FILTER, set by default to the most common view: All · Events · Services · Inspiration · Videos.
 *   SORT       Most viewed (default) · Opened by you · Newest.
 *
 * 🔑 "MOST VIEWED" READS THE COUNTERS THE APP ALREADY HAS, AND NOTHING ELSE: a service card's album = that card's opens
 * (`service_card_opens()`), the page gallery's = its photos' views summed (`vendor_portfolio_photo_views`). An event
 * album is the shop's PRIVATE Papic album and an inspiration look has no open on the public page, so neither CAN be
 * counted: its `views` is `null` — drawn with no count and sorted after the counted ones, never as 0 (a 0 would be a
 * claim that nobody looked). A second counter for the same fact is what CLAUDE.md rule 8 forbids.
 * 🔑 "OPENED BY YOU" is `vendor_album_opens` (migration 20271351728222) — when the shop's own people last opened each.
 */
import { formatCount } from './format-number';
import type { PortfolioAlbum, PortfolioGroups } from './portfolio-groups';

export type AlbumKind = 'page' | 'event' | 'service' | 'inspiration';
export type PortfolioShow = 'all' | 'events' | 'services' | 'inspiration' | 'videos';
export type PortfolioSort = 'most' | 'opened' | 'newest';

export const PORTFOLIO_SHOW_DEFAULT: PortfolioShow = 'all';
export const PORTFOLIO_SORT_DEFAULT: PortfolioSort = 'most';

/** The one dropdown's two groups, in the drawing's order and words. */
export const PORTFOLIO_SHOW_CHOICES: ReadonlyArray<{ key: PortfolioShow; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'services', label: 'Services' },
  { key: 'inspiration', label: 'Inspiration' },
  { key: 'videos', label: 'Videos' },
];
export const PORTFOLIO_SORT_CHOICES: ReadonlyArray<{ key: PortfolioSort; label: string }> = [
  { key: 'most', label: 'Most viewed' },
  { key: 'opened', label: 'Opened by you' },
  { key: 'newest', label: 'Newest' },
];

/** The dot on the Sort round: anything that is not the default. */
export function portfolioSortIsOn(show: PortfolioShow, sort: PortfolioSort): boolean {
  return show !== PORTFOLIO_SHOW_DEFAULT || sort !== PORTFOLIO_SORT_DEFAULT;
}

/** What the page read for Row 1. Each part fails on its own into `null` = not read (never 0, never "never"). */
export type AlbumStats = {
  /** Service id → couples' opens of that card (`service_card_opens().opens_12m`). */
  serviceOpens: Record<string, number> | null;
  /** The page gallery's photo views, summed (`vendor_portfolio_photo_views`). */
  pageViews: number | null;
  /** `${kind}:${key}` → the ISO time the shop last opened that album (`vendor_album_opens`). */
  opened: Record<string, string> | null;
};
export const ALBUM_STATS_UNREAD: AlbumStats = { serviceOpens: null, pageViews: null, opened: null };

export type RowAlbum = {
  kind: AlbumKind;
  /** Stable within its kind (`'page'` · event id · service id · part). */
  key: string;
  title: string;
  line: string;
  cover: string | null;
  /** Couples' views; `null` = this album is not counted, or the count was not read. Never drawn as 0. */
  views: number | null;
  /** When the shop last opened it; `null` = never, or not read. */
  openedAt: string | null;
  /** Its newest photo's time, where the album knows one (events). */
  newestAt: string | null;
  /** The group album behind it; `null` for the page gallery. */
  album: PortfolioAlbum | null;
  /** 📍 Extra words Search matches (`PortfolioAlbum.words`): the venue, the address, the cards booked there. */
  words: string;
};

export const albumId = (kind: AlbumKind, key: string) => `${kind}:${key}`;

const fromGroup = (kind: Exclude<AlbumKind, 'page'>, list: PortfolioAlbum[] | null | 'off', views: (a: PortfolioAlbum) => number | null, stats: AlbumStats): RowAlbum[] =>
  Array.isArray(list)
    ? list
        .filter((a) => a.urls.length > 0)
        .map((a) => ({
          kind,
          key: a.key,
          title: a.title,
          line: a.line,
          cover: a.urls[0] ?? null,
          views: views(a),
          openedAt: stats.opened?.[albumId(kind, a.key)] ?? null,
          newestAt: a.newest ?? null,
          album: a,
          words: a.words ?? '',
        }))
    : [];

/** Every album the shop has, as listed: the page gallery, then events, service cards, inspiration parts. */
export function portfolioAlbums(
  groups: PortfolioGroups,
  page: { title: string; line: string; urls: readonly string[] },
  stats: AlbumStats,
): RowAlbum[] {
  const out: RowAlbum[] = [];
  if (page.urls.length > 0)
    out.push({ kind: 'page', key: 'page', title: page.title, line: page.line, cover: page.urls[0] ?? null, views: stats.pageViews, openedAt: stats.opened?.[albumId('page', 'page')] ?? null, newestAt: null, album: null, words: '' });
  out.push(...fromGroup('event', groups.events, () => null, stats));
  out.push(...fromGroup('service', groups.services, (a) => (stats.serviceOpens ? (stats.serviceOpens[a.key] ?? 0) : null), stats));
  out.push(...fromGroup('inspiration', groups.inspiration, () => null, stats));
  return out;
}

/** Does the Show filter keep this kind of album? The page gallery is the shop's own, so only All shows it. */
export function showKeepsAlbum(show: PortfolioShow, kind: AlbumKind): boolean {
  if (show === 'all') return true;
  if (show === 'events') return kind === 'event';
  if (show === 'services') return kind === 'service';
  if (show === 'inspiration') return kind === 'inspiration';
  return false;
}

/** The four ways in, and which the Show filter keeps. */
export type PortfolioWay = 'events' | 'services' | 'inspiration' | 'videos';
export const showKeepsWay = (show: PortfolioShow, way: PortfolioWay) => show === 'all' || show === way;

/** A value sorted first when it is larger; a `null` (uncounted · never) always after every answered one. */
const desc = <T extends number | string>(of: (a: RowAlbum) => T | null) => (a: RowAlbum, b: RowAlbum) => {
  const x = of(a);
  const y = of(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? 1 : x > y ? -1 : 0;
};

/** Row 1 in the Sort's order. Stable: ties (and every uncounted album) keep the order they were listed in. */
export function sortAlbums(list: readonly RowAlbum[], sort: PortfolioSort): RowAlbum[] {
  const by = sort === 'most' ? desc((a) => a.views) : sort === 'opened' ? desc((a) => a.openedAt) : desc((a) => a.newestAt);
  return list.map((a, i) => [a, i] as const).sort((p, q) => by(p[0], q[0]) || p[1] - q[1]).map((p) => p[0]);
}

/** Row 1's heading follows the Sort. */
export function albumRowHeading(sort: PortfolioSort): string {
  return sort === 'most' ? 'Most viewed albums' : sort === 'opened' ? 'Albums you opened' : 'Newest albums';
}

/** The quiet line under the heading — who did the looking, or what the order is. */
export function albumRowLine(sort: PortfolioSort, stats: AlbumStats): string {
  if (sort === 'most') return stats.serviceOpens === null && stats.pageViews === null ? 'Couldn’t load the views just now' : 'by couples';
  if (sort === 'opened') return stats.opened === null ? 'Couldn’t load what you opened just now' : 'the ones you opened last, first';
  return 'newest first';
}

/** The ⓘ beside Row 1 — why some albums wear no count (one line, the owner's "never show a fake 0"). */
export const ALBUM_UNCOUNTED_NOTE =
  'Views count couples opening a service card or a photo on your page. Event albums are private to your shop and inspiration photos can’t be opened on your page, so they have no count and come after the counted ones.';

/** The badge on a tile — "212 views"; nothing when the album is not counted. */
export function albumViewsLabel(views: number | null): string | null {
  return views === null ? null : `${formatCount(views)} ${views === 1 ? 'view' : 'views'}`;
}

/** Does this album answer the search words? Its name or its line. Empty words keep everything. */
export function albumMatches(a: { title: string; line: string; words?: string }, words: string): boolean {
  const needle = words.trim().toLowerCase();
  return !needle || a.title.toLowerCase().includes(needle) || a.line.toLowerCase().includes(needle) || (a.words ?? '').toLowerCase().includes(needle);
}
