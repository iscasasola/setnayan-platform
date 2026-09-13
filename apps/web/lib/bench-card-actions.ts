/**
 * bench-card-actions.ts — the PURE resolver behind the Explore bench's
 * three-action vendor card (Explore Replan slice D · spec §3 PR-D, §12.1).
 *
 * The card gained three actions: **＋ Add to build** (`event_build_picks`),
 * **Inquire / 💬 Check inquiry** (stateful on thread existence), and
 * **Lock this** (the shipped `AccordionLockButton`). Every one of them can be
 * WRONG in a way that costs the couple something — a build pick written to a
 * group Budget doesn't read, an "Inquire" that dead-ends on a vendor with no
 * marketplace profile, a Lock offered on an unbucketable category. So the
 * decision of WHICH actions a card shows lives here, as one pure function with
 * unit tests, and the component only renders the answer.
 *
 * Nothing in this module fetches, and nothing in it is React — it reads fields
 * `buildShortlistFolders` already put on `ShortlistVendor` from rows the page
 * already queried.
 *
 * FLAG: `enabled` is `isExploreReplanEnabled()`. OFF ⇒ every action is null and
 * the card renders byte-identically to pre-replan production.
 */

import { hasLiveInquiry } from '@/lib/shortlist-taxonomy';
import { isHardSinglePickGroup, type PlanGroupId } from '@/lib/wedding-plan-groups';
import type { LockRequestState } from '@/lib/lock-request-state';

/** The subset of `ShortlistVendor` this resolver reads. Structural on purpose:
 *  the test fixtures stay small and a new card field can't silently join the
 *  decision without being declared here. */
export type BenchCardVendor = {
  status: 'considering' | 'locked';
  /** PR-H · where the booking actually is. `'requested'` is the one that changes
   *  this resolver's answer; every other value behaves exactly as before, and
   *  the flag-off world is pinned to `'none'` upstream. */
  lockRequestState?: LockRequestState;
  marketplaceVendorId: string | null;
  threadId: string | null;
  inquiryStatus: string | null;
  planGroupId: string | null;
  priceBasisPhp: number | null;
  /** SOFT schedule-convergence verdict (PR-G1). `'clash'` = no free day left
   *  inside the build's shared-date window. Undefined / null = no verdict, and
   *  the card behaves exactly as it did before this tier existed. */
  buildFit?: 'fits' | 'clash' | null;
  buildClashWith?: string | null;
  /**
   * The HARD tier's input — the supplier's OWN calendar on the couple's
   * committed day (`getBatchVendorAvailableDays`, computed once per bench in
   * `vendors/page.tsx`). `'booked'` means their calendar shows that day taken.
   * Absent / null ⇒ no committed day or no calendar signal ⇒ no verdict, and a
   * calendar read error fails OPEN to `'free'` upstream, so it never sinks a
   * supplier falsely.
   */
  dateFit?: 'free' | 'booked' | null;
};

/** Primary action — the build pick. */
export type BenchBuildAction =
  /** "＋ Add to build" — `setBuildPick`. In a hard-single group this SWAPS the
   *  category's existing candidate (`replacesSiblingsOnPin` decides, server-side). */
  | { kind: 'add' }
  /** "◕ In your build" + Remove — `removeBuildPick` (vendor-scoped, so a
   *  multi-pick category never loses its other picks). */
  | { kind: 'in_build' }
  /** No price signal ANYWHERE — neither a quote nor the marketplace "starts at".
   *  Pinning would contribute ₱0 to the budget, which is the exact failure the
   *  shipped owner rule (2026-06-09, "only services vendors responded a price
   *  for") exists to prevent. The card shows a quiet note instead of a CTA. */
  | { kind: 'needs_price' }
  /** SOFT schedule clash (Explore Replan PR-G1 · spec §6 decision #12): this
   *  vendor has no free day left inside the build's shared-date window. Adding
   *  or locking them would knowingly create a date the couple's own team cannot
   *  all make, so both are withheld — but REVERSIBLY and with the reason named,
   *  and the Inquire leg stays live ("Ask anyway", decision #3). Never a HARD
   *  block: the couple removes the clashing candidate and the card is back. */
  | { kind: 'schedule_clash'; clashWith: string | null }
  /** HARD tier — Explore Replan PR-G2, built 2026-09-11 on the owner's
   *  *"they shouldn't even be shown as planned based on their schedule
   *  availability."* The supplier's own calendar shows the couple's committed
   *  day taken. Add and Lock are withheld; the conversation leg survives ("Ask
   *  anyway", decision #3); nothing is removed. Unlike the SOFT clash, a card
   *  ALREADY IN THE BUILD is not exempt — it did not define the date, it just
   *  cannot make it — so `inBuild` keeps its Remove, the one control that fixes
   *  it. */
  | { kind: 'not_available'; inBuild: boolean };

