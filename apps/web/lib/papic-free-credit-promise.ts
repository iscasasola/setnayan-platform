/**
 * THE FREE FIRST-EVENT PAPIC GRANT IS RETIRED (owner 16 Nov 2026, DECISION_LOG
 * "Free 50 Papic credits REMOVED"). Every booking carries a Setnayan gift
 * instead (Papic photos by default), so the platform no longer gives an
 * account free credits on its first event, and no screen may say it does.
 *
 * What went with it: `papicFreeCreditPromise`, `papicFreeCreditPoints`, the
 * `/papic` badge, fact and closing line, the dial's "free" stacking line, the
 * onboarding and plan-card sentences, the help answers, and every grant call
 * in the app (`lib/papic-free-grant.ts` is deleted). Credits already granted
 * stay where they are: nothing is clawed back. The SQL (`papic_claim_free_pool`,
 * `papic_free_grant_claims`) stays because erasure coverage reads it; with
 * `papic_event_pool_config.free_grant_points` at 0 it grants nothing.
 *
 * Where a screen needs a line about free Papic photos, it says
 * `PAPIC_BOOKING_GIFT_LINE` (`lib/setnayan-gift.ts`).
 *
 * 🔒 `lib/the-free-first-event-papic-grant-is-gone.test.ts` holds all of this.
 */

/**
 * ⛔ DEPRECATED — do not import. Kept ONLY for the two files other sessions own
 * while their PRs land (`app/(shell)/pricing/page.tsx`, the L9 public-pages
 * session; `lib/llms-txt.ts`, PR #8423). The guard allows exactly those two and
 * fails on any new importer. Delete this once both have dropped it.
 */
export const PAPIC_FREE_CREDIT_CONDITION = 'on your first event' as const;
