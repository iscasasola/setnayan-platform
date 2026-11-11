/**
 * lib/locks.ts — 🔒 EVERY LOCK, IN ONE PLACE (Build 5 · Lane B; owner 10 Nov 2026: *"we do not hide it … show a lock …
 * tapping it will explain what is there"* → *"like showing a solution. What problem? and what solution"* → *"always show
 * the Problem and Solution"*; DECISION_LOG 2026-11-09/10 "EVERY LOCK ALWAYS SHOWS THE PROBLEM AND THE SOLUTION — APP-WIDE"
 * + "FREE (UNVERIFIED) SHOP — THE COMPLETE LIMITS"; HOUSE_TEMPLATES T30; corpus
 * `plans/free_unverified_limits_2026-11-10/00-FREE-UNVERIFIED-LIMITS.md` §10–11).
 *
 * The ONE registry the shared lock part (`app/_components/lock/locked-feature.tsx`) reads, and the ONE place that decides
 * whether a shop may use a gated feature (`canUse`). A lock with no Problem or no Solution line cannot be written here —
 * the type requires both, and `lib/locks.test.ts` refuses an empty one.
 *
 *   · The Problem / Solution lines are the corpus table's (§11, "draft copy; the owner may edit"). Lines marked
 *     `draft: true` are not in that table yet — the owner reads them in the PR before they ship.
 *   · `opens` says what lifts the lock: `verified` (the four papers + the call) or a plan (`solo` · `pro` · `enterprise`).
 *     EVERY verify lock lifts the moment the shop is Verified (§10 🔑).
 *   · `server` names the server gate that enforces it, or null while only the UI shows it. 🔑 A UI-only lock is a bug
 *     (Lane B "Done when"): the null ones are the work still to wire, listed by the guard so the list can only shrink.
 *
 * PURE: no I/O. 🔒 lib/locks.test.ts
 */
import { formatCount } from './format-number';
import { asVendorTier, isTierAtLeast, type VendorTier } from './vendor-tier-caps';

export type LockOpens = 'verified' | Exclude<VendorTier, 'free' | 'verified'>;

export type LockDef = {
  /** The feature's real name — shown on the locked row, never hidden. */
  name: string;
  /** THE PROBLEM — one line naming the pain the shop already has. */
  problem: string;
  /** THE SOLUTION — one line on how this feature solves it. */
  solution: string;
  /** What lifts the lock. */
  opens: LockOpens;
  /** The server file that refuses it (repo path under apps/web), or null while the gate is UI-only. */
  server: string | null;
  /** True when the lines are not in the corpus §11 table yet (the owner edits them in the PR). */
  draft?: boolean;
};

export const LOCKS = {
  quotation: {
    name: 'Quotation',
    problem: 'Prices typed in chat get lost and argued about.',
    solution: 'A quote card with every line, the total and the due date. The couple accepts it in one tap.',
    opens: 'verified',
    server: null,
  },
  payment: {
    name: 'Payment',
    problem: 'Chasing deposits and checking transfer screenshots.',
    solution: 'Payment requests the couple pays, tracked for both of you.',
    opens: 'verified',
    server: null,
  },
  forms: {
    name: 'Forms',
    problem: 'Asking the same questions in every chat.',
    solution: 'Send one form; the answers stay on the event.',
    opens: 'verified',
    server: null,
  },
  offerMaker: {
    name: 'Offer Maker',
    problem: 'Slow months and empty dates.',
    solution: 'An offer couples see that fills those dates.',
    opens: 'verified',
    // Build 6 Lane D: every Offer Maker write asks `canUse('offerMaker')` first.
    server: 'app/vendor-dashboard/offers/actions.ts',
  },
  bundleMaker: {
    name: 'Bundle Maker',
    problem: 'Couples book one service and skip the rest.',
    solution: 'Several services at one price.',
    opens: 'verified',
    // 🔒 Build 6 Lane D: `savePackage` asks `canUse('bundleMaker')` before it prices or writes a bundle.
    server: 'app/vendor-dashboard/packages/actions.ts',
  },
  promote: {
    name: 'Promote',
    problem: 'People at your booth walk away and forget you.',
    solution: 'Printed QR standees, banners and stickers that open your page.',
    opens: 'verified',
    server: null,
  },
  analytics: {
    name: 'Analytics',
    problem: 'You can’t tell what sells or why couples leave.',
    solution: 'See what couples view, ask about and book.',
    opens: 'verified',
    server: null,
  },
  teamSeats: {
    name: 'Team seats',
    problem: 'Only you can answer clients.',
    solution: 'Add your staff to chats and events.',
    opens: 'verified',
    server: null,
  },
  beingFound: {
    name: 'Being found',
    problem: 'Couples can’t find you anymore.',
    solution: 'Verified shops always show in search and Find.',
    opens: 'verified',
    server: null,
  },
  reviews: {
    name: 'Reviews',
    problem: 'New couples can’t see what past clients said.',
    solution: 'Your reviews show on your page.',
    opens: 'verified',
    server: null,
  },
  liveCards: {
    name: 'More live cards',
    problem: 'Couples see only part of what you do.',
    solution: 'Show every service and all your work.',
    opens: 'verified',
    server: null,
  },
  portfolio: {
    name: 'More portfolio photos',
    problem: 'Couples see only part of what you do.',
    solution: 'Show every service and all your work.',
    opens: 'verified',
    server: null,
  },
  // 🔒 Solo · Pro · Ultra open once Verified (2026-11-04) — refused by `create_vendor_subscription` (NOT_VERIFIED),
  // which `startSubscriptionPurchase` calls and words.
  plans: {
    name: 'Solo · Pro · Ultra',
    problem: 'Your plan caps how many cards, dates and helpers you can take on.',
    solution: 'A bigger plan takes more of each — it opens once Setnayan approves your shop.',
    opens: 'verified',
    server: 'app/vendor-dashboard/subscription/actions.ts',
    draft: true,
  },
} as const satisfies Record<string, LockDef>;

export type LockKey = keyof typeof LOCKS;
export const LOCK_KEYS = Object.keys(LOCKS) as LockKey[];

export type LockShop = { verified: boolean; tier: string | null | undefined };

export type CanUse = { ok: true } | { ok: false; needs: 'verify' } | { ok: false; needs: 'plan'; plan: LockOpens };

/**
 * May this shop use this feature? The ONE decision behind every lock — the server gate and the lock row ask the same
 * question, so the row can never say "open" where the server refuses (or the reverse).
 */
export function canUse(key: LockKey, shop: LockShop): CanUse {
  const def: LockDef = LOCKS[key];
  if (def.opens === 'verified') return shop.verified ? { ok: true } : { ok: false, needs: 'verify' };
  // A plan lock still needs a Verified shop — no paid plan opens before the papers (2026-11-04).
  if (!shop.verified) return { ok: false, needs: 'verify' };
  return isTierAtLeast(asVendorTier(shop.tier), def.opens) ? { ok: true } : { ok: false, needs: 'plan', plan: def.opens };
}

/** "2 of 4 papers in · then a short call" — the verify lock's progress, from the shipped four-paper count. */
export function papersProgress(input: { done: number; of: number } | null): string {
  if (!input) return 'Couldn’t read your papers — open Get verified to see them';
  if (input.done >= input.of) return `All ${formatCount(input.of)} papers in · Setnayan checks them, then a short call`;
  return `${formatCount(input.done)} of ${formatCount(input.of)} papers in · then a short call`;
}
