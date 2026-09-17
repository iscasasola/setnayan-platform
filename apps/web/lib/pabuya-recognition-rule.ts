import { isHostMemberType } from '@/app/[slug]/_lib/host-scope';

/**
 * lib/pabuya-recognition-rule.ts — DOES THIS CELEBRATION RECOGNISE THE READER?
 * The decision, alone. PURE: no I/O, no `server-only`, so a test EXECUTES it.
 *
 * ⚖ OWNER RULING 2026-09-15, twice — "gate the account number", then "gate the
 * wallet handles too." An unrecognised reader learns THAT a rail is accepted
 * and WHICH one; the handle and any QR are for a reader the event recognises.
 *
 * ── WHY THIS FILE EXISTS SEPARATELY FROM pabuya-recognition.ts ─────────────
 * That module is `import 'server-only'`, so nothing can import it — and the
 * three tests that referenced it were `assert.match` over its own SOURCE TEXT.
 * A rename inside the function passed every one of them. The rule the owner
 * gave twice, protecting bank account numbers, was held by regexes over prose.
 *
 * 🔑 THE REPO ALREADY KNEW THE ANSWER. `pabuya-qr-verdict.ts` is pure with a
 * `.server.ts` sibling doing the I/O, for exactly this reason. This is the same
 * split applied to the gate itself: the I/O (read the cookie, read the member
 * row) stays in `pabuya-recognition.ts`; the DECISION lives here and is run.
 *
 * ⚠ THE SHAPE OF THE INPUT IS THE WHOLE LESSON. `memberType` is the member
 * row's raw string — NOT a `hasRow` boolean. `app/[slug]/_lib/host-scope.ts`
 * records the regression: a `guest`-typed member row once waved somebody into a
 * private site because membership was tested for EXISTENCE and never compared.
 * Passing a boolean in here would re-create that bug one layer up, where no
 * test could see it, and the caller would look correct.
 */

export type RecognitionFacts = {
  /** `event_id` on the guest-session cookie, or null when there is no session. */
  guestSessionEventId: string | null;
  /** The event being read. */
  eventId: string;
  /** `event_members.member_type` for the signed-in user, or null (no user, no row). */
  memberType: string | null;
  /**
   * Does the platform already consider this user a HOST of this event?
   *
   * ⚠ NOT a `Boolean(row)`. This is the answer from `userHostsEvent` — the
   * shared definition the dashboard and the QR route already use, which
   * requires an `event_members` couple row OR an `event_moderators` row that is
   * ACCEPTED, not removed, and in a primary host role. Passing that decision in
   * rather than re-deriving it here is what keeps the two doors agreeing.
   */
  hostsEvent: boolean;
};

/**
 * TRUE when this celebration recognises the reader.
 *
 * THREE arms (the third added 2026-09-17 by owner ruling):
 *   · a guest session for THIS event — she opened her own invitation link or
 *     scanned her QR on this device; or
 *   · a signed-in member whose `event_members` type is a HOST type
 *     (couple · coordinator); or
 *   · a user the platform already calls a host of this event — which is how an
 *     accepted MODERATOR is recognised on their own celebration.
 *
 * ⚠ Somebody the couple forwarded the link to is a PASSER-BY, deliberately.
 * Holding the link is how a relative abroad reaches the page at all; it is not
 * how they earn the account number.
 */
export function viewerIsRecognised(facts: RecognitionFacts): boolean {
  // A session for ANOTHER event must never pass — the comparison, not the
  // presence, is the check.
  if (facts.guestSessionEventId !== null && facts.guestSessionEventId === facts.eventId) {
    return true;
  }
  // An `event_members` host row: couple or coordinator.
  if (isHostMemberType(facts.memberType)) return true;
  /*
    ⚖ OWNER RULING 2026-09-17 — AN ACCEPTED MODERATOR IS A CO-HOST AND IS
    RECOGNISED ON THEIR OWN CELEBRATION.

    Two definitions of "host" had diverged: the dashboard and the QR route
    called an accepted moderator a host (`userHostsEvent`), while this rule saw
    only `event_members`. A co-host invited that way therefore opened their own
    event's gift page and was told "payment details are shown to invited
    guests" — the product contradicting itself about who they are.

    🔑 THIS IS NOT A WIDENING TO STRANGERS. It admits exactly the people the
    platform already treats as hosts, and it CONVERGES the two doors rather
    than adding a third answer. Asked before acting, because it is still a
    disclosure change: measured 2026-09-17, 6 accepted moderators, 0 of them
    without a host member row — so nobody was affected yet and this is the
    cheapest possible moment to agree the rule.
  */
  return facts.hostsEvent;
}
