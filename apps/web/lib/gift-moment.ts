/**
 * 🎁 THE GIFT MOMENT — the words, PURE (no I/O, no `server-only`), so every rule is unit-testable
 * (`gift-moment.test.ts`). The reads are `lib/gift-moment.server.ts`; the claim is migration `gift_moment_claims`;
 * the popup is `app/_components/gift-moment/`.
 *
 * ⚖ OWNER RULINGS (corpus DECISION_LOG 2026-11-14 — closed, do not re-ask):
 *   • "THE GIFT MOMENT — A POPUP, TAP TO OPEN": the giver's logo on the wax seal (two initials when no logo), tap →
 *     shake → burst + confetti → the opened box → "Congratulations! You received …" → Redeem. Reduced motion fades.
 *   • "ONE PIECE, USED THREE WAYS": a supplier's gift to a couple · a badge and its reward · a gift from Setnayan. Only
 *     the seal, the top lines and Redeem's destination change.
 *   • "PRESSING REDEEM IS THE CLAIM — AND IT CAN NEVER COUNT TWICE": the press is the claim, keyed in the database.
 *   • "GIFT DESIGN APPROVED — WITH FABLE'S EIGHT PICKS": (6) each host once, guests never; (7) two shops play back to
 *     back, "1 of 2", never merged; (8) "Redeem", with "Already in your event's Papic pool" right above it; no video.
 *   • Drawing (artifact QSMD9BaefarMRNQAnMFiND §6): Close is "Later"; an unclaimed gift waits as ONE notice line,
 *     "🎁 A gift from <giver> is waiting · Open", with no close word; the badge moment shows the previous badge, then
 *     the new one, with the reward under it. Words are said in packs and credits — never pesos.
 *
 * 🔑 THE GIFT IS ALREADY THEIRS. Redeem only takes them to where it landed; the claim grants nothing.
 */

import { BADGE_REWARDS, FALLBACK_REWARD_NAMES, rewardSourceWords, rewardWords, type BadgeRewardKind, type RewardBadge, type RewardNames } from '@/lib/badge-rewards';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { milestoneBadge, verifiedBadge, type ShopBadge } from '@/lib/shop-badges';
import { shopInitials } from '@/lib/shop-initials';

/** What a gift is. G3 adds `setnayan_gift` here, in the migration's CHECK and in the two read functions. */
export type GiftMomentSource = 'shop_gift' | 'badge_reward';

export const GIFT_MOMENT_SOURCES: readonly GiftMomentSource[] = ['shop_gift', 'badge_reward'];

export function isGiftMomentSource(v: unknown): v is GiftMomentSource {
  return typeof v === 'string' && (GIFT_MOMENT_SOURCES as readonly string[]).includes(v);
}

/** What is pressed into the wax: the giver's logo, its two initials, or Setnayan's mark. */
export type GiftSeal = { kind: 'logo'; src: string; initials: string } | { kind: 'initials'; initials: string } | { kind: 'setnayan' };

/** The badge moment's old → new: `from` null = "No badge yet". */
export type GiftBadgeStep = { from: ShopBadge | null; to: ShopBadge };

/**
 * ONE gift moment, every word composed. This is the GiftMoment popup's whole input besides its callbacks — G3 builds
 * one of these for a Setnayan gift to a shop and reuses the popup unchanged (see `app/_components/gift-moment/README`
 * in the component's docblock).
 */
export type GiftMomentView = {
  source: GiftMomentSource;
  /** The row the claim is keyed to (`gift_moment_claims.ref_id`). */
  ref: string;
  /** `<source>:<ref>` — stable; the memory keys hang off it. */
  key: string;
  giverName: string;
  seal: GiftSeal;
  /** Small caps over the gift: "A gift for your event" · "A badge for your shop". */
  eyebrow: string;
  /** "A gift from Liwanag Lights & Bar" · "From Setnayan". */
  fromLine: string;
  /** "Congratulations!" */
  headline: string;
  /** "You received 1 × Papic 1000 from Liwanag Lights & Bar" · "You earned 50 events · Silver". */
  received: string;
  /** "1,000 Papic credits" · "Your reward: Event Plus". */
  detail: string | null;
  /** Right above Redeem: "Already in your event's Papic pool" · "In your gifts". */
  landedLine: string | null;
  /** The badge moment only. */
  badge: GiftBadgeStep | null;
  /** Where Redeem goes once the claim is in. */
  redeemHref: string;
  /** The waiting line's words, without the 🎁: "A gift from Liwanag Lights & Bar is waiting". */
  waitingLine: string;
  landedAt: string;
  /** null = waiting (not claimed). */
  claimedAt: string | null;
};

const COUNT = new Intl.NumberFormat('en-PH');

export function giftMomentKey(source: GiftMomentSource, ref: string): string {
  return `${source}:${ref}`;
}

/** The seal for a giver: its logo when it has one, else its two initials (the app's one two-letter rule). */
export function sealFor(name: string, logoSrc: string | null | undefined): GiftSeal {
  const initials = shopInitials(name || 'Setnayan');
  return logoSrc ? { kind: 'logo', src: logoSrc, initials } : { kind: 'initials', initials };
}

/* ── a supplier's gift to a couple ────────────────────────────────────────────────────────────────────────────── */

/** One gift line of the accepted quote, as `gift_moments_for_event` returns it. */
export type ShopGiftLine = { title: string; kind: string; credits: number };

export type ShopGiftMomentRow = {
  ref: string;
  giverName: string | null;
  /** Already resolved to something an <img> can show (the server presigns), or null. */
  logoSrc: string | null;
  lines: readonly ShopGiftLine[];
  landedAt: string;
  claimedAt: string | null;
};

