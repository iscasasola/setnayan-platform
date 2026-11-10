/**
 * apps/web/lib/social/lane-s.ts — BUILD 6 · LANE S (owner 2026-11-10): the PURE half of two auto-post types.
 *
 *   • supplier_badge — a supplier newly earning a badge composes ONE post (`lib/social/badge-post.ts`);
 *   • users_joined   — one more milestone metric beside events / suppliers / guests (`lib/social/milestones.ts`),
 *     and every milestone now counts REAL data only (`social_milestone_real_counts()`, migration 20271336072378).
 *
 * No I/O, no clock, no `server-only` — so every rule here is unit-tested directly (`lane-s.test.ts`).
 */

import { isShopLive } from '@/lib/vendor-visibility';
import { rewardSourceWords, type RewardBadge } from '@/lib/badge-rewards';

/* ── supplier_badge ─────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The badges that post, most newsworthy first. When ONE sweep grants several (a shop's first visit after a new
 * ladder lands can pay `first_review`, `reviews:5` and `reviews:10` at once), only the top one is posted — a shop
 * never floods Setnayan's Page in one go, and the rest are history, not news.
 *
 * 🔑 `verified` is deliberately ABSENT: the flush's vendor_feature sweep already announces a newly verified supplier,
 * so posting the badge too would put the same shop on the Page twice for one event.
 * Unmeasured badges (`first_five_star`, `first_first_pick`, `first_pick`) are never granted, so never posted; they
 * are listed so the day they are measured they post without anybody remembering this file.
 */
export const BADGE_POST_PRIORITY: readonly RewardBadge[] = [
  'award',
  'events',
  'reviews',
  'booked_loop',
  'first_pick',
  'first_booking',
  'first_loop',
  'first_first_pick',
  'first_five_star',
  'first_review',
  'branches',
  'service_cards',
  'inspiration',
];

/** `reviews:25` → { badge: 'reviews', step: 25 } · `award:top_pick:2026-11-01` → { badge: 'award', step: null }. */
function parseKey(key: string): { badge: string; step: number | null } {
  const [badge = '', part] = key.split(':');
  const n = part === undefined ? NaN : Number(part);
  return { badge, step: Number.isFinite(n) ? n : null };
}

/**
 * Of the reward keys ONE grant sweep just paid, the one badge worth a post — or null when none is. Highest priority
 * badge first; within a ladder, the highest step; within monthly awards, the latest key (they sort by date).
 */
export function pickBadgeToPost(grantedKeys: readonly string[]): string | null {
  let best: { key: string; rank: number; step: number } | null = null;
  for (const key of grantedKeys) {
    const { badge, step } = parseKey(key);
    const rank = BADGE_POST_PRIORITY.indexOf(badge as RewardBadge);
    if (rank < 0) continue;
    const s = step ?? 0;
    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && (s > best.step || (s === best.step && key > best.key)))
    ) {
      best = { key, rank, step: s };
    }
  }
  return best?.key ?? null;
}

/** The deterministic source_ref — one post per (supplier, badge step), held by the partial-unique index. */
export function badgeSourceRef(vendorProfileId: string, rewardKey: string): string {
  return `${vendorProfileId}:${rewardKey}`;
}

/** The supplier id back out of a badge post's source_ref (a UUID holds no ':'). */
export function vendorIdFromBadgeRef(sourceRef: string): string {
  const i = sourceRef.indexOf(':');
  return i < 0 ? sourceRef : sourceRef.slice(0, i);
}

/** The shop columns the badge gate reads — named once so a select can never fetch half of them. */
export const BADGE_SHOP_COLUMNS =
  'vendor_profile_id, user_id, business_name, business_slug, services, location_city, hq_region, tier_state, tier_expires_at, public_visibility, verification_state, is_demo, social_feature_opt_out' as const;

export type BadgeShopRow = {
  vendor_profile_id: string;
  user_id: string | null;
  business_name: string | null;
  business_slug: string | null;
  services: string[] | null;
  location_city: string | null;
  hq_region: string | null;
  tier_state: string | null;
  tier_expires_at: string | null;
  public_visibility: unknown;
  verification_state: unknown;
  is_demo: boolean | null;
  social_feature_opt_out: boolean | null;
};

/**
 * May this shop be featured on Setnayan's own Page? Fail-CLOSED on every unknown:
 *   • published — live in the marketplace (`isShopLive`: listed AND verified), the same bar the vendor_feature
 *     sweep uses, so a shop the public cannot find is never advertised;
 *   • never a sample shop (`is_demo`);
 *   • never a shop owned by an internal account (`ownerIsInternal` must be KNOWN false — null = unread = no);
 *   • never a shop that opted out of social features (`social_feature_opt_out`).
 */
export function isBadgeShopPostable(row: BadgeShopRow | null | undefined, ownerIsInternal: boolean | null): boolean {
  if (!row) return false;
  if (!isShopLive(row)) return false;
  if (row.is_demo !== false) return false;
  if (row.social_feature_opt_out !== false) return false;
  return ownerIsInternal === false;
}

