/**
 * 🏅⏱ BADGE UPGRADES — the personal half of the badge rewards (owner approved the table 2026-11-06, DECISION_LOG
 * "BADGE REWARDS — THE APPROVED TABLE (6 NOV)").
 *
 * The gift-stock half (`lib/badge-rewards.ts`) gives the supplier things to hand ON to couples. This half gives the
 * supplier's OWN shop four weeks of a catalogue add-on:
 *
 *   Verified (once)                         → Papic Challenges
 *   First booking through Setnayan (once)   → 3D Booth  (a Free or Verified shop gets Papic Challenges instead — the
 *                                             booth logo only shows on Supplier Plus and up, `boothCanBrand`)
 *   5 reviews (once)                        → AI Chatbot
 *   Top Pick / Most Booked of the month     → ONE of the three, the supplier's choice (the 3D Booth only for Supplier Plus and up)
 *                                             — in addition to the Event Plus that award already puts in the gift stock
 *   Rising and every other badge            → no upgrade
 *
 * 🔑 READY UNTIL STARTED. An earned upgrade waits as "ready to start" and never expires unused; its four weeks begin when
 * the supplier taps Start (`shop_badge_upgrade_start`), which extends the SAME entitlement column a paid purchase does —
 * stacking on time already paid for, exactly like `nextPhotoChallengeExpiry` / `nextVendor3dBoothExpiry` /
 * `nextVendorAiAddonExpiry`.
 *
 * 🔑 NO TYPED PRODUCT. Each choice names the add-on's catalogue `sku_code` constant and its period constant — the very
 * ones the paid activation uses. (`vendor_billing_catalog` holds no duration column: the four weeks live in those
 * constants, so a free upgrade can never last longer or shorter than a paid one.)
 *
 * 🔑 EXACTLY ONCE: every upgrade has a key (`upgrade:verified` · `upgrade:first_booking` · `upgrade:reviews:5` ·
 * `upgrade:award:top_pick:2026-11-01`), UNIQUE per shop in `shop_badge_upgrades`; a Start is a one-way flip.
 *
 * PURE — no I/O, no clock, no `server-only`. Reads, grants and Start: `lib/badge-upgrades.server.ts`.
 */

import { formatCount } from '@/lib/format-number';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS, VENDOR_PHOTO_CHALLENGE_SKU_CODE } from '@/lib/vendor-photo-challenge';
import { VENDOR_3D_BOOTH_PERIOD_DAYS, VENDOR_3D_BOOTH_SKU_CODE } from '@/lib/vendor-3d-booth-pricing';
import { VENDOR_AI_ADDON_PERIOD_DAYS, VENDOR_AI_ADDON_SKU_CODE } from '@/lib/vendor-addon-pricing';
import type { BadgeRewardFacts } from '@/lib/badge-rewards';
import type { VendorAddonSku } from '@/lib/vendor-addon-tier-pricing';
import type { SpotlightAwardType } from '@/lib/spotlight-awards';

/** The three add-ons a badge can unlock — the database's `shop_badge_upgrades_choice_allowed` list. */
export const BADGE_UPGRADE_CHOICES = ['photo_challenge', '3d_booth', 'ai_chatbot'] as const;
export type BadgeUpgradeChoice = (typeof BADGE_UPGRADE_CHOICES)[number];

/**
 * Each choice's catalogue product and period — the paid activation's own constants, never typed here. `addon` names
 * its price rows (`VENDOR_ADDON_BAND_SKU_CODES`): Start needs one of them on sale.
 */
export const BADGE_UPGRADE_PRODUCT: Readonly<Record<BadgeUpgradeChoice, { skuCode: string; addon: VendorAddonSku; periodDays: number }>> = {
  photo_challenge: { skuCode: VENDOR_PHOTO_CHALLENGE_SKU_CODE, addon: 'papic_challenge', periodDays: VENDOR_PHOTO_CHALLENGE_PERIOD_DAYS },
  '3d_booth': { skuCode: VENDOR_3D_BOOTH_SKU_CODE, addon: 'ads_3d_plan', periodDays: VENDOR_3D_BOOTH_PERIOD_DAYS },
  ai_chatbot: { skuCode: VENDOR_AI_ADDON_SKU_CODE, addon: 'ai_chatbot_basic', periodDays: VENDOR_AI_ADDON_PERIOD_DAYS },
};

