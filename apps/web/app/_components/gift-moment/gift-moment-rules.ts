/**
 * 🎁 THE GIFT MOMENT'S SCREEN RULES — PURE, so the popup's two forks are unit-tested
 * (`the-gift-box-is-the-approved-one.test.ts`). The words of a gift are `lib/gift-moment.ts`; these are the two
 * decisions the approved gift box (owner 15 Nov) adds on top of them.
 */
import type { GiftMomentView, GiftSeal } from '@/lib/gift-moment';

/**
 * How a gift is claimed (DECISION_LOG 2026-11-15 e5ec685d, point 2): a badge or seal reward is claimed AUTOMATICALLY
 * when the popup shows (owner: "once the pop up shows, that is already claimed. We are just showing that they
 * received something"); a couple's Redeem of a supplier's gift KEEPS its press. Both land on the same once-only key.
 */
export type GiftClaimMode = 'auto' | 'press';

export function claimModeFor(view: Pick<GiftMomentView, 'source'>): GiftClaimMode {
  return view.source === 'badge_reward' ? 'auto' : 'press';
}

/**
 * The background the box sits on (owner 15 Nov: "the gift should live on the same background as to whatever badge it
 * is on"): Verified's navy when the badge is Verified, a tier's gold for any other badge; none for a gift that did not
 * come with a badge (a supplier's gift to a couple sits on the shipped blurred backdrop over their page).
 */
export type GiftStage = 'verified' | 'tier' | null;

export function stageFor(view: Pick<GiftMomentView, 'source' | 'badge'>): GiftStage {
  if (view.source !== 'badge_reward') return null;
  return view.badge?.to.key === 'verified' ? 'verified' : 'tier';
}

/** The words the approved box adds (owner 15 Nov: "For the gift tap to go to next. Or tap to exit"). */
export const GIFT_WORDS = {
  tapToClose: 'Tap to close',
} as const;

/** Which paper a box wears (owner 15 Nov: "Setnayan box is gold" · "Supplier box is terracotta"): Setnayan's mark → gold. */
export type GiftBoxPaper = 'setnayan' | 'supplier';

export function paperFor(seal: GiftSeal): GiftBoxPaper {
  return seal.kind === 'setnayan' ? 'setnayan' : 'supplier';
}