/**
 * Why Lock is absent, when nothing else on the card already says so.
 *
 * Owner 2026-09-11: *"hide lock, say why."* Both reasons are READ, never
 * inferred — each is a `chat_threads.inquiry_status` value:
 *  • `inquiry_declined` — the supplier turned down the couple's inquiry. The
 *    decline form sends no reason, so the card says exactly that and no more;
 *    it never claims "not free on your date" it cannot know. (The supplier's
 *    optional won/lost reason, e.g. `lost_availability`, is THEIR private
 *    record and is deliberately not read here.)
 *  • `slot_taken` — `displaced`: another booking filled the slot the couple
 *    asked about. Revivable upstream; this reads the live value.
 * ⚖ A declined LOCK REQUEST (`lockRequestState === 'declined'`) is NOT here —
 * the owner kept Lock after that kind of no, because they may be asked again.
 */
export type LockWithheldReason = 'inquiry_declined' | 'slot_taken';

/** Second action — stateful on thread EXISTENCE, never on a source heuristic. */
export type BenchInquiryAction =
  /** No live thread → open one (`contactShortlistVendor`). */
  | { kind: 'inquire' }
  /** A live thread exists → link straight to it. No server call, no transition. */
  | { kind: 'check'; threadId: string };

/** Third action, PR-H · slice B. Present ONLY while an ask is outstanding. */
export type BenchWithdrawAction = { kind: 'withdraw' };

export type BenchCardActions = {
  build: BenchBuildAction | null;
  /**
   * The plan group the BUILD slot acts on (Add · Remove). Non-null exactly when
   * `build` is non-null.
   *
   * 🔴 SEPARATE FROM `lockGroupId`, AND IT HAD TO BE. Until 2026-09-11 the card
   * drew its whole build slot only when `lockGroupId` was set — but this
   * resolver deliberately NULLS `lockGroupId` on a schedule clash to hide Lock.
   * So the SOFT tier's "Doesn't fit your build · Remove X to free a date" note
   * could never render: a clashing card showed only its dim and its divider,
   * with no reason. The tests checked this function and never the card's
   * condition, so nothing noticed. One id per job now.
   */
  buildGroupId: string | null;
  inquiry: BenchInquiryAction | null;
  /** Non-null ⇒ the couple has asked and nobody has answered. The card says so
   *  and offers to take the ask back (`withdrawVendorLockRequest`). Null in
   *  every other state, including the whole flag-off world. */
  withdraw: BenchWithdrawAction | null;
  /** Non-null ⇒ render the shipped `AccordionLockButton` for THIS group, so the
   *  conflict gate, date-lock modal, milestone toast and undo all carry. Null ⇒
   *  hide Lock entirely — NEVER pass a null group id into the lock button. */
  lockGroupId: string | null;
  /** Non-null ⇒ Lock is absent for a reason the card must name. */
  lockWithheld: LockWithheldReason | null;
};

const NO_ACTIONS: BenchCardActions = {
  build: null,
  buildGroupId: null,
  inquiry: null,
  withdraw: null,
  lockGroupId: null,
  lockWithheld: null,
};

/**
 * 🔑 THE ONE DEFINITION OF "NOT AVAILABLE ON YOUR DATE" (the HARD tier).
 *
 * The resolver, the rail's sink and the Picks column's "ready to lock" list all
 * ask THIS, so they cannot disagree about which supplier is out of the running.
 *
 *  • LOCKED is never unavailable: a supplier the couple booked has that day
 *    blocked BY THE COUPLE'S OWN BOOKING (the auto-block fires at
 *    `deposit_paid`), so their calendar reads "booked" for exactly the wrong
 *    reason.
 *  • An OUTSTANDING ASK is left to rule 6 — the couple is waiting on an answer,
 *    and "take the ask back" is the control they need, not a sink.
 *  • Only a pending or accepted inquiry can't block the date (only a paid
 *    deposit writes a calendar block), so the couple's own interest can never
 *    make their supplier read as busy.
 */
