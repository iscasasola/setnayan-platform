/**
 * find-service-cards.ts — ONE LIST PER CATEGORY, EVERY SERVICE'S CARDS IN IT (owner 2026-10-29, Find v4 approved,
 * then v4.3 → v4.5 on the same day). Pure: no React, no database, so every rule below is executed by
 * `find-service-cards.test.ts`.
 *
 *   Category › Service › Service card. Every card has ONE home service (`vendor_services.category`); the category's
 *   list is all of them together — *"all service cards of all services inside a category will share the same spot"*.
 *
 * What it decides:
 *   · WHICH CARDS EXIST TO SHOW. A card not free on the event's date(s) is never shown — *"we never show service cards
 *     not available for their date"*: one date → free that day; a month, a range or date choices → free on at least
 *     one of them (`keepFreeCards`). The refusals are the booking path's own (`service_cards_unbookable_on`); when they
 *     could not be read the list SAYS so (`availability: 'unread'`) — never silently all, never silently none.
 *   · WHICH SERVICES THE ✎ SHEET LISTS — only those with a card (*"we only show services with counts. hide them if
 *     there is none"*). An unreadable count is not a zero and is never hidden for being one (`servicesWithCards`).
 *   · A SHOP STAYS TOGETHER — its cards adjacent, placed where the shop falls in the list's order, and a page of
 *     "Show 20 more" never splits it (`clusterCards`, `pageOfClusters`).
 *   · A TYPED SERVICE NAME LANDS ON THAT SERVICE (≥ 3 letters, `matchServiceQuery`); anything else is a search.
 *   · THE ⇅ SHEET'S Price and Rating, and the count line's words (`findCountWords`).
 */
import type { BenchServiceCard } from './bench-service-card';
import { refusalKey } from './bench-bookable-days';

/** One supplier's card in a category's list. */
export type FindCardRow = {
  /** `vendor_services.vendor_service_id` — null only for a legacy shop with no card row (see `legacyServiceFor`). */
  serviceId: string | null;
  profileId: string;
  /** The card's ONE home service — `vendor_services.category`. */
  service: string;
  /** What the card prints. Null for a legacy shop (nothing published to print). */
  card: BenchServiceCard | null;
  /** The card's starting price in PHP, for the ⇅ Price choice — null when unpriced OR the shop hides its prices. */
  fromPhp: number | null;
};

/** A service as the couple reads it: the key never prints, the label is admin-managed. */
export type FindService = { key: string; label: string };

/**
 * Whether the dates were checked:
 *   `checked` — every card in the list is free on at least one of the event's dates;
 *   `no_date` — the event has no date to check against yet (the list says so);
 *   `unread`  — the calendars could not be read (the list says so, and shows every card).
 */
export type FindAvailability = 'checked' | 'no_date' | 'unread';

/** The key the refusal set is stored under — `bench-bookable-days.ts`'s own, so the two can never disagree. */
export const refusedOn = refusalKey;

/**
 * Keep only the cards free on at least one of `days`. A card with no `serviceId` (a legacy shop) cannot be refused by
 * the booking path, so it stays — the same stance as H6's `suppliersWithNoBookingLeft`.
 *
 * `refused === null` = the refusals could not be read: every card stays and the answer says `unread`.
 * `days === null` or empty = no date to judge: every card stays and the answer says `no_date`.
 */
export function keepFreeCards(
  cards: readonly FindCardRow[],
  refused: ReadonlySet<string> | null,
  days: readonly string[] | null,
): { cards: FindCardRow[]; availability: FindAvailability } {
  if (!days || days.length === 0) return { cards: [...cards], availability: 'no_date' };
  if (refused === null) return { cards: [...cards], availability: 'unread' };
  return {
    cards: cards.filter((c) => !c.serviceId || days.some((d) => !refused.has(refusedOn(c.serviceId as string, d)))),
    availability: 'checked',
  };
}

/** How many cards each service holds. */
export function cardsPerService(cards: readonly FindCardRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cards) out.set(c.service, (out.get(c.service) ?? 0) + 1);
  return out;
}

/**
 * The services the ✎ sheet lists: only those with at least one card, in the category's own order. `cards === null`
 * means the cards could not be read — then NOTHING is listed (there is no count to show), and the caller says why;
 * it is never "every service is empty".
 */
export function servicesWithCards(
  services: readonly FindService[],
  cards: readonly FindCardRow[] | null,
): { service: FindService; count: number }[] {
  if (!cards) return [];
  const n = cardsPerService(cards);
  return services.filter((s) => (n.get(s.key) ?? 0) > 0).map((s) => ({ service: s, count: n.get(s.key) ?? 0 }));
}

