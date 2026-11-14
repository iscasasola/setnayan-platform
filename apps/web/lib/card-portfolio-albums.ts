/**
 * 🃏📸 ONE ALBUM, TWO PLACES — what a service card collected, and the supplier's Their work, read ONCE.
 *
 * Owner, 2026-10-08 (DECISION_LOG "EACH SERVICE CARD COLLECTS ITS OWN PROOF AND ITS OWN PORTFOLIO" → "ONE ALBUM, TWO
 * PLACES" → "APPROVED — THE SERVICE CARD MAKER DRAWING", frames 71–78 of `prototypes/supplier_dashboard_2026-10-08_fable.html`):
 * *"the service card collects proof of that service card and collect its own portolio"* · *"it should be connected to
 * the service card that got booked but will also be part of the vendor's portfolio."*
 *
 * Pure: the server read (`card-portfolio-albums.server.ts`), the edit sheet, the couple's grown card, Their work and
 * the guard (`card-portfolio-albums.test.ts`) share it.
 *
 *   THE JOIN     `card_portfolio_booked_events` (card, live event) pairs — `event_vendors.service_id` · a claimed lock's
 *                `vendor_service_ids` · an accepted quote's cards — under the Card Record's own booking filter.
 *   THE PHOTOS   by reference, never copied, from the two places that already decide what is public:
 *                · Files (`event_supplier_photos_listed`): a photo the supplier filed under a QUOTED card that the
 *                  couple SHOWED, inside the event's dates — it belongs to THAT card only (2026-11-12 "UPLOADS BELONG
 *                  TO THE QUOTED SERVICE");
 *                · the shop's Papic album (`supplier_page_photo_notices`): only once the 7-day guest notice has run
 *                  out with nobody removing it (2026-10-03 "… AFTER A 7-DAY GUEST NOTICE") — it belongs to the EVENT,
 *                  so it is on every card that event booked.
 *   TWO PLACES   `shopWorkAlbums` builds each event's album ONCE. `cardAlbums` hands a card the SAME album objects and
 *                the SAME photo objects (a filter, never a map/spread) — so the card's Portfolio row and Their work can
 *                never hold two copies that drift apart. Their work names every card the album was booked on
 *                (`bookedOnRows`): a multi-card booking = one row per card; a retired card keeps its name + "retired".
 *
 * 🔑 A label is type · venue · month — never a couple's name, never a date. A private event shows no venue.
 * 🔑 A card's own cover/showcase photos are the SUPPLIER'S OWN — "yours, not from an event", never proof.
 */
import { albumInspirations, type AlbumInspiration, type TagPart } from '@/lib/inspiration-tags';
import { formatCount } from './format-number';
import { formatEventTypeLabel } from './reviews';

/** The guest notice the album photos wait out (2026-10-03). The database stamps it; this re-checks it on read. */
export const GUEST_NOTICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How many tiles a row draws before "+N". */
export const ALBUM_STRIP_MAX = 4;

export type BookedVia = 'booking' | 'lock' | 'quote';

/** One row of `card_portfolio_booked_events`. */
export type BookedPair = { serviceId: string; eventId: string; delivered: boolean; via: BookedVia };

/** The event facts a label may use. */
export type AlbumEvent = {
  eventId: string;
  eventType: string | null;
  /** YYYY-MM-DD, the civil date as stored. */
  eventDate: string | null;
  venueName: string | null;
  /** `events.landing_page_visibility = 'private'` — the venue is not said (the `vendor-venue-events` rule). */
  isPrivate: boolean;
};

/** A `supplier_page_photo_notices` row, with its album row's hide. */
export type PageNoticeRow = {
  photoId: string;
  eventId: string;
  url: string | null;
  noticedAt: string;
  publicFrom: string;
  publishedAt: string | null;
  removedAt: string | null;
  albumHiddenAt: string | null;
};

/** An `event_supplier_photos_listed` photo (the couple showed it, inside the event's dates). */
export type ListedFileRow = { fileId: string; eventId: string; serviceId: string | null; url: string | null; at: string };

export type AlbumPhoto = {
  key: string;
  url: string;
  /** 'papic' = the shop's event album (after the notice) · 'files' = filed under a card in Files (the couple showed it). */
  from: 'papic' | 'files';
  /** The card a Files photo was filed under; null for an album photo (it belongs to the event). */
  serviceId: string | null;
  at: string;
};

/** One event's album — built ONCE, shown on every booked card and in Their work. */
export type WorkAlbum = {
  eventId: string;
  label: string;
  /** "Wedding · Dec 2025" — kind and month only, never the venue: the caption on each photo (photos by service). */
  kindMonth: string;
  /** For ordering only (never drawn). */
  sortDate: string;
  photos: AlbumPhoto[];
  delivered: boolean;
  /** The cards this event booked, in the order they were found. */
  bookedOn: string[];
};

/** A card's view of an album: the same album object, and the same photo objects that belong to this card. */
export type CardAlbum = { album: WorkAlbum; photos: AlbumPhoto[] };

