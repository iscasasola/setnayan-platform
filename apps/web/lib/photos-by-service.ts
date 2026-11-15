/**
 * 📸 PHOTOS BY SERVICE — the fourth place a supplier's photos live (owner 2026-11-14, DECISION_LOG d8ec0922, verbatim:
 * *"so they can see all their photos for a specific service."*; approved prototype
 * `prototypes/supplier_photos_by_category_2026-11-14_fable.html`, Fable's three picks taken).
 *
 * On the shop page, tap a service — Lights & Sound, Mobile Bar — and see every photo of every service card in it,
 * one heading per card. NOTHING IS COPIED: it gathers, by service, the same photos the other three places already
 * show — the event (Their work), the card, and the look. Pure: the shop page, the sheet and the guard
 * (`photos-by-service.test.ts`) share it.
 *
 *   A card's photos, in this order (newest event first, as drawn):
 *     · its event photos (the same ones as Their work, by reference) — captioned kind · month ("Wedding · Dec 2025")
 *     · the couples' approved photos of it — "From the couple"
 *     · its own cover + showcase — "Card photo" (they are uploaded to the card, not to an event; Fable's pick 3)
 *
 * 🔑 A caption is the kind of event and the month — never a couple's or a guest's name, never a venue, never an id.
 * 🔑 A service with no photo has no Portfolio tile; the service name on its cards still opens the view (empty line).
 */
import { formatCount } from './format-number';
import type { ServiceCard } from './service-card-view-model';

/** Tiles drawn per card before "+N more" (the prototype's two rows of three). */
export const SERVICE_PHOTOS_PER_CARD = 6;

export type ServicePhoto = {
  key: string;
  url: string;
  /** "Wedding · Dec 2025" · "Card photo" · '' (a couple's photo — its tag says it). */
  caption: string;
  /** "From the couple" / "Only you" (the shop's own view) — or none. */
  tag: 'couple' | 'only-you' | null;
  /** Only on an "Only you" photo: the album row "Put on my page" files. */
  photoId?: string;
  /** Only on an "Only you" photo: where its page notice stands, when one was filed. */
  notice?: { state: 'waiting' | 'on_page' | 'removed_by_guest' | 'taken_down'; publicFrom: string } | null;
};

export type ServiceCardPhotos = {
  cardId: string;
  title: string;
  /** The card's anchor on the page ("Open card ›"). */
  anchorId: string | null;
  photos: ServicePhoto[];
  /** Distinct events among its photos. */
  events: number;
};

export type ServiceView = {
  key: string;
  label: string;
  cards: ServiceCardPhotos[];
  photos: number;
  events: number;
  /** null = a card's event photos could not be read — the view says so instead of drawing fewer photos as all. */
  unread: boolean;
};

/** One card's photos, in the drawn order. `own` is "Card photo"; a URL already shown is not drawn twice. */
export function cardServicePhotos(card: ServiceCard): ServiceCardPhotos {
  const seen = new Set<string>();
  const photos: ServicePhoto[] = [];
  const add = (p: ServicePhoto) => {
    if (!p.url || seen.has(p.url)) return;
    seen.add(p.url);
    photos.push(p);
  };
  const events = new Set<string>();
  for (const [i, e] of (card.eventPhotos ?? []).entries()) {
    events.add(e.event);
    add({ key: `${card.id}:ev:${i}`, url: e.url, caption: e.caption, tag: null });
  }
  // A couple's photo of the work: tagged "From the couple", and no caption — its only date sits beside the couple's
  // names (their credit line), which never reach this view.
  for (const look of card.coupleLooks ?? []) add({ key: `${card.id}:cp:${look.id}`, url: look.url, caption: '', tag: 'couple' });
  for (const [i, url] of card.photos.entries()) add({ key: `${card.id}:own:${i}`, url, caption: 'Card photo', tag: null });
  return { cardId: card.id, title: card.label, anchorId: card.anchorId ?? null, photos, events: events.size };
}

/**
 * Every service the shop's live cards are filed under, in the order its cards appear, each with its cards and their
 * photos. A service with no photo is still returned (its card names still open the view); `photoTiles` filters.
 */
export function servicesFromCards(cards: readonly ServiceCard[]): ServiceView[] {
  const by = new Map<string, ServiceView>();
  const eventsBy = new Map<string, Set<string>>();
  for (const c of cards) {
    const key = c.serviceKey ?? '';
    if (!key) continue;
    const view = by.get(key) ?? { key, label: c.serviceLabel ?? key, cards: [], photos: 0, events: 0, unread: false };
    const cp = cardServicePhotos(c);
    view.cards.push(cp);
    view.photos += cp.photos.length;
    if (c.eventPhotos === null) view.unread = true;
    const ev = eventsBy.get(key) ?? new Set<string>();
    for (const e of c.eventPhotos ?? []) ev.add(e.event);
    eventsBy.set(key, ev);
    view.events = ev.size;
    by.set(key, view);
  }
  return [...by.values()];
}

/** The Portfolio row's tiles (B): only services with a photo — a tile with none would be a claim of nothing. */
export function photoTiles(views: readonly ServiceView[]): { key: string; label: string; line: string; cover: string }[] {
  return views
    .filter((v) => v.photos > 0)
    .map((v) => ({
      key: v.key,
      label: v.label,
      line: `${plural(v.photos, 'photo')} · ${plural(v.cards.length, 'card')}`,
      cover: v.cards.flatMap((c) => c.photos)[0]!.url,
    }));
}

/** "11 photos · 5 events · 2 service cards" — the view's own line (events only when there are some). */
export function serviceLine(v: ServiceView): string {
  if (v.photos === 0) return plural(v.cards.length, 'service card');
  return [plural(v.photos, 'photo'), v.events > 0 ? plural(v.events, 'event') : null, plural(v.cards.length, 'service card')]
    .filter(Boolean)
    .join(' · ');
}

/** "7 photos · 3 events" — a card heading's line. */
export function cardLine(c: ServiceCardPhotos): string {
  return [plural(c.photos.length, 'photo'), c.events > 0 ? plural(c.events, 'event') : null].filter(Boolean).join(' · ');
}

function plural(n: number, word: string): string {
  return `${formatCount(n)} ${n === 1 ? word : `${word}s`}`;
}