/** The product words the supplier already sees on Plan (the catalogue titles carry plan bands and old prices). */
export const BADGE_UPGRADE_NAME: Readonly<Record<BadgeUpgradeChoice, string>> = {
  photo_challenge: 'Papic Challenges',
  '3d_booth': '3D Booth',
  ai_chatbot: 'AI Chatbot',
};

/**
 * The plan the 3D Booth needs before its logo shows — the booth's own floor (`BOOTH_BRANDING_MIN_TIER` in
 * `lib/seating-3d.ts`, Supplier Plus and up). Re-stated as a value here so this module stays light enough for a screen; the
 * test pins the two equal, and the Start door re-checks it in the database.
 */
export const BADGE_UPGRADE_BOOTH_MIN_TIER = 'solo' as const;

/** The upgrade each badge gives. `choices` with more than one entry = the supplier picks one at Start. */
export const BADGE_UPGRADES = {
  verified: { choices: ['photo_challenge'] as const },
  first_booking: { choices: ['3d_booth'] as const },
  reviews: { step: 5, choices: ['ai_chatbot'] as const },
  award: { types: ['top_pick', 'most_booked'] as readonly SpotlightAwardType[], choices: BADGE_UPGRADE_CHOICES },
} as const;

/* ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export function upgradeKey(badge: 'verified' | 'first_booking'): string;
export function upgradeKey(badge: 'reviews', step: number): string;
export function upgradeKey(badge: 'award', type: SpotlightAwardType, periodMonth: string): string;
export function upgradeKey(badge: string, a?: string | number, b?: string): string {
  if (badge === 'reviews') return `upgrade:reviews:${a}`;
  if (badge === 'award') return `upgrade:award:${a}:${String(b).slice(0, 10)}`;
  return `upgrade:${badge}`;
}

/* ── what a shop is owed ──────────────────────────────────────────────────────────────────────────────────────── */

export type OwedUpgrade = { key: string; badge: 'verified' | 'first_booking' | 'reviews' | 'award'; choices: BadgeUpgradeChoice[]; note: string };

const AWARD_WORD: Record<SpotlightAwardType, string> = { top_pick: 'Top Pick', most_booked: 'Most Booked', rising: 'Rising' };

/**
 * Every upgrade the shop's MEASURED badges have earned, granted already or not. Reads the SAME facts as the gift-stock
 * rewards, so a badge earns both at the same read. `null` facts earn nothing (never a zero, never a guess).
 */
export function upgradesOwed(f: BadgeRewardFacts): OwedUpgrade[] {
  const out: OwedUpgrade[] = [];
  if (f.verified === true) {
    out.push({ key: upgradeKey('verified'), badge: 'verified', choices: [...BADGE_UPGRADES.verified.choices], note: 'Badge upgrade · SETNAYAN Verified' });
  }
  if (f.firstSourcedBooking === true) {
    out.push({
      key: upgradeKey('first_booking'),
      badge: 'first_booking',
      choices: [...BADGE_UPGRADES.first_booking.choices],
      note: 'Badge upgrade · first booking through Setnayan',
    });
  }
  const step = BADGE_UPGRADES.reviews.step;
  if (f.trustedReviews !== null && Number.isFinite(f.trustedReviews) && f.trustedReviews >= step) {
    out.push({ key: upgradeKey('reviews', step), badge: 'reviews', choices: [...BADGE_UPGRADES.reviews.choices], note: `Badge upgrade · ${step} reviews` });
  }
  const seen = new Set<string>();
  for (const a of f.awards ?? []) {
    if (!BADGE_UPGRADES.award.types.includes(a.type)) continue;
    const key = upgradeKey('award', a.type, a.periodMonth);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, badge: 'award', choices: [...BADGE_UPGRADES.award.choices], note: `Badge upgrade · ${AWARD_WORD[a.type]} · ${a.periodMonth.slice(0, 7)}` });
  }
  return out;
}

