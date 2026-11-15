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
