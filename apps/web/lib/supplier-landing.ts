/**
 * supplier-landing.ts — the rules for the /suppliers landing pages, PURE.
 *
 * ── WHAT THESE PAGES ARE ──────────────────────────────────────────────────
 * The SEO & AI Discoverability Playbook (locked 2026-05-14, spec doc 17 §5.1)
 * planned `/suppliers/[category]/[city]` pages and nobody built them. The owner
 * added the EVENT level on 2026-09-27 — people search "debut package Quezon
 * City", not "package Quezon City" — so a page is one (event × category × city),
 * with a nationwide (event × category) page above it:
 *
 *     /suppliers/debut/coordinator/quezon-city
 *     /suppliers/debut/coordinator
 *
 * Every page is built from suppliers' own SERVICE CARDS (`vendor_services`) —
 * real titles and real peso prices, which is the one thing a rival's templated
 * "wedding cost 2026" article cannot copy.
 *
 * ── THE GATE IS THE WHOLE POINT ───────────────────────────────────────────
 * 🔑 A page is INDEXABLE only when it has at least MIN_CARDS cards from at least
 * MIN_SHOPS different shops. Below that it still renders (a person who lands on
 * it gets an honest page) but it is `noindex` and it is left out of the
 * sitemap. Google penalises near-empty template pages, and a directory of
 * several thousand "0 suppliers in Siquijor" pages is exactly what it
 * penalises — the whole domain pays for it, not just those pages. The pages
 * switch themselves on as suppliers publish; nobody has to remember to.
 *
 * Why 2 shops and not only 3 cards: three cards from ONE shop is that shop's
 * page, not a comparison, and it already has one at /{slug}.
 *
 * ── PRICES ────────────────────────────────────────────────────────────────
 * ⚠ The three pricing bases are NOT one number line. A per-guest ₱650 and a
 * fixed ₱180,000 package in one "₱650–₱180,000" range would be true of the rows
 * and false as advice. So a page summarises each basis on its own.
 * A shop that hides its prices publicly contributes no figure (its cards still
 * list) — the same rule the card itself follows.
 */
import { CITIES, normPlace } from '@/app/onboarding/wedding/_data/wedding-cities';

/** Tunable, and deliberately here rather than scattered through the pages. */
export const SUPPLIER_PAGE_MIN_CARDS = 3;
export const SUPPLIER_PAGE_MIN_SHOPS = 2;

export type PricingBasis = 'fixed' | 'per_pax' | 'per_hour';

/** One service card, reduced to what the landing rules read. */
export type LandingCard = {
  serviceId: string;
  shopId: string;
  /** The taxonomy tile this card files under, or null when it maps to none. */
  tile: string | null;
  /** Event-type keys this card serves (its coverage, else its shop's). */
  eventTypes: readonly string[];
  /** Canonical city key (`quezon-city`), or null when the shop's city is unknown. */
  cityKey: string | null;
  pricingBasis: PricingBasis;
  /**
   * The figure for its basis — package price (fixed), price per guest (per_pax)
   * or base price (per_hour). NULL when the shop hides prices publicly or the
   * card carries no positive figure.
   */
  pricePhp: number | null;
};

export type PageKey = { event: string; tile: string; city: string | null };

// ── slugs ────────────────────────────────────────────────────────────────

/** `gender_reveal` → `gender-reveal`. Event keys are the vocabulary's own. */
export function eventSlug(eventKey: string): string {
  return eventKey.replace(/_/g, '-');
}

/** Reverse of eventSlug against the live vocabulary; null for anything else. */
export function eventKeyFromSlug(slug: string, eventKeys: readonly string[]): string | null {
  return eventKeys.find((k) => eventSlug(k) === slug) ?? null;
}

/** Reverse of the taxonomy's tileSlug map; null for anything else. */
export function tileFromSlug(slug: string, tileSlug: Readonly<Record<string, string>>): string | null {
  for (const [tile, s] of Object.entries(tileSlug)) if (s === slug) return tile;
  return null;
}

// ── cities ───────────────────────────────────────────────────────────────

/** "Taguig · BGC" → "Taguig". The onboarding list carries a qualifier after "·". */
function plainCityName(n: string): string {
  return n.split(' · ')[0]!.trim();
}

const CITY_BY_NORM: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const c of CITIES) {
    m.set(normPlace(plainCityName(c.n)), c.k);
    m.set(normPlace(c.k), c.k);
  }
  return m;
})();

