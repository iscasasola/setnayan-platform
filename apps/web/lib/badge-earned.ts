/**
 * 🏅💌 "YOU EARNED …" — the words a supplier gets the moment a badge is earned (owner 2026-11-15, DECISION_LOG
 * "SUPPLIER BADGES, SEALS AND REWARDS"; the copy is the controller's build map "Make the suppliers feel loved", used
 * VERBATIM):
 *
 *   title  "You earned {Tier} {Badge}, {Shop}!"
 *   body   "Every family you served got you here. Thank you for making their day. Your {reward} is waiting — tap to
 *           claim it."
 *
 * A once-badge (Verified, a first) and a monthly award have no tier: the title drops the {Tier} word. A shop with no
 * name drops ", {Shop}". ONE notice per sweep — the most valuable of what it paid (`pickBadgeToTell`) — so a shop
 * whose counters were first read today is told once, not once per step.
 *
 * PURE — no I/O. Sent by `lib/badge-earned.server.ts`; held by `lib/badge-earned.test.ts`.
 */
import { tierName, type TierKey } from '@/lib/badge-tiers';
import type { RewardBadge } from '@/lib/badge-rewards';

/** The badge's own name in the notice ("Gold Reviews", "Ruby Trusted by"). */
export const BADGE_EARNED_NAME: Readonly<Record<RewardBadge, string>> = {
  verified: 'SETNAYAN Verified',
  first_booking: 'First booking',
  first_review: 'First review',
  first_five_star: 'First 5★ review',
  first_loop: 'First Booked Loop',
  first_first_pick: 'First 1st Pick',
  events: 'Events', // the dashboard tile's own title (lib/shop-badge-row.ts)
  reviews: 'Reviews',
  first_pick: '1st Pick',
  booked_loop: 'Booked Loop',
  branches: 'Branches',
  service_cards: 'Service cards',
  inspiration: 'Inspiration box',
  trusted_by: 'Trusted by',
  award: 'Monthly award',
};

const AWARD_NAME: Readonly<Record<string, string>> = { most_booked: 'Most Booked', top_pick: 'Top Pick', rising: 'Rising' };

export type EarnedInput = {
  key: string;
  badge: RewardBadge;
  tier?: TierKey | null;
  /** The shop's name as it calls itself; null/blank = said without it. */
  shopName: string | null;
  /** The reward in words, read from the catalogue ("Papic 1000", "Event Plus"). */
  reward: string;
};

/** Where the notice opens: the shop's gifts, where the reward waits with "Tap to claim" (gift moment, 14 Nov). */
export const BADGE_EARNED_HREF = '/vendor-dashboard/shop/promote#gifts';

export function badgeEarnedNotice(i: EarnedInput): { title: string; body: string } {
  const name = i.badge === 'award' ? (AWARD_NAME[i.key.split(':')[1] ?? ''] ?? BADGE_EARNED_NAME.award) : BADGE_EARNED_NAME[i.badge];
  const what = i.tier ? `${tierName(i.tier)} ${name}` : name;
  const shop = i.shopName?.trim();
  return {
    title: `You earned ${what}${shop ? `, ${shop}` : ''}!`,
    body: `Every family you served got you here. Thank you for making their day. Your ${i.reward} is waiting — tap to claim it.`,
  };
}

const TIER_ORDER: readonly TierKey[] = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7'];

/** Of the rewards one sweep paid, the one to tell: the highest tier; a tierless one only when nothing has a tier. */
export function pickBadgeToTell<T extends { tier?: TierKey | null }>(paid: readonly T[]): T | null {
  if (paid.length === 0) return null;
  const rank = (t: T) => (t.tier ? TIER_ORDER.indexOf(t.tier) : -1);
  return [...paid].sort((a, b) => rank(b) - rank(a))[0]!;
}
