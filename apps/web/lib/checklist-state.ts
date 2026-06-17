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
  decision: 'excluded' | 'deferred'
} | null

// vendor_status enum values (source of truth: 20260513100000_iteration_0006_vendors.sql)
const CONSIDERING_STATUSES = ['considering'] as const
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
