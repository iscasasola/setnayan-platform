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
import type { PublicBadgeView } from './public-badges';
import { SHOP_BADGE_STEPS, TIER_KEYS, stepGlyph, tierName } from './badge-tiers';

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

/**
 * 🏅 THE AWARDS ROW, FROM THE ONE ADAPTER (`publicBadgeView`, lib/public-badges.ts — #7807 / #7810): what the row draws
 * after Setnayan Verified (which keeps its own <li>, the one the top bar's check opens). In the adapter's order —
 * the tiered shop badges, then the seals the shop holds (the seals engine, #7825). Each comes back as the `ShopBadge`
 * the row's circle (`badgeImageOf`) already draws, and its `label` IS the one plain fact: no tier name, no date.
 *
 * Named gaps (never a guessed picture): of the five tiered badges only Completed bookings has a circle on this page
 * (the events hex); the other four, and each seal's own art, come with the badge graphs. A seal draws the shipped
 * award rosette until then.
 */
export function awardsRowBadges(view: PublicBadgeView): ShopBadge[] {
  const out: ShopBadge[] = [];
  for (const t of view.shopBadges) {
    if (t.family !== 'bookings') continue;
    const i = TIER_KEYS.findIndex((k) => tierName(k) === t.tier);
    const step = i < 0 ? undefined : SHOP_BADGE_STEPS.completed_bookings[i];
    if (step === undefined) continue;
    const fact = `${COUNT.format(step)} booking${step === 1 ? '' : 's'} completed`;
    out.push({ key: `milestone:${step}`, kind: 'milestone', glyph: stepGlyph(step), line1: fact.toUpperCase(), line2: 'ON SETNAYAN', label: fact, tier: TIER_KEYS[i] });
  }
  for (const seal of view.seals) {
    if (seal.key === 'verified') continue;
    out.push({ key: `seal:${seal.key}`, kind: 'award', glyph: null, line1: 'SETNAYAN', line2: seal.name.toUpperCase(), label: seal.name });
  }
  return out;
}