/**
 * A shop's free-text `location_city` → a canonical city key, or null.
 * Only the first comma segment is read: "Quezon City, Metro Manila" is
 * Quezon City. Unknown places return null rather than a guess — a card with no
 * city still counts toward the NATIONWIDE page, never toward a wrong city.
 */
export function cityKeyFor(locationCity: string | null | undefined): string | null {
  if (!locationCity) return null;
  const first = locationCity.split(',')[0] ?? '';
  const key = CITY_BY_NORM.get(normPlace(first));
  return key ?? null;
}

export function isCityKey(key: string): boolean {
  return CITIES.some((c) => c.k === key);
}

export function cityName(key: string): string {
  const c = CITIES.find((x) => x.k === key);
  return c ? plainCityName(c.n) : key;
}

// ── filtering + the gate ─────────────────────────────────────────────────

export function cardsForPage(cards: readonly LandingCard[], page: PageKey): LandingCard[] {
  return cards.filter(
    (c) =>
      c.tile === page.tile &&
      c.eventTypes.includes(page.event) &&
      (page.city === null || c.cityKey === page.city),
  );
}

export function shopCount(cards: readonly LandingCard[]): number {
  return new Set(cards.map((c) => c.shopId)).size;
}

/** The gate. See the header — this is what keeps thin pages out of Google. */
export function isIndexable(cards: readonly LandingCard[]): boolean {
  return cards.length >= SUPPLIER_PAGE_MIN_CARDS && shopCount(cards) >= SUPPLIER_PAGE_MIN_SHOPS;
}

// ── prices ───────────────────────────────────────────────────────────────

export type BasisSummary = { basis: PricingBasis; low: number; high: number; median: number; count: number };

/** One summary per basis that has at least one priced card, fixed first. */
export function priceSummaries(cards: readonly LandingCard[]): BasisSummary[] {
  const out: BasisSummary[] = [];
  for (const basis of ['fixed', 'per_pax', 'per_hour'] as const) {
    const prices = cards
      .filter((c) => c.pricingBasis === basis && c.pricePhp !== null && c.pricePhp > 0)
      .map((c) => c.pricePhp as number)
      .sort((a, b) => a - b);
    if (prices.length === 0) continue;
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 1 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2);
    out.push({ basis, low: prices[0]!, high: prices[prices.length - 1]!, median, count: prices.length });
  }
  return out;
}

// ── which pages exist ────────────────────────────────────────────────────

export type QualifyingPage = PageKey & { cards: number; shops: number };

/**
 * Every (event × tile × city) and nationwide (event × tile) page that passes
 * the gate — what the sitemap lists and what the index links to.
 *
 * `tileServesEvent` is the taxonomy's own answer (`tileEventTypes`), so a
 * funeral-home card that a shop mis-tagged "wedding" still never mints a
 * "wedding funeral homes" page.
 */
export function qualifyingPages(
  cards: readonly LandingCard[],
  tileServesEvent: (tile: string, event: string) => boolean,
): QualifyingPage[] {
  const groups = new Map<string, { key: PageKey; cards: LandingCard[] }>();
  const add = (key: PageKey, c: LandingCard) => {
    const id = `${key.event}|${key.tile}|${key.city ?? ''}`;
    const g = groups.get(id) ?? { key, cards: [] };
    g.cards.push(c);
    groups.set(id, g);
  };
  for (const c of cards) {
    if (!c.tile) continue;
    for (const event of new Set(c.eventTypes)) {
      if (!tileServesEvent(c.tile, event)) continue;
      add({ event, tile: c.tile, city: null }, c);
      if (c.cityKey) add({ event, tile: c.tile, city: c.cityKey }, c);
    }
  }
  const out: QualifyingPage[] = [];
  for (const { key, cards: cs } of groups.values()) {
    if (isIndexable(cs)) out.push({ ...key, cards: cs.length, shops: shopCount(cs) });
  }
  return out.sort(
    (a, b) =>
      b.cards - a.cards ||
      a.event.localeCompare(b.event) ||
      a.tile.localeCompare(b.tile) ||
      (a.city ?? '').localeCompare(b.city ?? ''),
  );
}

export function pagePath(p: PageKey, tileSlug: Readonly<Record<string, string>>): string {
  const base = `/suppliers/${eventSlug(p.event)}/${tileSlug[p.tile] ?? p.tile}`;
  return p.city ? `${base}/${p.city}` : base;
}
