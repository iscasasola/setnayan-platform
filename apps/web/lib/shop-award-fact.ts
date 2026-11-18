/**
 * shop-award-fact.ts — the ONE plain fact an award shows in the shop page's Awards row.
 *
 * Owner, 15 Nov 2026 (DECISION_LOG "SHOP WEBSITE AWARDS ROW: THE BADGE + ONE PLAIN FACT. NO TIER NAME, NO DATE IN THE
 * ROW"), asked "Just have the badges and no description? or better with description?" and chose *"Yes, badge + fact"*:
 * each award reads as one plain line — '100 bookings completed', 'Setnayan Verified' — and the tier name (Bronze,
 * Silver, Gold …) and the award date belong to the full-screen view only.
 *
 * The badge itself is decided elsewhere (`lib/shop-badges.ts`, owned by the badge work); this module only words it for
 * the row. A milestone's number is the STEP REACHED (the badge's own key), never a live running count.
 * 🔒 lib/shop-award-fact.test.ts
 */
import type { ShopBadge } from './shop-badges';
import { FAMILY_LADDER, type PublicBadgeView, type SealGiven, type SealKey as PublicSealKey, type ShopBadgeFamily } from './public-badges';
import { SHOP_BADGE_STEPS, TIER_KEYS, tierName } from './badge-tiers';
import { LADDER_MATERIALS, faceNumber, type BadgeImage } from './shop-badge-row';
import { formatCount } from './format-number';

const COUNT = new Intl.NumberFormat('en-PH');

/** The row's line for one badge: the fact, with no tier name and no date. */
export function awardFact(badge: ShopBadge): string {
  if (badge.kind === 'verified') return 'Setnayan Verified';
  if (badge.kind === 'milestone') {
    const step = Number(badge.key.split(':')[1]);
    if (Number.isFinite(step) && step > 0) return `${COUNT.format(step)} booking${step === 1 ? '' : 's'} completed`;
  }
  // Anything else already says its fact in plain words; a " · Tier" tail is the tier name, which the row never shows.
  return badge.label.replace(/\s+·\s+[^·]+$/, '').trim();
}

/** The circle a row item draws — `ImageBadge`'s own props (the shipped badge pictures, app/_components/image-badge). */
export type RowImage = BadgeImage;

/** What a tap on a row item opens — the award kit's full screen (#7752), with what it needs and nothing guessed. */
export type RowOpen =
  | { kind: 'tier'; tierIndex: number; tierName: string; title: string; family: 'calendar' | 'bubble' | 'giftbox' | 'shield' | 'invite' }
  | { kind: 'seal'; seal: 'no1' | 'medal' | 'heart' | 'crest' | 'partner'; title: string; year: number | null; awardedOn: string | null };

/** One item of the Awards row: its picture, its ONE plain fact (no tier name, no date) and what a tap opens. */
export type AwardRowItem = { key: string; fact: string; image: RowImage; open: RowOpen };

/** Per tiered family: the fact's words for the step reached, the circle's word, the kit's tap show. */
const FAMILY_ROW: Readonly<Record<ShopBadgeFamily, { fact: (step: number) => string; mini: string; family: 'calendar' | 'bubble' | 'giftbox' | 'shield' | 'invite' }>> = {
  bookings: { fact: (step) => `${formatCount(step)} booking${step === 1 ? '' : 's'} completed`, mini: 'EVENTS', family: 'calendar' },
  five_star: { fact: (step) => `${formatCount(step)} five-star review${step === 1 ? '' : 's'}`, mini: 'REVIEWS', family: 'bubble' },
  // The counter is GIFT POINTS (1 per ₱10 of each gift's price, bc148e4e) — said as points, never as a count of gifts.
  gifts: { fact: (step) => `${formatCount(step)} gift points given`, mini: 'GIFTS', family: 'giftbox' },
  // `shop_trusted_by_count` counts CLIENTS who booked the shop again (50566f42) — said as clients, never as shops.
  trusted_by: { fact: (step) => `Trusted by ${formatCount(step)} client${step === 1 ? '' : 's'}`, mini: 'TRUSTED', family: 'shield' },
  invites: { fact: (step) => `${formatCount(step)} supplier${step === 1 ? '' : 's'} invited`, mini: 'INVITES', family: 'invite' },
};

/** The award kit's seal art kind for each adapter seal (`SEAL_KINDS`, app/_components/award/award-copy.ts). */
const SEAL_KIND: Readonly<Record<Exclude<PublicSealKey, 'verified'>, 'no1' | 'medal' | 'heart' | 'crest' | 'partner'>> = {
  no1: 'no1',
  top10: 'medal',
  clients_choice: 'heart',
  in_demand: 'crest',
  partner: 'partner',
};

const AWARD_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });

/** "18 Nov 2025" — the date a seal was given, for its full screen only (never the row). null when unreadable. */
export function awardDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : AWARD_DAY.format(d);
}

/**
 * 🏅 THE AWARDS ROW, FROM THE ONE ADAPTER (`publicBadgeView`, lib/public-badges.ts — #7807 / #7810): what the row draws
 * after Setnayan Verified (which keeps its own item, the one the top bar's check also opens). In the v16 drawing's
 * order — the seals the shop holds (the seals engine, #7825), then the tiered shop badges (J0's counters, #7753), each
 * at the STEP REACHED on its own ladder. The fact never carries a tier name or a date; a seal's YEAR is part of its fact
 * where the drawing shows one ("Top 10 supplier of 2026"), read from the stored row (`sealsGivenFromEngine`).
 * Each item opens its full screen (the award kit) on a tap — v16 `data-b`.
 *
 * Named gap (never a guessed picture): each seal's own art and each family's own glyph come with the badge graphs; until
 * then a seal wears the shipped award rosette and a tier the shipped ladder hex in its material.
 */
export function awardsRowItems(view: PublicBadgeView, given: Partial<Record<PublicSealKey, SealGiven>> = {}): AwardRowItem[] {
  const out: AwardRowItem[] = [];
  for (const seal of view.seals) {
    if (seal.key === 'verified') continue;
    const g = given[seal.key] ?? null;
    const fact = seal.key === 'top10' && g ? `Top 10 supplier of ${g.year}` : seal.name;
    out.push({
      key: `seal:${seal.key}`,
      fact,
      image: { shape: 'rosette', face: 'month', num: '★', mini: 'SEAL' },
      open: { kind: 'seal', seal: SEAL_KIND[seal.key], title: seal.name, year: g?.year ?? null, awardedOn: awardDay(g?.awardedAt) },
    });
  }
  for (const t of view.shopBadges) {
    const i = TIER_KEYS.findIndex((k) => tierName(k) === t.tier);
    const step = i < 0 ? undefined : SHOP_BADGE_STEPS[FAMILY_LADDER[t.family]][i];
    if (step === undefined) continue;
    const row = FAMILY_ROW[t.family];
    out.push({
      key: `${t.family}:${step}`,
      fact: row.fact(step),
      image: { shape: 'hex', face: LADDER_MATERIALS[Math.min(i, LADDER_MATERIALS.length - 1)]!, num: faceNumber(step), mini: row.mini },
      open: { kind: 'tier', tierIndex: i + 1, tierName: t.tier, title: t.name, family: row.family },
    });
  }
  return out;
}
