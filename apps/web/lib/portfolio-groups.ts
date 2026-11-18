/**
 * lib/portfolio-groups.ts — 🖼 PORTFOLIO IN THREE GROUPS (THE ONE BUILD §10 #35, owner 8 Nov: *"All their events ·
 * Specific Services they have · Specific Inspiration they curated"*; Build 2 lane B2-B). Pure: the page's loader, the
 * lab and the guard share it. Tested in `lib/portfolio-groups.test.ts`.
 *
 *   ALL YOUR EVENTS          one album per event, newest first — the shop's PRIVATE Papic album
 *                            (`vendor_papic_portfolio_photos`, screened and not taken down), titled by its booking.
 *   YOUR SERVICES            one album per service card — that card's photos (`vendor_services.primary_photo_r2_key` +
 *                            `showcase_photo_r2_keys`). A card with no photo is not an album.
 *   INSPIRATION YOU CURATED  one album per part — the shop's approved library looks (`fetchShopInspirationLooks`, what
 *                            its page shows), grouped by the part in the couple's words.
 * then ALL PHOTOS (the page gallery) and the stories couples published (`loadVendorFeaturedStories`).
 *
 * 🔑 NO NEW TABLE — every album is a store that already exists. 🔑 A REFUSED READ IS `null` → "Couldn't load", never an
 * empty group (an empty group is a claim about the supplier).
 */
import { formatCount } from './format-number';

/** How many photos an opened album draws before its "+N" tile (the panel is the whole body: 8 rows of 3). */
export const ALBUM_OPEN_MAX = 24;

export type PortfolioAlbum = {
  /** Stable within its group (event id · service id · part). */
  key: string;
  title: string;
  /** "Sun 8 Nov · 180 photos" · "24 photos". */
  line: string;
  /** Display URLs, newest first, at most `ALBUM_OPEN_MAX`. */
  urls: string[];
  /** How many the album holds (the "+N" tile counts the rest). */
  total: number;
  /** Where the whole album lives, when it has its own screen (an event's album page). */
  href: string | null;
  /**
   * 💸 GREYED WHILE A TOP-UP IS OVERDUE (owner 2026-11-12, booking-fee top-up; prototype "Hub · Event photos by
   * service"): the event's booking-fee top-up is past its event day and unsettled — the album is drawn greyed under
   * "Unlisted and uncounted until the top-up is settled · Settle ›", and `href` is where to settle. Absent → as shipped.
   */
  unlisted?: { href: string } | null;
  /** The ISO time of its newest photo, where the album knows one (an event's) — Row 1's "Newest" sort. */
  newest?: string | null;
  /**
   * 📍 WHERE AND WHAT (owner 2026-11-19: *"when i type a place, example tagaytay, i see all event albums from tagaytay,
   * services inspiration and videos taken there as well"*) — extra words Search matches besides the title and the line:
   * an event's venue and address, the service cards booked at it; a service card's events' venues; an inspiration
   * part's tagged events. Only what is ALREADY linked — nothing is tagged by hand. Never drawn.
   */
  words?: string;
  /** An event album's venue ("Taal Vista Hotel") and the shop's service cards booked at it — drawn on the event. */
  place?: string | null;
  services?: string[];
};

/** What the page knows about one event the shop worked: its venue, its address, and the shop's cards booked at it. */
export type EventFacts = { venue: string | null; address: string | null; services: string[] };
export type EventFactsMap = ReadonlyMap<string, EventFacts>;

export type PortfolioStory = { eventId: string; slug: string; hostNames: string; line: string };

export type PortfolioGroups = {
  /** null = unread. */
  events: PortfolioAlbum[] | null;
  services: PortfolioAlbum[] | null;
  /** null = unread · 'off' = this shop does not supply looks (no group drawn). */
  inspiration: PortfolioAlbum[] | null | 'off';
  /** The stories couples published with this shop credited; null = unread. */
  stories: PortfolioStory[] | null;
};

const photos = (n: number) => `${formatCount(n)} ${n === 1 ? 'photo' : 'photos'}`;