/** "1 × Papic 1000" · "2 × Papic 150" · "Event Plus" — whole packs, never pesos (owner 14 Nov: counted in packs). */
export function giftLinesWords(lines: readonly ShopGiftLine[]): string[] {
  const order: string[] = [];
  const by = new Map<string, { kind: string; n: number }>();
  for (const l of lines) {
    const title = (l?.title ?? '').trim();
    if (!title) continue;
    const had = by.get(title);
    if (had) had.n += 1;
    else {
      by.set(title, { kind: l.kind, n: 1 });
      order.push(title);
    }
  }
  return order.map((t) => {
    const { kind, n } = by.get(t)!;
    return kind === 'papic' ? `${n} × ${t}` : n > 1 ? `${n} × ${t}` : t;
  });
}

/** "a, b and c". */
export function andList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function shopGiftMomentView(row: ShopGiftMomentRow, eventId: string): GiftMomentView {
  const giver = row.giverName?.trim() || 'your supplier';
  const words = giftLinesWords(row.lines);
  const credits = row.lines.filter((l) => l.kind === 'papic').reduce((s, l) => s + (Number.isFinite(l.credits) ? l.credits : 0), 0);
  const hasPlan = row.lines.some((l) => l.kind !== 'papic');
  const what = words.length > 0 ? andList(words) : 'a gift';
  return {
    source: 'shop_gift',
    ref: row.ref,
    key: giftMomentKey('shop_gift', row.ref),
    giverName: giver,
    seal: sealFor(giver, row.logoSrc),
    eyebrow: 'A gift for your event',
    fromLine: `A gift from ${giver}`,
    headline: 'Congratulations!',
    received: `You received ${what} from ${giver}`,
    detail: credits > 0 ? `${COUNT.format(credits)} Papic credits` : null,
    landedLine: credits > 0 ? (hasPlan ? 'Both are already on your event' : 'Already in your event’s Papic pool') : 'Already on your event',
    badge: null,
    // Papic (alone or with a plan) → the Papic pool, which lives in Memories; a plan alone → Home's Event Settings.
    redeemHref: credits > 0 ? `/dashboard/${eventId}/memories` : `/dashboard/${eventId}?settings=1`,
    waitingLine: `A gift from ${giver} is waiting`,
    landedAt: row.landedAt,
    claimedAt: row.claimedAt,
  };
}

/* ── a badge and its reward ───────────────────────────────────────────────────────────────────────────────────── */

export type BadgeRewardMomentRow = {
  ref: string;
  rewardKey: string;
  badge: string;
  rewardKind: string;
  units: number;
  landedAt: string;
  claimedAt: string | null;
};

/**
 * The previous badge and the new one, for the badges that wear a pill: an events step (its milestone, the step
 * below it before — or "No badge yet" for the first) and Verified. Others name their badge in words only.
 */
export function badgeStepFor(rewardKey: string): GiftBadgeStep | null {
  const [head, part] = rewardKey.split(':');
  if (head === 'verified') return { from: null, to: verifiedBadge() };
  if (head === 'events') {
    const n = Number(part);
    const steps = MILESTONE_THRESHOLDS as readonly number[];
    const i = steps.indexOf(n);
    if (i < 0) return null;
    return { from: i > 0 ? milestoneBadge(steps[i - 1]!) : null, to: milestoneBadge(n) };
  }
  return null;
}

function rewardWordsSafe(kind: string, units: number, names: RewardNames): string {
  if (kind === 'fee_waiver' || kind in names) return rewardWords({ kind: kind as BadgeRewardKind, units }, names);
  // A kind this build does not name yet (a later reward kind): its words from the kind itself, never blank.
  const name = kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return units > 1 ? `${units} × ${name}` : name;
}

export function badgeRewardMomentView(row: BadgeRewardMomentRow, names: RewardNames = FALLBACK_REWARD_NAMES): GiftMomentView {
  const step = badgeStepFor(row.rewardKey);
  const earned = rewardSourceWords(row.rewardKey);
  const first = step !== null && step.from === null;
  const knownBadge = (row.badge as RewardBadge) in BADGE_REWARDS;
  return {
    source: 'badge_reward',
    ref: row.ref,
    key: giftMomentKey('badge_reward', row.ref),
    giverName: 'Setnayan',
    seal: { kind: 'setnayan' },
    eyebrow: 'A badge for your shop',
    fromLine: 'From Setnayan',
    headline: 'Congratulations!',
    received: first && row.rewardKey.startsWith('events:') ? `You earned your first badge, ${earned}` : `You earned ${knownBadge ? earned : 'a badge'}`,
    detail: `Your reward: ${rewardWordsSafe(row.rewardKind, row.units, names)}`,
    landedLine: row.rewardKind === 'fee_waiver' ? 'Used by itself on your next booking' : 'In your gifts',
    badge: step,
    redeemHref: '/vendor-dashboard/shop/promote#gifts',
    waitingLine: 'A gift from Setnayan is waiting',
    landedAt: row.landedAt,
    claimedAt: row.claimedAt,
  };
}

/* ── which ones play, which ones wait · the claim — in `gift-moment-queue.ts` (no imports, so the page's first load
   carries none of the badge tables above); re-exported here so every rule has one address. */
export {
  byLanded,
  CLAIM_WORDS,
  claimStateFrom,
  giftMomentSeenKey,
  giftWaitingNoticeKey,
  momentsToPlay,
  momentsWaiting,
  queueCounter,
  type ClaimState,
} from './gift-moment-queue';