/**
 * The service a legacy shop is filed under — one listed in `vendor_profiles.services` but with no card row in this
 * category (owner 2026-10-29: legacy shops are filed under their known service, never a "Service not set" choice).
 * The first of its stored services that is one of the category's; else the category's first service.
 */
export function legacyServiceFor(stored: readonly string[] | null | undefined, categoryServices: readonly string[]): string | null {
  const own = (stored ?? []).find((s) => categoryServices.includes(s));
  return own ?? categoryServices[0] ?? null;
}

/** A shop and its cards, adjacent. */
export type FindCluster<R> = { row: R; cards: FindCardRow[] };

/**
 * Fold the cards under their shops, in the SHOPS' order (the list's order — the ladder, then the couple's sort over
 * its tail), each shop's cards in the category's service order and then cheapest first. A shop whose every card is
 * hidden or filtered out leaves the list; a shop with no card at all is never drawn (it has nothing to show).
 */
export function clusterCards<R extends { vendorProfileId: string }>(
  rows: readonly R[],
  cards: readonly FindCardRow[],
  serviceOrder: readonly string[],
  keep: (card: FindCardRow, row: R) => boolean = () => true,
): FindCluster<R>[] {
  const byShop = new Map<string, FindCardRow[]>();
  for (const c of cards) {
    const list = byShop.get(c.profileId) ?? [];
    list.push(c);
    byShop.set(c.profileId, list);
  }
  const rank = (s: string) => {
    const i = serviceOrder.indexOf(s);
    return i < 0 ? serviceOrder.length : i;
  };
  const out: FindCluster<R>[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.vendorProfileId)) continue;
    seen.add(row.vendorProfileId);
    const mine = (byShop.get(row.vendorProfileId) ?? [])
      .filter((c) => keep(c, row))
      .sort(
        (a, b) =>
          rank(a.service) - rank(b.service) ||
          (a.fromPhp ?? Number.POSITIVE_INFINITY) - (b.fromPhp ?? Number.POSITIVE_INFINITY),
      );
    if (mine.length > 0) out.push({ row, cards: mine });
  }
  return out;
}

/** The size of one page of the list — "Show 20 more". */
export const FIND_PAGE_CARDS = 20;

/**
 * The clusters on screen for a page budget of `limit` cards. A shop is never split: the page runs to the end of the
 * shop the `limit`-th card falls in (so a page can hold a few more than `limit`, never fewer while any are left).
 */
export function pageOfClusters<C extends { cards: readonly FindCardRow[] }>(
  clusters: readonly C[],
  limit: number,
): { shown: C[]; shownCards: number; totalCards: number } {
  const totalCards = clusters.reduce((n, c) => n + c.cards.length, 0);
  const shown: C[] = [];
  let shownCards = 0;
  for (const c of clusters) {
    if (shownCards >= limit) break;
    shown.push(c);
    shownCards += c.cards.length;
  }
  return { shown, shownCards, totalCards };
}

/**
 * A typed service name → that service (owner 2026-10-29: *"a typed service name lands in its category with that
 * service picked"*). Three letters at least; a label that STARTS with the words wins over one that contains them, and
 * the key is matched with its underscores read as spaces. Anything else → null (it is a search, not a service).
 */
export function matchServiceQuery(raw: string, services: readonly FindService[]): FindService | null {
  const q = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (q.length < 3) return null;
  const starts = services.find((s) => s.label.toLowerCase().startsWith(q));
  if (starts) return starts;
  return (
    services.find((s) => s.label.toLowerCase().includes(q) || s.key.replace(/_/g, ' ').toLowerCase().includes(q)) ?? null
  );
}

/* ── ⇅ — Price and Rating (owner 2026-10-29 v4.2: "Sort · Price · Style · Rating behind ⇅") ─────────────────────── */

export type FindPrice = 'any' | 'low' | 'mid' | 'high';
export type FindRating = 'any' | '4.5' | '4.0' | 'new';
export type FindFilters = { price: FindPrice; rating: FindRating };
export const FIND_FILTERS_OFF: FindFilters = { price: 'any', rating: 'any' };

/** How many of Price and Rating are narrowing the list. */
export function filtersOn(f: FindFilters): number {
  return (f.price !== 'any' ? 1 : 0) + (f.rating !== 'any' ? 1 : 0);
}

/**
 * The category's three price bands, cut at its own priced cards' thirds — so "Under ₱X" means something for a
 * per-head caterer and a per-event photo booth alike. Null when fewer than three cards carry a price (no honest
 * bands to cut), and the ⇅ sheet then offers no Price choice.
 */
