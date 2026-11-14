/**
 * 🎁 THE GIFT MOMENT — which ones play, which ones wait, and what the claim's answer means. PURE and IMPORT-FREE on
 * purpose: `app/_components/gift-moment/gift-moments.tsx` sits in the first load of Home and supplier Today, so this
 * file must not pull the badge tables in (`lib/gift-moment.ts` composes the words and re-exports all of this).
 */
import type { GiftMomentView } from './gift-moment';

/** The notice-memory key that says THIS ACCOUNT has seen the moment (each host once — follows them to a new phone). */
export function giftMomentSeenKey(v: Pick<GiftMomentView, 'key'>): string {
  return `gift-moment-seen:${v.key}`;
}

/** The waiting line's notice key — the fact (waiting) is in the key, and the line has no close word. */
export function giftWaitingNoticeKey(v: Pick<GiftMomentView, 'key'>): string {
  return `gift-waiting:${v.key}`;
}

/* ── which ones play, which ones wait ─────────────────────────────────────────────────────────────────────────── */

/** Oldest first — the order they landed in, so two shops' gifts play back to back in that order. */
export function byLanded(views: readonly GiftMomentView[]): GiftMomentView[] {
  return [...views].sort((a, b) => a.landedAt.localeCompare(b.landedAt) || a.key.localeCompare(b.key));
}

/**
 * The moments that open BY THEMSELVES on this visit: the ones this account has never seen (each host once — a gift
 * another host already claimed still plays, and then says "Claimed"). Oldest first.
 */
export function momentsToPlay(views: readonly GiftMomentView[], seen: (v: GiftMomentView) => boolean): GiftMomentView[] {
  return byLanded(views.filter((v) => !seen(v)));
}

/** The gifts that wait as a line until claimed — every unclaimed one, oldest first. */
export function momentsWaiting(views: readonly GiftMomentView[]): GiftMomentView[] {
  return byLanded(views.filter((v) => v.claimedAt === null));
}

/** "1 of 2" — only when more than one plays back to back. */
export function queueCounter(index: number, total: number): string | null {
  return total > 1 ? `${index + 1} of ${total}` : null;
}

/* ── the claim ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** What the Redeem button shows. `pressed` = "Claiming…", disabled; `offline` = "No connection — your gift is safe". */
export type ClaimState = 'idle' | 'pressed' | 'offline' | 'refused' | 'claimed';

/** The server's answer → the button. 'claimed' and 'already' are both the gift claimed: the same claim, never two. */
export function claimStateFrom(answer: unknown): ClaimState {
  const status = typeof answer === 'object' && answer !== null ? (answer as { status?: unknown }).status : undefined;
  if (status === 'claimed' || status === 'already') return 'claimed';
  if (status === 'refused') return 'refused';
  return 'offline';
}

export const CLAIM_WORDS = {
  redeem: 'Redeem',
  pressed: 'Claiming…',
  offline: 'No connection — your gift is safe. It stays here until it goes through.',
  retry: 'Try again',
  refused: 'This gift can’t be claimed from this account.',
  claimed: 'Claimed',
  later: 'Later',
  close: 'Close',
  open: 'Open',
  tapToOpen: 'Tap to open',
  noBadgeYet: 'No badge yet',
} as const;
