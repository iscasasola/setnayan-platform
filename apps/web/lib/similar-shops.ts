/**
 * similar-shops.ts — WHICH SHOPS ARE "SIMILAR" at the end of a shop's page. Pure: no Supabase, no Next, so the rule
 * is executed by its own test (`lib/similar-shops.test.ts`).
 *
 * Owner, 2026-11-14 (DECISION_LOG "A SHOP PAGE ENDS WITH ITS PARTNERS, THEN SIMILAR SHOPS NEARBY — APPROVED AS
 * DRAWN", prototype `shop_page_end_2026-11-14_fable.html` § "How the row picks shops"):
 *
 *   · same kind of work, same area — e.g. lights & sound in or near Quezon City;
 *   · verified shops first, then the nearest; only shops already public;
 *   · never this shop, never a shop already listed under Trusted by;
 *   · four at most; "See all ›" opens the marketplace filtered to this kind of work;
 *   · too few nearby → widen to that kind of work anywhere, and the heading drops "near <area>";
 *   · none at all → the row is not drawn, with no empty message;
 *   · on a demo shop, demo shops only (each marked Sample) — and on a real shop, real shops only.
 *
 * ── WHAT EACH WORD MEANS HERE ────────────────────────────────────────────────
 * KIND OF WORK = the shop's first service (`services[0]`, the same key its hero kicker names), matched the way the
 * marketplace's `?category=` filter matches: the candidate's `services` CONTAINS it. So "See all ›" lists exactly the
 * pool this row was drawn from.
 *
 * SAME AREA = the same `location_city` (trimmed, case-folded). No radius is invented here: a distance in km would be
 * a guessed number deciding who a couple is shown (CLAUDE.md rule 9). Distance only ORDERS — "then the nearest" —
 * from the two shops' HQ pins; a shop with no pin sorts after every shop with one.
 *
 * TOO FEW NEARBY = fewer nearby shops than the row holds. The row then fills from the wider pool (nearby ones still
 * first), and the heading names the area only when EVERY shop shown is in it — so "near Quezon City" is never said
 * over a card from Cebu.
 */
import { categoryPickHref } from '@/lib/discover-suppliers';

/** Four at most — one row at 1280, two rows of two at 390 (owner call 2 on the drawing). */
export const SIMILAR_SHOPS_MAX = 4;

/** The facts the rule reads from one candidate row. */
export type SimilarCandidate = {
  vendorProfileId: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The Verified badge as the card shows it (`hasVerifiedBadge`) — the same fact orders and draws. */
  verified: boolean;
  name: string;
};

export type SimilarSelf = {
  vendorProfileId: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type SimilarPick<C extends SimilarCandidate> = {
  shops: C[];
  /** True only when every shop shown is in this shop's city — the heading may then say "near <city>". */
  near: boolean;
};

function areaKey(city: string | null): string | null {
  const k = (city ?? '').trim().toLocaleLowerCase('en-PH');
  return k.length > 0 ? k : null;
}

function hasPin(lat: number | null, lng: number | null): lat is number {
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng);
}

/** Great-circle km between two pins; null when either is missing. */
export function kmBetween(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): number | null {
  if (!hasPin(a.latitude, a.longitude) || !hasPin(b.latitude, b.longitude)) return null;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = ((b.longitude as number) - (a.longitude as number)) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Picks the row. `candidates` are already the same kind of work, public, and the same demo-ness as this shop (the
 * read's filters); this applies everything else.
 */
export function pickSimilarShops<C extends SimilarCandidate>(
  candidates: readonly C[],
  self: SimilarSelf,
  excludeIds: Iterable<string>,
  max: number = SIMILAR_SHOPS_MAX,
): SimilarPick<C> {
  const skip = new Set<string>(excludeIds);
  skip.add(self.vendorProfileId);
  const home = areaKey(self.city);

  const seen = new Set<string>();
  const pool = candidates.filter((c) => {
    if (!c.vendorProfileId || skip.has(c.vendorProfileId) || seen.has(c.vendorProfileId)) return false;
    seen.add(c.vendorProfileId);
    return true;
  });

  const facts = new Map(pool.map((c) => [c.vendorProfileId, { km: kmBetween(self, c), near: home !== null && areaKey(c.city) === home }]));
  const rank = (a: C, b: C): number => {
    const fa = facts.get(a.vendorProfileId)!;
    const fb = facts.get(b.vendorProfileId)!;
    if (fa.near !== fb.near) return fa.near ? -1 : 1; // same area first
    if (a.verified !== b.verified) return a.verified ? -1 : 1; // then verified first
    if (fa.km !== fb.km) {
      if (fa.km === null) return 1; // no pin sorts after every pin
      if (fb.km === null) return -1;
      return fa.km - fb.km; // then the nearest
    }
    return a.name.localeCompare(b.name);
  };

  const shops = [...pool].sort(rank).slice(0, Math.max(0, max));
  const near = shops.length > 0 && shops.every((c) => facts.get(c.vendorProfileId)!.near);
  return { shops, near };
}

/**
 * The kind of work inside a sentence: "More lights & sound near Quezon City". Lower-cased word by word, except a word
 * written all in capitals (DJ, HMUA) — an acronym stays one.
 */
export function kindInSentence(label: string): string {
  return label
    .split(' ')
    .map((w) => (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w) ? w : w.toLocaleLowerCase('en-PH')))
    .join(' ');
}

/** The row's heading — the area only when every shop shown is in it. */
export function similarShopsHeading(kindLabel: string, city: string | null, near: boolean): string {
  const kind = kindInSentence(kindLabel);
  const area = (city ?? '').trim();
  return near && area ? `More ${kind} near ${area}` : `More ${kind}`;
}

/**
 * "See all ›" — Discover's supplier view already filtered to this kind of work: the category pick's own address
 * (`categoryPickHref`, lib/discover-suppliers.ts), never a second hand-typed one.
 */
export function similarShopsSeeAllHref(service: string): string {
  return categoryPickHref('', service);
}
