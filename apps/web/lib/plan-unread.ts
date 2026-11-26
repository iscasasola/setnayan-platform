/**
 * The words a plan-gated line shows when the plan read failed (owner ruling, final check Add 45, 25 Nov 2026):
 * "We couldn't check your plan, try again" — no upsell and no paid limit is drawn from a read that failed.
 * One sentence for every page (CLAUDE.md §5 rule 4: a failed read never renders as a real answer).
 */
export const PLAN_UNREAD = 'We couldn’t check your plan, try again.';
