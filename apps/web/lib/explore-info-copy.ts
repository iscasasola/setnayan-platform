/**
 * explore-info-copy.ts — EVERY ⓘ copy string on the Explore bench, in one place.
 *
 * Contract: `Explore_Replan_BUILD_SPEC_2026-07-27.md` **§11 · The ⓘ pattern —
 * documentation contract** (owner: "make sure (i) is well documented"):
 *
 *  1. The **page-level ⓘ** beside the Explore title replaces ALL explanatory
 *     chrome. Its panel must cover: what the page does · the state-glyph legend
 *     · the lock handshake in one line · what the Coverage Strip means.
 *  2. **Per-category ⓘ** resolves to the plan-group `hint`
 *     (`lib/wedding-plan-groups.ts`) through the tile→group bridge in
 *     `lib/coverage-strip.ts`. Tile-level overrides get authored in the Taxonomy
 *     Studio later — that becomes the single editing home for that copy. (PR-C
 *     ships the per-category button; the resolver lives here already so the copy
 *     never lands in JSX.)
 *  3. **No ⓘ copy string may live inline in JSX** — a copy edit must stay a
 *     one-file PR, and the corpus mirrors this module.
 *  4. **Corpus mirror:** the shipped texts get a dated reference doc in
 *     `Design_Explore_Replan_2026-07-27/` on first landing and on any change, so
 *     documented copy and live copy cannot silently diverge.
 *  5. Accessibility is the caller's job: a real `<button>` with an aria-label, a
 *     visible focus ring, a dismissible panel, and **no persistence** — the
 *     panel always starts closed, because it is help, not a setting.
 *
 * ⚠ The lock-handshake line must describe WHAT THE CODE DOES, not what §7 wants
 * it to do. It spent months describing the target — "you request the lock, the
 * vendor agrees" — while `finalizeVendor` booked the vendor outright and told
 * them afterwards. Corrected 2026-08-15; see the const's own docblock.
 * 🔑 Copy is not a plan. A sentence describing an unbuilt step is a promise the
 * product breaks every time someone reads it. When PR-H ships step 2, flip this
 * line as a function of the flag — never ahead of the flag.
 * Update the line HERE — not in the components.
 */

import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { COVERAGE_GLYPH, planGroupsForTile, type CoverageState } from '@/lib/coverage-strip';

/** aria-label + tooltip for the page-level ⓘ toggle. */
export const EXPLORE_INFO_BUTTON_LABEL = 'About this page';

/** Heading inside the page-level ⓘ panel. */
export const EXPLORE_INFO_TITLE = 'How Explore works';

/** §11.1 — what this page does. */
export const EXPLORE_INFO_WHAT =
  'Browse every service your event needs: open a folder, open a category, and its vendors appear as a carousel. Nothing here is committed — shortlisting, comparing and inquiring are all free.';

/**
 * §11.1 — what the Coverage Strip means. Names the strip "your event" to match
 * `ADD_TO_PLAN_HEADING` below: the chip pool adds INTO this strip, so the two
 * must call the container the same thing or the panel explains a noun the
 * button never uses.
 */
export const EXPLORE_INFO_STRIP =
  'The strip at the top is your event, one tile per category you chose during onboarding. It is ordered by what needs deciding soonest, categories you are done with sink to the right, and NEXT marks the one to pick up now.';

/**
 * §11.1 — what locking actually does, one line (spec §7).
 *
 * 🔴 THIS LINE DESCRIBES TODAY, NOT THE TARGET. It previously read "you request
 * the lock, the vendor agrees, …" — describing the §7 handshake. Steps 1, 3, 4
 * and 5 of that handshake ship; **step 2 does not exist**. `finalizeVendor`
 * writes `status='contracted'` outright and the vendor is TOLD, never ASKED
 * (`emitNotification('booking_confirmed')`, "You have a new confirmed booking").
 * So the sentence promised a veto no vendor has ever been offered, on the one
 * screen that exists to explain the mechanism.
 *
 * What is kept is what is TRUE today: the couple pays the vendor directly,
 * off-platform, and the date is reserved on the vendor's calendar only at
 * `acknowledge_vendor_deposit` (which is what calls `acquireSchedulePoolsForBooking`).
 *
 * ⚠ WHEN PR-H SHIPS, THIS FLIPS BACK — but as a function of the flag, not a
 * constant: `exploreInfoHandshake(handshakeEnabled)`, ON = the handshake
 * sentence (true at last), OFF = this one. Both branches pinned in
 * `explore-info-copy.test.ts`. Do not restore the promise ahead of the step.
 */
export const EXPLORE_INFO_HANDSHAKE =
  'Locking books this vendor and tells them straight away. You then pay them directly and send the receipt — once they accept it, your date is reserved on their calendar.';