export type CardRef = { id: string; title: string | null; category: string; isActive: boolean };

/** A Their work "Booked on › card" row. */
export type BookedOnRow = { serviceId: string; name: string; retired: boolean };

/**
 * THE 7-DAY RULE, re-checked on read: an album photo is public only when it was published, at or after its window
 * closed, the window was at least seven days from the notice, the window has passed NOW, nobody removed it, and its
 * album row is not hidden (a honoured takedown). Any one missing → not shown. The database already refuses most of
 * these; this is the reader's own floor, so a hand-edited row still cannot jump the notice.
 */
export function passedTheGuestNotice(n: PageNoticeRow, now: Date): boolean {
  if (!n.publishedAt || n.removedAt || n.albumHiddenAt || !n.url) return false;
  const noticed = Date.parse(n.noticedAt);
  const from = Date.parse(n.publicFrom);
  const published = Date.parse(n.publishedAt);
  if (![noticed, from, published].every(Number.isFinite)) return false;
  if (from - noticed < GUEST_NOTICE_DAYS * DAY_MS) return false;
  if (published < from) return false;
  return from <= now.getTime();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 2026" from a civil YYYY-MM-DD — no timezone can shift it. */
export function albumMonth(iso: string | null): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const mi = Number(m[2]) - 1;
  return MONTHS[mi] ? `${MONTHS[mi]} ${m[1]}` : null;
}

/** The approved label (2026-10-03): type · venue · month — a private event says "private venue", never its name. */
export function albumLabel(ev: AlbumEvent | undefined): string {
  if (!ev) return 'A booked event';
  const venue = ev.isPrivate ? 'private venue' : (ev.venueName ?? '').trim() || null;
  return [formatEventTypeLabel(ev.eventType), venue, albumMonth(ev.eventDate)].filter(Boolean).join(' · ');
}

/** "Wedding · Dec 2025" — the photo caption (2026-11-14 photos by service: kind of event and month, never a name or venue). */
export function kindMonthLabel(ev: AlbumEvent | undefined): string {
  if (!ev) return 'A booked event';
  return [formatEventTypeLabel(ev.eventType), albumMonth(ev.eventDate)].filter(Boolean).join(' · ');
}

/**
 * THEIR WORK — one album per booked event, newest first. An event with no photo is an album only when the work was
 * delivered ("delivered · no photos" — the honest line, never an empty grid). A Files photo joins its event's album
 * only when its card was booked on that event, so every photo in Their work is on at least one card.
 */
export function shopWorkAlbums(args: {
  pairs: readonly BookedPair[];
  events: ReadonlyMap<string, AlbumEvent>;
  notices: readonly PageNoticeRow[];
  files: readonly ListedFileRow[];
  now: Date;
}): WorkAlbum[] {
  const byEvent = new Map<string, { bookedOn: string[]; delivered: boolean }>();
  for (const p of args.pairs) {
    const cur = byEvent.get(p.eventId) ?? { bookedOn: [], delivered: false };
    if (!cur.bookedOn.includes(p.serviceId)) cur.bookedOn.push(p.serviceId);
    cur.delivered = cur.delivered || p.delivered;
    byEvent.set(p.eventId, cur);
  }
  const photos = new Map<string, AlbumPhoto[]>();
  const add = (eventId: string, ph: AlbumPhoto) => photos.set(eventId, [...(photos.get(eventId) ?? []), ph]);
  for (const n of args.notices) {
    if (!byEvent.has(n.eventId) || !passedTheGuestNotice(n, args.now)) continue;
    add(n.eventId, { key: `papic:${n.photoId}`, url: n.url!, from: 'papic', serviceId: null, at: n.publishedAt! });
  }
  for (const f of args.files) {
    const ev = byEvent.get(f.eventId);
    if (!ev || !f.url || !f.serviceId || !ev.bookedOn.includes(f.serviceId)) continue;
    add(f.eventId, { key: `files:${f.fileId}`, url: f.url, from: 'files', serviceId: f.serviceId, at: f.at });
  }
  const out: WorkAlbum[] = [];
  for (const [eventId, ev] of byEvent) {
    const ph = (photos.get(eventId) ?? []).sort((a, b) => b.at.localeCompare(a.at));
    if (ph.length === 0 && !ev.delivered) continue;
    const facts = args.events.get(eventId);
    out.push({ eventId, label: albumLabel(facts), kindMonth: kindMonthLabel(facts), sortDate: facts?.eventDate ?? '', photos: ph, delivered: ev.delivered, bookedOn: ev.bookedOn });
  }
  return out.sort((a, b) => b.sortDate.localeCompare(a.sortDate) || a.eventId.localeCompare(b.eventId));
}

/**
 * A CARD'S PORTFOLIO — the albums of the events this card was booked on: the SAME album objects as Their work, and
 * the SAME photo objects that belong to this card (the event's Papic album + what was filed under THIS card). An album
 * with nothing of this card's and no delivery is left off.
 */