/**
 * What the shop may start TODAY from an upgrade's stored choices: on a plan below Supplier Plus the 3D Booth becomes Papic
 * Challenges (owner, 6 Nov: "a Free or Verified shop gets Papic Challenges instead"). Decided at Start, not at grant,
 * so a shop that moves up to Supplier Plus before starting gets the booth it earned. The database's Start door applies the
 * same rule (`shop_badge_upgrade_start`).
 */
export function startableChoices(choices: readonly BadgeUpgradeChoice[], tier: string | null | undefined): BadgeUpgradeChoice[] {
  const boothOk = isTierAtLeast(tier, BADGE_UPGRADE_BOOTH_MIN_TIER);
  const out: BadgeUpgradeChoice[] = [];
  for (const c of choices) {
    const v: BadgeUpgradeChoice = c === '3d_booth' && !boothOk ? 'photo_challenge' : c;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/* ── words ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** Which badge an upgrade came from: "SETNAYAN Verified" · "5 reviews" · "Top Pick · Nov 2026". */
export function upgradeSourceWords(key: string): string {
  const [, head, a, b] = key.split(':');
  switch (head) {
    case 'verified':
      return 'SETNAYAN Verified';
    case 'first_booking':
      return 'First booking through Setnayan';
    case 'reviews':
      return `${formatCount(Number(a) || 0)} reviews`;
    case 'award': {
      const word = AWARD_WORD[a as SpotlightAwardType] ?? 'Monthly award';
      const d = b ? new Date(`${b.slice(0, 10)}T00:00:00Z`) : null;
      const month = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      return month ? `${word} · ${month}` : word;
    }
    default:
      return 'Badge upgrade';
  }
}

/** "4 weeks of Papic Challenges" · "4 weeks of your choice". The weeks come from the period constant. */
export function upgradeWords(choices: readonly BadgeUpgradeChoice[]): string {
  const days = choices.length > 0 ? Math.max(...choices.map((c) => BADGE_UPGRADE_PRODUCT[c].periodDays)) : 0;
  const weeks = days % 7 === 0 ? `${days / 7} weeks` : `${days} days`;
  return choices.length === 1 ? `${weeks} of ${BADGE_UPGRADE_NAME[choices[0]!]}` : `${weeks} of your choice`;
}

/** One upgrade as the screen needs it — `startable` already resolved for the shop's plan. */
export type BadgeUpgradeRow = {
  upgradeId: string;
  key: string;
  grantedAt: string;
  /** What Start may begin today (resolved by `startableChoices`). Empty once started. */
  startable: BadgeUpgradeChoice[];
  /** Started: what, when, until. */
  startedChoice: BadgeUpgradeChoice | null;
  startedAt: string | null;
  endsAt: string | null;
};

/** The upgrade line on a badge row: "Also: 4 weeks of Papic Challenges · ready to start" / "… · started". */
export function upgradeLineFor(
  badge: 'verified' | 'first_booking' | 'reviews' | 'award',
  rows: readonly BadgeUpgradeRow[] | null,
  tier: string | null | undefined,
): string | null {
  const choices = startableChoices(badge === 'award' ? BADGE_UPGRADES.award.choices : BADGE_UPGRADES[badge].choices, tier);
  const prefix = badge === 'reviews' ? `upgrade:reviews:` : `upgrade:${badge}`;
  const mine = (rows ?? []).filter((r) => r.key.startsWith(prefix));
  const ready = mine.filter((r) => !r.startedAt).length;
  if (badge === 'award') {
    const base = `Top Pick or Most Booked also → ${upgradeWords(choices)}`;
    return ready > 0 ? `${base} · ${ready} ready to start in Plan` : base;
  }
  const when = badge === 'reviews' ? `At ${formatCount(BADGE_UPGRADES.reviews.step)} reviews also → ` : 'Also → ';
  const words = mine[0] ? upgradeWords(mine[0].startedChoice ? [mine[0].startedChoice] : mine[0].startable) : upgradeWords(choices);
  if (!mine[0]) return `${when}${words}`;
  return `${when}${words} · ${mine[0].startedAt ? 'started' : 'ready to start in Plan'}`;
}