export function priceBands(cards: readonly FindCardRow[]): { low: number; high: number } | null {
  const p = cards.map((c) => c.fromPhp).filter((n): n is number => typeof n === 'number' && n > 0).sort((a, b) => a - b);
  if (p.length < 3) return null;
  const low = p[Math.floor(p.length / 3)] as number;
  const high = p[Math.floor((2 * p.length) / 3)] as number;
  if (!(low < high)) return null;
  return { low, high };
}

/** Does a card pass the ⇅ choices? An unpriced card never passes a price band (it cannot be said to be in it). */
export function passesFindFilters(
  card: FindCardRow,
  shop: { rating: number | null; reviewCount: number | null },
  f: FindFilters,
  bands: { low: number; high: number } | null,
): boolean {
  if (f.price !== 'any' && bands) {
    const p = card.fromPhp;
    if (p == null) return false;
    if (f.price === 'low' && !(p < bands.low)) return false;
    if (f.price === 'mid' && !(p >= bands.low && p < bands.high)) return false;
    if (f.price === 'high' && !(p >= bands.high)) return false;
  }
  if (f.rating === '4.5' && !((shop.rating ?? 0) >= 4.5)) return false;
  if (f.rating === '4.0' && !((shop.rating ?? 0) >= 4.0)) return false;
  if (f.rating === 'new' && !(shop.rating == null && (shop.reviewCount ?? 0) === 0)) return false;
  return true;
}

/* ── The count line ─────────────────────────────────────────────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Dec 18" from a day key, read by its parts (a DATE must not drift across time zones). */
export function dayWords(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : day;
}

/** What the dates part of the count line says. */
export function freeOnWords(availability: FindAvailability, days: readonly string[]): string {
  if (availability === 'no_date') return 'no date set yet';
  if (availability === 'unread') return "couldn't check dates";
  if (days.length === 1) return `free on ${dayWords(days[0] as string)}`;
  return 'free on one of your dates';
}

/** "1 card" · "19 cards" — the word where the line counts CARDS (owner 2026-10-29, the approved "cards" count word). */
export function cardsWord(n: number): string {
  return `${n} card${n === 1 ? '' : 's'}`;
}

/** "All 4 services" · "2 of 4 services" · "Lechonero" — what the ✎ has left showing. */
export function servicesScopeWords(listed: readonly FindService[], hidden: readonly string[]): string {
  const showing = listed.filter((s) => !hidden.includes(s.key));
  if (listed.length === 0) return '';
  if (showing.length === listed.length) return listed.length === 1 ? (listed[0] as FindService).label : `All ${listed.length} services`;
  if (showing.length === 1) return (showing[0] as FindService).label;
  return `${showing.length} of ${listed.length} services`;
}

/** The ✎'s own words while any service is hidden ("2 of 4"), else null (the bare pencil). */
export function pencilWords(listed: readonly FindService[], hidden: readonly string[]): string | null {
  const showing = listed.filter((s) => !hidden.includes(s.key)).length;
  return showing < listed.length ? `${showing} of ${listed.length}` : null;
}

/* ── Best for your event (owner 2026-10-29: "#1 -#10 match must be performers only. we will not show if there are no
   performers yet") ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** How many "Best for your event" cards at most. */
export const FIND_BEST_MAX = 10;

/**
 * The category's best matches: cards of PERFORMERS only (a shop with a proven track record — the caller's set), that
 * the list itself would show (`keep`), ranked by the shipped match score (`compatScore`), then rating, then nearest.
 * One card per shop at most, so ten places are ten suppliers. Empty → the strip is not drawn at all.
 */
export function bestForYourEvent<R extends { vendorProfileId: string; compatScore: number | null; rating: number | null; distanceKm: number | null }>(
  rows: readonly R[],
  cards: readonly FindCardRow[],
  performers: ReadonlySet<string>,
  keep: (card: FindCardRow, row: R) => boolean,
): { row: R; card: FindCardRow }[] {
  const byId = new Map(rows.map((r) => [r.vendorProfileId, r]));
  const picks: { row: R; card: FindCardRow }[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const row = byId.get(c.profileId);
    if (!row || seen.has(c.profileId) || !performers.has(c.profileId) || !keep(c, row)) continue;
    seen.add(c.profileId);
    picks.push({ row, card: c });
  }
  return picks
    .sort(
      (a, b) =>
        (b.row.compatScore ?? -1) - (a.row.compatScore ?? -1) ||
        (b.row.rating ?? 0) - (a.row.rating ?? 0) ||
        (a.row.distanceKm ?? Number.POSITIVE_INFINITY) - (b.row.distanceKm ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, FIND_BEST_MAX);
}
