import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-event-creation.ts — the one place that answers "may this account make
 * an event?"
 *
 * ─── THE RULING (owner, 2026-10-22) ────────────────────────────────────────
 * ONE ACCOUNT IS BOTH. Owner, verbatim: *"Why does the user cannot make events
 * anymore. In shop they do not create events, but them as a user, they can
 * create their events"* — then *"Yes to all"* to Supplier 1 · Option B of
 * `Setnayan/prototypes/journey_fixes_2026-10-22.html` (DECISION_LOG
 * 2026-10-22 "ONE ACCOUNT IS BOTH").
 *
 *   · An account that owns a shop, or works in one, creates its OWN events as a
 *     user — from the Events tab, the same doors every host uses.
 *   · The SHOP side (Today · Customers · Shop · Hub) never offers "create
 *     event". That half is a property of the shop's pages, held by
 *     `vendor-event-creation.test.ts`, not a refusal here.
 *   · Nothing else moves: every supplier permission and every RLS policy is
 *     unchanged. A supplier still holds NO `events` RLS on a customer's event —
 *     their own events are theirs because they are its host, like anyone's.
 *
 * ⛔ SUPERSEDED: the 2026-08-15 ruling *"supplier/vendors also has their own
 * user account. but they cannot make from their vendor account"* (keep both,
 * block only creating). It refused every create door with "sign up with a
 * personal account using a different email" — a dead end a host met only AFTER
 * opening a shop (JOURNEYS.md 2026-10-21, Supplier · ⚠). That sentence is gone.
 *
 * ─── WHY THE GATE STAYS, ANSWERING "NO ONE IS REFUSED" ─────────────────────
 * 🔑 ONE GATE, NOT FIVE CHECKS. Every server entry point that inserts an event
 * row still asks this function — `createWeddingEvent`, `planNextYearEvent`,
 * `commitOnboardingEvent`, `commitSimpleEvent`, `startTheNextCelebration`. The
 * day a real creation rule arrives it lands HERE, once, and every door already
 * runs it; the guard proves no door skips it. Deleting the calls because the
 * answer is "nobody" today would leave the next rule four doors to forget.
 *
 * It reads nothing: asking the database a question whose answer cannot change
 * the outcome is a round trip on every create for no one.
 *
 * ⚠ THE DOORS' REFUSAL BRANCHES CANNOT FIRE TODAY, so each reuses its own
 * failure words. A future rule that makes them fire must bring its OWN
 * sentence to each door at the same time — never the generic "try again",
 * which would tell a refused person to repeat what cannot work.
 */
export async function accountMayNotCreateEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  // The parameters are the rule's inputs, kept so every door already passes
  // what a future rule would read. Today no account is refused — a shop
  // account included (owner 2026-10-22).
  void supabase;
  void userId;
  return false;
}