/** "Sun 8 Nov" (this year) · "Sun 8 Nov 2025" — from a YYYY-MM-DD civil date, through UTC so no timezone shifts it. */
export function albumDay(iso: string, thisYear: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', ...(y === thisYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

/**
 * ALL YOUR EVENTS — the album rows grouped by event (rows newest first), each titled by the booking it belongs to.
 * An event with no booking row this shop can read still has its album ("Your booked event"); an event with no photo is
 * not an album. Albums are ordered by their newest photo.
 */
export function eventAlbums(
  rows: ReadonlyArray<{ eventId: string; url: string | null; createdAt: string }>,
  bookings: ReadonlyArray<{ eventId: string; eventName: string | null; bookedDate: string }>,
  {
    thisYear,
    albumHref,
    unlisted = null,
    facts = null,
  }: {
    /** 📍 Event id → its venue, address and booked cards. Absent/unread → albums as shipped, found by name only. */
    facts?: EventFactsMap | null;
    thisYear: number;
    albumHref: ((eventId: string) => string) | null;
    /** 💸 Event id → where to settle its OVERDUE top-up (`overdueTopUps`). Absent → nothing is greyed. */
    unlisted?: ReadonlyMap<string, string> | null;
  },
): PortfolioAlbum[] {
  const first = new Map<string, { name: string | null; date: string }>();
  for (const b of bookings) {
    const cur = first.get(b.eventId);
    if (!cur || b.bookedDate < cur.date) first.set(b.eventId, { name: b.eventName, date: b.bookedDate });
  }
  const by = new Map<string, { urls: string[]; total: number; newest: string }>();
  for (const r of [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const cur = by.get(r.eventId) ?? { urls: [], total: 0, newest: r.createdAt };
    cur.total += 1;
    if (r.url && cur.urls.length < ALBUM_OPEN_MAX) cur.urls.push(r.url);
    by.set(r.eventId, cur);
  }
  return [...by.entries()]
    .sort((a, b) => b[1].newest.localeCompare(a[1].newest))
    .map(([eventId, a]) => {
      const bk = first.get(eventId);
      return {
        key: eventId,
        title: (bk?.name ?? '').trim() || 'Your booked event',
        line: [bk ? albumDay(bk.date, thisYear) : null, facts?.get(eventId)?.venue ?? null, 'Papic album', photos(a.total)].filter(Boolean).join(' · '),
        ...(facts?.has(eventId)
          ? {
              place: facts.get(eventId)!.venue,
              services: facts.get(eventId)!.services,
              words: [facts.get(eventId)!.venue, facts.get(eventId)!.address, ...facts.get(eventId)!.services].filter(Boolean).join(' · '),
            }
          : {}),
        urls: a.urls,
        total: a.total,
        href: albumHref ? albumHref(eventId) : null,
        newest: a.newest,
        ...(unlisted?.has(eventId) ? { unlisted: { href: unlisted.get(eventId)! } } : {}),
      };
    });
}

/** YOUR SERVICES — one album per card that has a photo, in the cards' order. */
export function serviceAlbums(
  cards: ReadonlyArray<{ id: string; title: string | null; urls: string[]; total: number }>,
  /** 📍 Service id → the venues and addresses of the events it was booked at (Search by place). */
  places: ReadonlyMap<string, string> | null = null,
): PortfolioAlbum[] {
  return cards
    .filter((c) => c.total > 0)
    .map((c) => ({
      key: c.id,
      title: (c.title ?? '').trim() || 'Your service card',
      line: photos(c.total),
      ...(places?.get(c.id) ? { words: places.get(c.id)! } : {}),
      urls: c.urls.slice(0, ALBUM_OPEN_MAX),
      total: c.total,
      href: null,
    }));
}

/** INSPIRATION YOU CURATED — the approved looks, one album per part, the part with the newest look first. */
export function inspirationAlbums(
  looks: ReadonlyArray<{ id: string; url: string; part: string }>,
  /** 📍 Look id → its tagged event's line ("Wedding · Taal Vista Hotel · Sep 2026"), where it has one. */
  eventLines: ReadonlyMap<string, string> | null = null,
): PortfolioAlbum[] {
  const by = new Map<string, { urls: string[]; total: number; words: Set<string> }>();
  for (const l of looks) {
    const cur = by.get(l.part) ?? { urls: [], total: 0, words: new Set<string>() };
    const line = eventLines?.get(l.id);
    if (line) cur.words.add(line);
    cur.total += 1;
    if (cur.urls.length < ALBUM_OPEN_MAX) cur.urls.push(l.url);
    by.set(l.part, cur);
  }
  return [...by.entries()].map(([part, a]) => ({
    key: part,
    title: part,
    line: photos(a.total),
    urls: a.urls,
    total: a.total,
    href: null,
    ...(a.words.size > 0 ? { words: [...a.words].join(' · ') } : {}),
  }));
}

/** A group's heading count — "· 4" when read, nothing when not. */
export function groupCount(albums: ReadonlyArray<unknown> | null): string {
  return albums === null ? '' : ` · ${formatCount(albums.length)}`;
}
