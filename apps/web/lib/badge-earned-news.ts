/**
 * 🏅 TODAY'S "NEWLY EARNED" LINE — ONLY THE APPROVED BADGES (owner 15 Nov, DECISION_LOG "THE BADGES IN THE APPROVED
 * PROTOTYPE ARE THE ONLY BADGES"; owner 17 Nov on live: *"i still see old badges?"*).
 *
 * The line used to announce the OLD shelf (`newlyEarned` over `shopBadges`: the Events ladder, Rating, Business since,
 * the monthly awards). It now announces only what the award queue plays (`readAwardQueue`, lib/award-queue.server.ts):
 * Setnayan Verified and a tier of one of the five badges — Completed bookings · Five-star reviews · Gifts given ·
 * Trusted by · Invites. A retired badge's reward never plays there, so it can never be announced here.
 *
 * "NEWLY" is the same memory as before (`setnayan.badges_seen.<shop>`): a key already in it is not news.
 * PURE. 🔒 lib/badge-earned-news.test.ts
 */
import type { AwardItem } from './award-queue';
import { SHOP_BADGE_KEYS, TIER_KEYS, type ShopBadgeKey } from './badge-tiers';
import { SHELF_FAMILY, badgeArtSrc } from './shop-badge-shelf';

export type AwardNews = {
  /** The award's key ('verified', 'completed_bookings:tier3'). */
  key: string;
  /** ONE short line (≤ 40 characters) — the reason is in `detail`, behind the ⓘ. */
  sentence: string;
  detail: string;
  /** What to remember on Got it: everything the queue holds today, plus what was already seen. */
  keys: string[];
  /** The v84 picture to draw beside it: a tier's webp, or Verified's blue check. */
  art: { kind: 'tier'; src: string } | { kind: 'verified' };
};

export const AWARD_NEWS_DETAIL = 'Open it on Shop › Badges — it lifts out of your badge row.';
export const AWARD_NEWS_HREF = '/vendor-dashboard/shop#badges';

/** Is this award one of the approved ones — Verified or a tier of the five? */
export function isApprovedAward(item: Pick<AwardItem, 'key'>): boolean {
  if (item.key === 'verified') return true;
  const [badge, tier] = item.key.split(':');
  return (SHOP_BADGE_KEYS as readonly string[]).includes(badge ?? '') && (TIER_KEYS as readonly string[]).includes(tier ?? '');
}

/**
 * The newest approved award the shop has not seen yet, or null. `queue` null (unread) is no news — the line simply
 * does not appear; it never says "nothing earned".
 */
export function awardNews(queue: readonly AwardItem[] | null, seen: readonly string[]): AwardNews | null {
  if (!queue) return null;
  const approved = queue.filter(isApprovedAward);
  const fresh = approved.filter((a) => !seen.includes(a.key)).sort((a, b) => b.earnedAt.localeCompare(a.earnedAt) || a.key.localeCompare(b.key));
  const top = fresh[0];
  if (!top) return null;
  const keys = [...new Set([...seen, ...approved.map((a) => a.key)])];
  if (top.key === 'verified') return { key: top.key, sentence: 'You are Setnayan Verified', detail: AWARD_NEWS_DETAIL, keys, art: { kind: 'verified' } };
  const [badge, tier] = top.key.split(':') as [ShopBadgeKey, string];
  const ti = TIER_KEYS.indexOf(tier as (typeof TIER_KEYS)[number]) + 1;
  return { key: top.key, sentence: `Earned: ${top.title}`, detail: AWARD_NEWS_DETAIL, keys, art: { kind: 'tier', src: badgeArtSrc(SHELF_FAMILY[badge], ti) } };
}