/**
 * §11.1 — the state-glyph legend, in journey order. Glyphs come from
 * `COVERAGE_GLYPH` (the map the strip itself renders from) so the documented
 * legend and the live tiles cannot drift. 'skipped' has no strip tile — it is a
 * tile-level exclusion (PR-C) — so it carries its glyph inline.
 */
export const EXPLORE_STATE_LEGEND: ReadonlyArray<{
  state: CoverageState | 'skipped';
  glyph: string;
  label: string;
  meaning: string;
}> = [
  { state: 'empty', glyph: COVERAGE_GLYPH.empty, label: 'Not started', meaning: 'nothing shortlisted here yet' },
  { state: 'exploring', glyph: COVERAGE_GLYPH.exploring, label: 'Exploring', meaning: 'you have vendors on the bench' },
  { state: 'picked', glyph: COVERAGE_GLYPH.picked, label: 'In your build', meaning: 'a candidate is pinned to your team' },
  { state: 'locked', glyph: COVERAGE_GLYPH.locked, label: 'Locked', meaning: 'a booking is under way or done' },
  { state: 'covered', glyph: COVERAGE_GLYPH.covered, label: 'Covered', meaning: 'you told us you are done with this one' },
  { state: 'skipped', glyph: '–', label: 'Skipped', meaning: 'not needed for your event' },
];

/** Header label above the strip. */
export const COVERAGE_STRIP_HEADING = 'Cover your event';

/** "Covered 3 of 9" — the strip's count line + the progress ring's aria-label. */
export function coverageCountLabel(covered: number, total: number): string {
  return `Covered ${covered} of ${total}`;
}

/** The NEXT flag's text + the screen-reader suffix on the tile it marks. */
export const COVERAGE_NEXT_FLAG = 'NEXT';
export const COVERAGE_NEXT_SR = 'next to decide';

/** Per-tile aria-label: "Catering — exploring, 2 shortlisted. Open." */
export function coverageTileLabel(args: {
  label: string;
  state: CoverageState;
  vendorCount: number;
  lockedCount: number;
  buildCount: number;
  isNext: boolean;
}): string {
  const state =
    args.state === 'covered'
      ? 'covered'
      : args.state === 'locked'
        ? `${args.lockedCount} locked`
        : args.state === 'picked'
          ? `${args.buildCount} in your build`
          : args.state === 'exploring'
            ? `${args.vendorCount} shortlisted`
            : 'not started';
  return `${args.label} — ${state}${args.isNext ? `, ${COVERAGE_NEXT_SR}` : ''}`;
}

/** Folder-head summary pills (§11 applies to their tooltips too). */
export const FOLDER_SUMMARY_LOCKED = (n: number) => `● ${n} locked`;
export const FOLDER_SUMMARY_TO_DECIDE = (n: number) => `${n} to decide`;
export const FOLDER_SUMMARY_MORE = (n: number) => `＋${n} more`;
export const FOLDER_SUMMARY_ALL_COVERED = '✓ All covered';

/**
 * §11.2 — the per-category ⓘ text: the `hint` of the plan group that claims this
 * tile. The bridge is many-to-one (see `coverage-strip.ts`), so the FIRST group
 * in `PLAN_GROUPS` order wins — a deterministic pick, not an arbitrary one.
 * Null when the tile is finer than the plan-group set; callers then hide the ⓘ
 * rather than invent copy. Tile-level overrides arrive with the Taxonomy Studio.
 */
export function categoryHintForTile(tile: string): string | null {
  const groups = planGroupsForTile(tile);
  if (groups.length === 0) return null;
  for (const g of PLAN_GROUPS) {
    if (groups.includes(g.id)) return g.hint || null;
  }
  return null;
}

/** aria-label for the per-category ⓘ toggle (PR-C wires the button). */
export function categoryHintButtonLabel(label: string): string {
  return `What does ${label} cover?`;
}

/* ── Adaptive category set (PR-C · spec §3 PR-C · design §5.2) ─────────────
   The bench shows the couple's in-plan categories; the rest sit in a per-folder
   chip pool. Rule 3 above applies to this copy too — a wording change must stay
   a one-file diff, so none of these strings may be inlined in JSX. */

/**
 * Heading above a folder's "not in your event" chip pool. Says "event", not
 * "plan" — the couple thinks in terms of the event they are building, and
 * `EXPLORE_INFO_STRIP` above names the same container the same way.
 *
 * ⚠ "PLAN" IS A RESERVED WORD in this surface's copy
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §2, one word / one concept):
 * a **plan** is a saved, named alternative team you compare — never the set of
 * categories your event covers. Every string in this block therefore says
 * *event*, aria-labels included. The EXPORT NAMES keep `…PLAN…` on purpose:
 * they are also `explore-in-plan.ts`'s internal vocabulary (`notInPlan`,
 * `inPlanTiles`), which is a concept, not copy.
 */
export const ADD_TO_PLAN_HEADING = '＋ Add to your event';

