import {
  openToStrangers,
  requiresInvitedAccount,
  type EventVisibility,
} from '@/lib/event-visibility';

/**
 * WHO MAY READ A CELEBRATION THAT IS NOT OPEN TO STRANGERS — the DECISION,
 * with no database attached.
 *
 * ── WHY THIS MODULE EXISTS ─────────────────────────────────────────────────
 * That question was answered TWICE, in two files, from the same five facts:
 * `app/[slug]/page.tsx` decided it inline for its own lock screen, and
 * `lib/slug-access.ts` (`canViewSlugEvent`) decided it for the seven
 * sub-routes — the venue page, the recap, both seat finders, the live hub, the
 * money-gift page and the print keepsake.
 *
 * 🔴 AND THE TWO COPIES DISAGREED. The page grew a fifth way in on 2026-08-17
 * — a supplier the couple has BOOKED — and the shared gate never did. So a
 * booked photographer could open the couple's private page and was bounced off
 * every single sub-route of it: no venue address, no recap, no seat finder, no
 * live hub. The refusal is silent by design (it is byte-identical to what a
 * stranger gets), so nothing anywhere reported it.
 *
 * 🔑 A TEST THAT THE TWO AGREE IS WEAKER THAN ONE RULE. `slug-access.ts` is
 * `server-only`, which in this repo cannot be imported by a `node:test` file at
 * all, and the page's copy lives inside a 1,000-line server component — so
 * "feed one fixture to both gates" is not a test that can be written here. The
 * two gates now share this function instead, and agreement is structural: the
 * only thing each side still owns is how it resolves its own FACTS.
 *
 * ⚖ EVERY ARM IS A CLAIM SOMEBODY PROVED. Nothing here is derived from the
 * request — no header, no query string, no cookie value that has not already
 * been checked against this event id by the caller.
 */

/**
 * The five facts, each resolved by the surface that knows how. A caller that
 * establishes nothing gets the safest answer: a stranger.
 *
 * ⚠ Callers resolve these LAZILY and stop at the first `true` — the rule is an
 * OR, so an unasked question stays `false` and cannot change the answer. Do not
 * read a `false` here as "we checked and it is not so".
 */
export type ClosedEventFacts = {
  /** A redeemed invitation for THIS event, on this device (the guest cookie). */
  holdsGuestPass: boolean;
  /** Signed in as a host: a couple/coordinator member, or an accepted moderator. */
  isSignedInHost: boolean;
  /** Signed in on an account BOUND to a seat on this event's guest list. */
  isSeatHolder: boolean;
  /**
   * Signed in and owns a person the hosts put on the guest list, having
   * redeemed nothing. 🔒 Counts on 'invited_accounts' ONLY — see below.
   */
  isInvitedAccount: boolean;
  /** Signed in as a supplier this couple has BOOKED on this event. */
  isBookedSupplier: boolean;
};

/** Nothing established. The answer for a stranger, and the safe default. */
export const NO_CLAIM: ClosedEventFacts = {
  holdsGuestPass: false,
  isSignedInHost: false,
  isSeatHolder: false,
  isInvitedAccount: false,
  isBookedSupplier: false,
};

/**
 * May this viewer read this celebration?
 *
 * 🔒 THE INVITED-ACCOUNT ARM IS DELIBERATELY NOT TOTAL. 'private' has always
 * meant the hosts plus a redeemed invitation; being *on the list* is what
 * 'invited_accounts' added on 2026-08-15. Honouring `isInvitedAccount` on
 * 'private' would quietly change a promise a couple already made to themselves,
 * so the visibility — not only the fact — has to allow it.
 *
 * 🔴 IT ASKS `openToStrangers`, NEVER `!== 'private'`. That exclusion spelling
 * is what once made 'invited_accounts' fully public across 31 call sites the
 * day the value was added. A visibility added later is CLOSED here until
 * somebody opens it in `event-visibility.ts` on purpose.
 */
export function closedEventAdmits(
  visibility: EventVisibility,
  facts: ClosedEventFacts = NO_CLAIM,
): boolean {
  if (openToStrangers(visibility)) return true;
  if (facts.holdsGuestPass) return true;
  if (facts.isSignedInHost) return true;
  if (facts.isSeatHolder) return true;
  if (facts.isBookedSupplier) return true;
  if (requiresInvitedAccount(visibility)) return facts.isInvitedAccount;
  return false;
}
