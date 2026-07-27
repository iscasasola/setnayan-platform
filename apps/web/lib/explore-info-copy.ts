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
 * ⚠ The lock-handshake line reflects the §7 amendment: a lock is a REQUEST until
 * the vendor accepts the payment. Customer-facing copy must not promise "it's
 * final" before that step. When PR-H/PR-I ship the request states, update the
 * line HERE — not in the components.
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

/** §11.1 — what the Coverage Strip means. */
export const EXPLORE_INFO_STRIP =
  'The strip at the top is your plan, one tile per category you chose during onboarding. It is ordered by what needs deciding soonest, categories you are done with sink to the right, and NEXT marks the one to pick up now.';

/** §11.1 — the lock handshake, one line (spec §7). */
export const EXPLORE_INFO_HANDSHAKE =
  'Locking is a handshake, not a switch: you request the lock, the vendor agrees, you pay and send the receipt, the vendor accepts it — only then is your date reserved.';

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

/** Heading above a folder's "not in your plan" chip pool. */
export const ADD_TO_PLAN_HEADING = '＋ Add to your plan';

/** aria-label on one pool chip. */
export function addToPlanChipLabel(label: string): string {
  return `Add ${label} to your plan`;
}

/** The quiet per-category removal control. */
export const REMOVE_FROM_PLAN_LABEL = 'Not needed? Remove';

export function removeFromPlanButtonLabel(label: string): string {
  return `Remove ${label} from your plan`;
}

/**
 * The HARD GUARD's copy (spec §3 PR-C): a category holding a locked vendor is
 * not removable. Shown by the client when it refuses, and returned verbatim by
 * the server action when it refuses — one sentence, one home.
 */
export const REMOVE_BLOCKED_LOCKED =
  'This category has a locked vendor. Unlock (or undo) that booking first — removing a category never cancels a booking.';

/** A folder whose in-plan set is empty but whose pool is not. */
export function folderEmptyInPlan(folderLabel: string): string {
  return `Nothing from ${folderLabel} in your plan yet — add below if you need it.`;
}