export function cardAlbums(work: readonly WorkAlbum[], serviceId: string): CardAlbum[] {
  const out: CardAlbum[] = [];
  for (const album of work) {
    if (!album.bookedOn.includes(serviceId)) continue;
    const photos = album.photos.filter((p) => p.from === 'papic' || p.serviceId === serviceId);
    if (photos.length === 0 && !album.delivered) continue;
    out.push({ album, photos });
  }
  return out;
}

/** "48 photos · Papic · on the day" (the drawn word) · "12 photos · filed for this event" · "delivered · no photos". */
export function albumLine(photos: readonly AlbumPhoto[], opts: { cards?: number } = {}): string {
  if (photos.length === 0) return 'delivered · no photos';
  const papic = photos.some((p) => p.from === 'papic');
  const files = photos.some((p) => p.from === 'files');
  const from = papic && files ? 'Papic · on the day + filed for this event' : papic ? 'Papic · on the day' : 'filed for this event';
  const cards = (opts.cards ?? 1) > 1 ? `${formatCount(opts.cards!)} cards` : null;
  return [`${formatCount(photos.length)} ${photos.length === 1 ? 'photo' : 'photos'}`, from, cards].filter(Boolean).join(' · ');
}

/** The card's own name, as the services list says it. */
export function cardName(c: CardRef): string {
  return (c.title ?? '').trim() || formatEventTypeLabel(c.category);
}

/**
 * THEIR WORK's "Booked on › card" rows — one per card the event booked. A retired card (`is_active = false`) keeps its
 * name and carries "retired" (frame 78: the drawing reads the current name; a name-at-booking column was NOT drawn). A
 * card that no longer exists has no row (there is nothing left to open).
 */
export function bookedOnRows(album: WorkAlbum, cards: ReadonlyMap<string, CardRef>): BookedOnRow[] {
  return album.bookedOn
    .map((id) => cards.get(id))
    .filter((c): c is CardRef => Boolean(c))
    .map((c) => ({ serviceId: c.id, name: cardName(c), retired: !c.isActive }));
}

/** The Portfolio row's summary (frames 72 · 74). */
export function portfolioSummary(albums: readonly CardAlbum[] | null): string {
  if (albums === null) return 'Couldn’t load · Retry';
  if (albums.length === 0) return 'Your own uploads only · albums come from bookings';
  return `${formatCount(albums.length)} ${albums.length === 1 ? 'album' : 'albums'} from booked events · your own uploads last`;
}

/** The anchor Their work gives each album, so a card's row opens that same album there. */
export const workAlbumAnchor = (eventId: string) => `album-${eventId}`;

/**
 * What a screen draws for one album — NO event id, no card id (the couple's page must never carry a couple's event id
 * in its payload). `href` is set only on the supplier's own screens.
 */
export type AlbumView = {
  key: string;
  label: string;
  line: string;
  urls: string[];
  more: number;
  href: string | null;
  /** 🏷 Frame 6 (DECISION_LOG 2026-11-14): which inspirations this album's photos are in, with a count. Supplier screens only. */
  inspirations?: AlbumInspiration[];
};

export function toAlbumViews(
  albums: readonly CardAlbum[],
  opts: { href?: ((eventId: string) => string) | null; tags?: ReadonlyMap<string, readonly TagPart[]> | null } = {},
): AlbumView[] {
  return albums.map((a, i) => {
    const urls = a.photos.slice(0, ALBUM_STRIP_MAX).map((p) => p.url);
    return {
      key: opts.href ? workAlbumAnchor(a.album.eventId) : `album-${i}`,
      label: a.album.label,
      line: albumLine(a.photos),
      urls,
      more: Math.max(0, a.photos.length - urls.length),
      href: opts.href ? opts.href(a.album.eventId) : null,
      ...(opts.tags ? { inspirations: albumInspirations(a.photos.map((p) => p.key), opts.tags) } : {}),
    };
  });
}

export type EventPhoto = { url: string; caption: string; event: string };

/**
 * Each card's event photos from ONE shop-wide read (`readShopWork`), the same album objects Their work holds. The
 * event key is the album's place in that read ("e3") — enough to count events, and never the couple's event id.
 */
export function eventPhotosOf(
  work: { albums: WorkAlbum[] } | null,
  serviceIds: readonly string[],
): Map<string, EventPhoto[] | null> {
  const out = new Map<string, EventPhoto[] | null>();
  if (!work) {
    for (const id of serviceIds) out.set(id, null);
    return out;
  }
  const keyOf = new Map(work.albums.map((a, i) => [a.eventId, `e${i}`]));
  for (const id of serviceIds) {
    const list: EventPhoto[] = [];
    for (const ca of cardAlbums(work.albums, id)) {
      for (const p of ca.photos) list.push({ url: p.url, caption: ca.album.kindMonth, event: keyOf.get(ca.album.eventId)! });
    }
    out.set(id, list);
  }
  return out;
}