/** Named for an active Pro / Ultra shop, unnamed (category + region) for the rest — the same hybrid the
 *  vendor_feature sweep applies (tiers sell REACH), with the same expiry guard. */
export function badgePostIsNamed(row: Pick<BadgeShopRow, 'tier_state' | 'tier_expires_at'>, now: Date): boolean {
  return (
    (row.tier_state === 'pro' || row.tier_state === 'enterprise') &&
    (!row.tier_expires_at || new Date(row.tier_expires_at).getTime() > now.getTime())
  );
}

export type BadgePostCopy = { title: string; body: string; linkUrl: string };

/**
 * The post's words. `badgeWords` is the gifts list's own name for the badge step (`rewardSourceWords`), so the Page
 * and the supplier's dashboard never name the same badge two ways.
 */
export function badgePostCopy(input: {
  rewardKey: string;
  named: boolean;
  businessName: string;
  businessSlug: string | null;
  categoryLabel: string;
  region: string;
  origin: string;
}): BadgePostCopy {
  const origin = input.origin.replace(/\/+$/, '');
  const words = rewardSourceWords(input.rewardKey);
  const name = input.businessName.trim();
  const named = input.named && name.length > 0;
  const shopUrl = input.businessSlug ? `${origin}/v/${encodeURIComponent(input.businessSlug)}` : null;
  if (named) {
    const linkUrl = shopUrl ?? `${origin}/vendors`;
    return {
      title: `${name} · ${words}`,
      body:
        `🏅 Congratulations, ${name}! A new badge on Setnayan: ${words}. 🎉` +
        `\n\nSee their shop → ${linkUrl}\n\n#Setnayan #SetNaYan`,
      linkUrl,
    };
  }
  const who = `a ${input.categoryLabel.toLowerCase()} in ${input.region}`;
  const linkUrl = `${origin}/vendors`;
  return {
    title: `New badge · ${words}`,
    body:
      `🏅 A new badge on Setnayan: ${words} — earned by ${who}. ` +
      `Congratulations to every supplier growing with us! 🎉` +
      `\n\nFind suppliers on Setnayan → ${linkUrl}\n\n#Setnayan #SetNaYan`,
    linkUrl,
  };
}

/* ── milestones ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** Milestone ladder — § 8: celebrate round numbers, aggregate counts only. */
export const MILESTONE_LADDER: readonly number[] = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export const MILESTONE_METRICS = ['events_created', 'vendors_verified', 'guests_invited', 'users_joined'] as const;
export type MilestoneMetric = (typeof MILESTONE_METRICS)[number];

const n = (v: number) => v.toLocaleString('en-PH');

/** Each metric's caption — the first three unchanged from the flush; `users_joined` is Lane S's. */
export const MILESTONE_CAPTIONS: Readonly<Record<MilestoneMetric, (count: number) => string>> = {
  events_created: (c) =>
    `🎉 ${n(c)}+ events now planned on Setnayan — from "will you?" to "Set na 'yan." Thank you for trusting us with your big days. ✨\n\n#Setnayan #SetNaYan`,
  vendors_verified: (c) =>
    `✅ ${n(c)}+ verified vendors on the Setnayan marketplace — every single one vetted by our team before they meet your big day.\n\n#Setnayan #SetNaYan`,
  guests_invited: (c) =>
    `💌 ${n(c)}+ guests invited through Setnayan — QR invitations, RSVPs, and seats, all sorted. Set na 'yan.\n\n#Setnayan #SetNaYan`,
  users_joined: (c) =>
    `🙌 ${n(c)}+ people have joined Setnayan — couples, families, and suppliers planning their big days together. Salamat! Set na 'yan.\n\n#Setnayan #SetNaYan`,
};

/**
 * The RPC's answer, read strictly: a metric is a count only when it arrives as a finite, non-negative integer.
 * Anything else (missing key, null, a string, a refused read) is null — and a null metric is skipped, never guessed.
 */
export function parseRealCounts(raw: unknown): Record<MilestoneMetric, number | null> {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<MilestoneMetric, number | null>;
  for (const metric of MILESTONE_METRICS) {
    const v = typeof obj[metric] === 'string' ? Number(obj[metric]) : obj[metric];
    out[metric] = typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  }
  return out;
}

/** The highest rung `count` has crossed that is not yet recorded — or null. Only the top rung is ever celebrated. */
export function milestoneToCelebrate(
  metric: MilestoneMetric,
  count: number | null,
  recorded: ReadonlySet<string>,
): number | null {
  if (count === null) return null;
  const crossed = MILESTONE_LADDER.filter((t) => t <= count);
  const highest = crossed[crossed.length - 1];
  if (highest === undefined) return null;
  return recorded.has(`${metric}:${highest}`) ? null : highest;
}