export function isUnavailableOnDate(
  enabled: boolean,
  vendor: Pick<BenchCardVendor, 'status' | 'lockRequestState' | 'dateFit'>,
): boolean {
  return (
    enabled &&
    vendor.status !== 'locked' &&
    vendor.lockRequestState !== 'requested' &&
    vendor.dateFit === 'booked'
  );
}

/**
 * Which of the three actions does this card show?
 *
 * Rules, in the order they apply:
 *  1. Flag OFF → nothing (pre-replan render).
 *  2. Already LOCKED → no BUILD and no LOCK. The card's "★ Chosen" corner is
 *     the state; a second Lock, or an Add-to-build on a settled category, would
 *     both be lies. (Undo lives on the lock toast and the Build tab, which own
 *     it.)
 *     🔴 THE INQUIRY LEG SURVIVES, AND UNTIL 2026-09-09 IT DID NOT. This rule
 *     returned NO_ACTIONS — every leg — while the reasoning above it justifies
 *     withholding exactly two. The consequence was silent and backwards: a
 *     couple could not open a conversation from the bench with the ONE supplier
 *     they had actually booked, which is the card most likely to have something
 *     waiting on them. Rules 5 and 6 below had already made this same argument
 *     for their own cases ("and ONLY those", "INQUIRY SURVIVES"); rule 2 simply
 *     never had it applied. A settled booking is not a finished conversation.
 *  3. Build + Lock require a resolvable plan group — `planGroupForCategory`
 *     returns null for a category no group claims, and both `setBuildPick` and
 *     `AccordionLockButton` require a real group id.
 *  4. Inquiry requires `marketplaceVendorId` — the ONLY correct gate. A LINKED
 *     manual add carries one and IS messageable; an off-platform pick does not
 *     and would hit `not_marketplace` ("This vendor can't be messaged here").
 *  5. A SOFT schedule clash (PR-G1) withholds Add-to-build and Lock — and ONLY
 *     those. The inquiry leg survives ("Ask anyway"), because a date the couple
 *     can still change is a conversation, not a wall. A vendor already in the
 *     build is exempt: it helped DEFINE the window, and it keeps its Remove.
 *  6. PR-H · AN OUTSTANDING ASK REPLACES LOCK WITH WITHDRAW. Under the handshake
 *     the couple's Lock only ASKS, and the row stays 'considering' — so rule 2
 *     does not fire and the card would have gone on offering Lock to a couple
 *     who had already pressed it, on a supplier already sitting on the request.
 *     Pressing it again is not harmless: the DB's one-pending-request-per-group
 *     unique index rejects the second write, and the couple meets an error for
 *     doing the only thing the screen offered. Build is withheld for the same
 *     reason as rule 2 (the category is no longer open), and INQUIRY SURVIVES —
 *     a couple waiting on an answer is exactly who most needs to send a message.
 *  7. HARD tier (PR-G2 · owner 2026-09-11) — the supplier's calendar shows the
 *     committed day taken (`isUnavailableOnDate`): Add and Lock stand down, the
 *     inquiry leg survives, an in-build card keeps Remove. It BEATS the soft
 *     tier — a supplier who cannot make the date does not need to be told the
 *     build's window is narrow.
 *  8. "HIDE LOCK, SAY WHY" (owner 2026-09-11) — an inquiry the supplier
 *     declined, or a slot another booking took, withholds Lock and names the
 *     reason (`lockWithheld`). Add-to-build is untouched: the ruling hid Lock,
 *     and a declined supplier can still be a price in the couple's plan.
 */
