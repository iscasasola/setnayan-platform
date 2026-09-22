/**
 * Per-plan-group state machine for vendor categories in the adaptive checklist.
 *
 * `CategoryDecisionState` is the 8-state lifecycle for a vendor category
 * (plan group) — distinct from `ChecklistStatus` in lib/checklist.ts, which
 * is the 2-state ('pending' | 'done') for individual checklist *items*.
 *
 * State derives from two sources at read time:
 *   1. `event_category_decisions` — explicit couple decisions (excluded / deferred)
 *   2. `event_vendors` status column — the actual vendor_status enum
 *
 * vendor_status enum values (defined in 20260513100000_iteration_0006_vendors.sql):
 *   considering  → couple is looking but nothing shortlisted yet
 *   shortlisted  → narrowed to a candidate (bench)
 *   contracted   → deal agreed, paperwork signed
 *   deposit_paid → upfront payment made
 *   delivered    → vendor has delivered their service
 *   complete     → engagement fully complete
 */

export type CategoryDecisionState =
  | 'not_started'        // no vendors, no decision
  | 'excluded'           // couple said "Definite No"
  | 'deferred'           // couple said "Not sure yet"
  | 'needs_more_options' // only 'considering' vendors — searching but nothing shortlisted
  | 'one_option'         // exactly 1 vendor at 'shortlisted'
  | 'searching'          // 2+ vendors at 'shortlisted'
  | 'in_progress'        // vendor(s) contracted / deposit paid — booked but pre-delivery
  | 'done'               // at least 1 vendor delivered or complete

export type CategoryDecision = {
  // 'complete' (Explore Replan slice A): the couple's explicit "I'm done with
  // this category" — from the post-lock toast (multi-pick) or the automatic
  // hard-single fill. Reversible ("Reopen" deletes the row).
  decision: 'excluded' | 'deferred' | 'complete'
} | null

// vendor_status enum values (source of truth: 20260513100000_iteration_0006_vendors.sql)
const CONSIDERING_STATUSES = ['considering'] as const

/**
 * ⚠ `shortlisted` IS NOT REACHABLE IN PRODUCTION TODAY — CTRL-B3 build 4,
 * measured 2026-09-22.
 *
 * `event_vendors.status` in prod holds only `considering` (34) · `contracted`
 * (14) · `deposit_paid` (3). **Zero rows are `shortlisted`**, and the only
 * writer of that value — `lib/reusable-bookings.server.ts` — sits behind
 * `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED`, which is **absent from production**.
 * So `one_option` and `searching` below can never be entered, and their labels
 * ("One option found", "Comparing options") have never been rendered.
 *
 * 🔑 THE BRIEF OFFERED TWO ANSWERS — "make it reachable, or stop reading it" —
 * AND BOTH ARE WRONG HERE.
 *   · Making it reachable is flipping a production flag. That is an owner
 *     decision about a product feature, not a change a build may make.
 *   · Deleting these two arms would BREAK THAT FEATURE THE DAY THE FLAG IS
 *     FLIPPED, silently: reusable bookings would mint `shortlisted` rows and
 *     the checklist would report `not_started` about a category the couple is
 *     actively comparing.
 *
 * So the third answer: make the coupling EXPLICIT and EXECUTED.
 * `SHORTLISTED_REQUIRES_FLAG` names the dependency in one place, and
 * `the-checklist-cannot-reach-a-dead-state.test.ts` asserts both halves — that
 * the writer still exists, and that these states are only ever produced by rows
 * that writer can produce. A dead branch nobody has written down is the defect;
 * a dead branch bound to the switch that revives it is a feature waiting.
 */
export const SHORTLISTED_REQUIRES_FLAG = 'NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED' as const

/**
 * States that exist only while {@link SHORTLISTED_REQUIRES_FLAG} is on.
 * Exported so a reader can ask, rather than discovering it from an empty screen.
 */
export const FLAG_DEPENDENT_STATES = ['one_option', 'searching'] as const

const SHORTLISTED_STATUSES = ['shortlisted'] as const
const IN_PROGRESS_STATUSES = ['contracted', 'deposit_paid'] as const
const DONE_STATUSES = ['delivered', 'complete'] as const

/**
 * Derive the CategoryDecisionState for a single plan group.
 *
 * Pure + deterministic: same inputs → same state. No DB calls.
 * `vendors` is the array of event_vendors rows for this plan group.
 */
export function resolveCategoryState(
  decision: CategoryDecision,
  vendors: Array<{ status: string }>
): CategoryDecisionState {
  if (decision?.decision === 'excluded') return 'excluded'
  if (decision?.decision === 'deferred') return 'deferred'
  // An explicit "I'm done" outranks the vendor-status derivation: the couple
  // has declared the category covered even if no vendor row is 'delivered'.
  if (decision?.decision === 'complete') return 'done'

  const done = vendors.filter(v => (DONE_STATUSES as readonly string[]).includes(v.status))
  if (done.length > 0) return 'done'

  const inProgress = vendors.filter(v => (IN_PROGRESS_STATUSES as readonly string[]).includes(v.status))
  if (inProgress.length > 0) return 'in_progress'

  const shortlisted = vendors.filter(v => (SHORTLISTED_STATUSES as readonly string[]).includes(v.status))
  if (shortlisted.length === 1) return 'one_option'
  if (shortlisted.length >= 2) return 'searching'

  const considering = vendors.filter(v => (CONSIDERING_STATUSES as readonly string[]).includes(v.status))
  if (considering.length > 0) return 'needs_more_options'

  return 'not_started'
}

/** Display label for each state — used in the checklist UI. */
export const CATEGORY_STATE_LABELS: Record<CategoryDecisionState, string> = {
  not_started: 'Not started',
  excluded: 'Not needed',
  deferred: 'Deciding later',
  needs_more_options: 'Looking for options',
  one_option: 'One option found',
  searching: 'Comparing options',
  in_progress: 'In progress',
  done: 'Confirmed',
}

/**
 * Action-prompt copy for the two states that benefit from a contextual nudge.
 * Other states render passively (a pill label is enough).
 */
export const CATEGORY_STATE_PROMPTS: Record<
  'not_started' | 'needs_more_options',
  { title: string; actions: string[] }
> = {
  not_started: {
    title: 'Do you want to plan for this?',
    actions: ["Let's look for one", 'Definite No', 'Not sure yet'],
  },
  needs_more_options: {
    title: 'Need more options?',
    actions: ['Search more vendors', 'Negotiate with current', 'Remove this category'],
  },
}