/** aria-label on one pool chip. Mirrors the heading above — a screen reader must
 *  not say "plan" over a pool the eye reads as "event". */
export function addToPlanChipLabel(label: string): string {
  return `Add ${label} to your event`;
}

/** The quiet per-category removal control. */
export const REMOVE_FROM_PLAN_LABEL = 'Not needed? Remove';

export function removeFromPlanButtonLabel(label: string): string {
  return `Remove ${label} from your event`;
}

/**
 * The HARD GUARD's copy (spec §3 PR-C): a category holding a locked vendor is
 * not removable. Shown by the client when it refuses, and returned verbatim by
 * the server action when it refuses — one sentence, one home.
 */
export const REMOVE_BLOCKED_LOCKED =
  'This category has a locked vendor. Unlock (or undo) that booking first — removing a category never cancels a booking.';

/** A folder whose in-plan set is empty but whose pool is not. Visible copy, so
 *  it takes the same noun as the heading and the ⓘ panel. */
export function folderEmptyInPlan(folderLabel: string): string {
  return `Nothing from ${folderLabel} in your event yet — add below if you need it.`;
}

/* ── Three-action card (slice D · spec §3 PR-D, §12.1) ─────────────────────
   Rule 3 above applies here too: none of these may be inlined in JSX. The
   glyphs the playable prototype drew as emoji are Lucide icons in production —
   the copy below is text only, and the component supplies the icon. */

/** Primary action — writes `event_build_picks`. */
export const CARD_ADD_TO_BUILD = 'Add to build';
export const CARD_ADDING = 'Adding…';
/** The pinned state + its vendor-scoped undo. */
export const CARD_IN_BUILD = 'In your build';
export const CARD_REMOVE_FROM_BUILD = 'Remove';

/**
 * No price signal at all — neither a quote nor a marketplace "starts at". The
 * shipped rule (owner 2026-06-09) is that only priced services enter the build;
 * on the bench the honest next step is to ask, because a card here may never
 * have been contacted at all ("waiting for the vendor's price" would be a lie).
 */
export const CARD_NEEDS_PRICE = 'Ask for a price to add this to your build';

/** Second action, stateful on thread existence. */
export const CARD_INQUIRE = 'Inquire';
export const CARD_CHECK_INQUIRY = 'Check inquiry';
export function cardInquireLabel(name: string): string {
  return `Inquire with ${name}`;
}
export function cardCheckInquiryLabel(name: string): string {
  return `Open your conversation with ${name}`;
}

/**
 * Third action. Deliberately NOT "Lock now — it's final": per the §7 handshake
 * amendment a lock is a REQUEST until the vendor accepts the payment, so no
 * customer-facing control may promise finality before that step.
 */
export const CARD_LOCK = 'Lock this';
export const CARD_LOCKING = 'Requesting…';

/**
 * PR-H slice B · what a couple reads while nobody has answered yet.
 *
 * 🗣 THE WORD IS "ASKED", NEVER "BOOKED". The whole point of the handshake is
 * that pressing Lock starts a conversation, so the screen may not describe a
 * booking that does not exist. Nor may it read as an error: waiting is the
 * normal, expected middle of this flow, and the supplier has seven days.
 *
 * ⚠ NO NUMBER IS TYPED HERE. `waitingOnSupplier` takes the deadline the
 * DATABASE materialized and formats it, so the days a couple is shown are the
 * days the fuse will actually burn. A hand-typed "7 days" in copy is how the
 * screen and the enforcement drift apart the first time the window changes.
 */
export const CARD_ASK_SENT = 'Waiting on them';
export const CARD_WITHDRAW = 'Take it back';
export const CARD_WITHDRAWING = 'Taking it back…';
export function cardWithdrawLabel(name: string): string {
  return `Withdraw your booking request to ${name}`;
}
export function waitingOnSupplier(expiresAtIso: string | null, now: Date = new Date()): string {
  if (!expiresAtIso) return 'Asked — waiting for them to answer.';
  const ms = new Date(expiresAtIso).getTime() - now.getTime();
  if (!Number.isFinite(ms)) return 'Asked — waiting for them to answer.';
  // Round UP: with 30 hours left a couple is in their second-to-last day, and
  // "1 day left" would read as the last one.
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return 'Asked — their time to answer is up.';
  if (days === 1) return 'Asked — they have 1 day left to answer.';
  return `Asked — they have ${days} days left to answer.`;
}

/** Collapsed category rows name what is already locked there (decision #8). */
export function lockedNamesLine(names: readonly string[]): string {
  return names.join(' · ');
}
export function lockedNamesLabel(names: readonly string[], categoryLabel: string): string {
  return `Locked for ${categoryLabel}: ${names.join(', ')}`;
}

/** Rail end — a locked, still-open category invites the next pick (#3789). */
export function cardAddAnother(label: string): string {
  return `Add another ${label}`;
}