export function resolveBenchCardActions(args: {
  enabled: boolean;
  vendor: BenchCardVendor;
  /** Is this vendor pinned to the working build (`event_build_picks`)? */
  inBuild: boolean;
}): BenchCardActions {
  const { enabled, vendor, inBuild } = args;
  if (!enabled) return NO_ACTIONS;

  // Resolved BEFORE rule 2 so the locked branch and the ordinary one share ONE
  // definition of "can this supplier be messaged, and is there a thread yet".
  // Two copies would be two chances for a locked card to answer it differently.
  const inquiry: BenchInquiryAction | null =
    vendor.marketplaceVendorId == null
      ? null
      : hasLiveInquiry(vendor) && vendor.threadId != null
        ? { kind: 'check', threadId: vendor.threadId }
        : { kind: 'inquire' };

  // Rule 2 — booked. No build, no lock, and the conversation stays open.
  if (vendor.status === 'locked') {
    return {
      build: null,
      buildGroupId: null,
      inquiry,
      withdraw: null,
      lockGroupId: null,
      lockWithheld: null,
    };
  }

  // Rule 6 — the ask is outstanding. Resolved BEFORE the build/lock legs so
  // neither can be handed a group id: withholding them later would leave two
  // places that have to remember, which is how the coverage strip and the bench
  // disagreed about the same category once already.
  const awaitingAnswer = vendor.lockRequestState === 'requested';

  // Rule 5 — the SOFT schedule tier (PR-G1). A vendor already IN the build can
  // never be sunk by the window it helps define, so `inBuild` wins: the couple
  // keeps the Remove control that fixes the clash in the first place.
  const clashes = !inBuild && vendor.buildFit === 'clash';

  // Rule 7 — the HARD tier. One predicate, shared with the sink and the Picks
  // column (see `isUnavailableOnDate`). It already excludes rule 6's case.
  const unavailable = isUnavailableOnDate(enabled, vendor);

  const build: BenchBuildAction | null =
    vendor.planGroupId == null
      ? null
      : unavailable
        ? { kind: 'not_available', inBuild }
        : clashes
          ? { kind: 'schedule_clash', clashWith: vendor.buildClashWith ?? null }
          : inBuild
            ? { kind: 'in_build' }
            : vendor.priceBasisPhp == null
              ? { kind: 'needs_price' }
              : { kind: 'add' };

  // Rule 8 — read, never inferred. Only when nothing else on the card already
  // explains why Lock is missing: a waiting ask has its own row, and a HARD or
  // SOFT verdict names its own reason in the build slot.
  const lockWithheld: LockWithheldReason | null =
    awaitingAnswer || unavailable || clashes || vendor.planGroupId == null
      ? null
      : vendor.inquiryStatus === 'declined'
        ? 'inquiry_declined'
        : vendor.inquiryStatus === 'displaced'
          ? 'slot_taken'
          : null;

  const shownBuild = awaitingAnswer ? null : build;
  return {
    build: shownBuild,
    buildGroupId: shownBuild ? vendor.planGroupId : null,
    inquiry,
    withdraw: awaitingAnswer ? { kind: 'withdraw' } : null,
    lockGroupId:
      awaitingAnswer || clashes || unavailable || lockWithheld ? null : vendor.planGroupId,
    lockWithheld,
  };
}

/**
 * Does this category's rail end with "＋ Add another {label}" instead of the
 * cold-start "Find more"?
 *
 * The affordance shipped in #3789 on the LEGACY accordion only; slice D carries
 * it to the live bench. It appears once the category HAS a lock and the group
 * still allows more picks — the "at least 1 is the floor, not the ceiling"
 * decision. A hard-single group (venue · officiant · coordinator · host ·
 * LED) is done at one, so it keeps "Find more" and never invites a second.
 *
 * `planGroupId` here is the TILE's group (the category the couple is looking
 * at), not a vendor's — the question is about the category, not a card.
 */
export function railEndIsAddAnother(args: {
  enabled: boolean;
  lockedCount: number;
  planGroupId: string | null;
}): boolean {
  if (!args.enabled) return false;
  if (args.lockedCount <= 0) return false;
  if (args.planGroupId == null) return false;
  return !isHardSinglePickGroup(args.planGroupId as PlanGroupId);
}

/** Why a build pick cannot be locked right now — for surfaces OTHER than the
 *  card (the Picks column's "ready to lock" list). */
export type BlockedLockReason = 'not_available' | LockWithheldReason;

/**
 * Read the card's own answer back as a single reason, so the Picks column's
 * "Lock to confirm" and the card's Lock can never disagree about the same
 * supplier. Null ⇒ nothing blocks the lock (or the resolver offers none for a
 * reason the Picks column already handles: locked, or an ask outstanding).
 */
export function blockedLockReason(actions: BenchCardActions): BlockedLockReason | null {
  if (actions.build?.kind === 'not_available') return 'not_available';
  return actions.lockWithheld;
}

