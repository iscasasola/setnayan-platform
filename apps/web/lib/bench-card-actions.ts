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

/** The subset of `ShortlistVendor` this resolver reads. Structural on purpose:
 *  the test fixtures stay small and a new card field can't silently join the
 *  decision without being declared here. */
export type BenchCardVendor = {
  status: 'considering' | 'locked';
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
  | { kind: 'schedule_clash'; clashWith: string | null };

/** Second action — stateful on thread EXISTENCE, never on a source heuristic. */
export type BenchInquiryAction =
  /** No live thread → open one (`contactShortlistVendor`). */
  | { kind: 'inquire' }
  /** A live thread exists → link straight to it. No server call, no transition. */
  | { kind: 'check'; threadId: string };

export type BenchCardActions = {
  build: BenchBuildAction | null;
  inquiry: BenchInquiryAction | null;
  /** Non-null ⇒ render the shipped `AccordionLockButton` for THIS group, so the
   *  conflict gate, date-lock modal, milestone toast and undo all carry. Null ⇒
   *  hide Lock entirely — NEVER pass a null group id into the lock button. */
  lockGroupId: string | null;
};

const NO_ACTIONS: BenchCardActions = { build: null, inquiry: null, lockGroupId: null };

/**
 * Which of the three actions does this card show?
 *
 * Rules, in the order they apply:
 *  1. Flag OFF → nothing (pre-replan render).
 *  2. Already LOCKED → nothing. The card's "★ Chosen" corner is the state; a
 *     second Lock, or an Add-to-build on a settled category, would both be
 *     lies. (Undo lives on the lock toast and the Build tab, which own it.)
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
 */
export function resolveBenchCardActions(args: {
  enabled: boolean;
  vendor: BenchCardVendor;
  /** Is this vendor pinned to the working build (`event_build_picks`)? */
  inBuild: boolean;
}): BenchCardActions {
  const { enabled, vendor, inBuild } = args;
  if (!enabled) return NO_ACTIONS;
  if (vendor.status === 'locked') return NO_ACTIONS;

  // Rule 5 — the SOFT schedule tier (PR-G1). A vendor already IN the build can
  // never be sunk by the window it helps define, so `inBuild` wins: the couple
  // keeps the Remove control that fixes the clash in the first place.
  const clashes = !inBuild && vendor.buildFit === 'clash';

  const build: BenchBuildAction | null =
    vendor.planGroupId == null
      ? null
      : clashes
        ? { kind: 'schedule_clash', clashWith: vendor.buildClashWith ?? null }
        : inBuild
          ? { kind: 'in_build' }
          : vendor.priceBasisPhp == null
            ? { kind: 'needs_price' }
            : { kind: 'add' };

  const inquiry: BenchInquiryAction | null =
    vendor.marketplaceVendorId == null
      ? null
      : hasLiveInquiry(vendor) && vendor.threadId != null
        ? { kind: 'check', threadId: vendor.threadId }
        : { kind: 'inquire' };

  // Lock is withheld on a clash for the same reason Add is — but the group id
  // is NOT forgotten anywhere else, so nothing downstream degrades.
  return { build, inquiry, lockGroupId: clashes ? null : vendor.planGroupId };
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
