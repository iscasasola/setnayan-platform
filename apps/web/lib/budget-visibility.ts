/**
 * budget-visibility — may THIS signed-in person see (or change) the couple's
 * budget target?
 *
 * ─── WHAT WAS WRONG, MEASURED IN PRODUCTION 2026-08-24 ────────────────────
 * `events_host` carries `estimated_budget_centavos` and admits ANY accepted
 * moderator, because `current_moderator_event_ids()` has no area filter. Not
 * one of the surfaces that PRINT that figure asked which areas the delegate
 * actually holds. Production carries a live, accepted `wedding_planner_external`
 * on an event with a ₱930,000 target and `checkout: false` — so she was shown a
 * budget the product had already decided she may not see.
 *
 * ⚠ AND SHE COULD CHANGE IT. `updateEventMatchCriteria` authorises on "member
 * (couple/coordinator) OR accepted moderator" and writes `budget_pesos` through
 * the ADMIN client, so the same delegate could overwrite the couple's target.
 * The brief for this work described a read leak; the write was worse and is
 * closed here too.
 *
 * ─── THE DECISION WAS ALREADY MADE — THIS IS THE MISSING CALL SITE ────────
 * `'budget'` has been a first-class delegate area since migration
 * 20261129000000: declared in `DelegateArea`, labelled, DEFAULTED OFF in
 * `COORDINATOR_AREAS`, and resolved by `resolveAreaLevel` — whose own rule is
 * `if (area === 'budget') return perms.checkout ? 'view' : null`, mirroring the
 * SQL `moderator_area_level`. That mechanism is called correctly in nine other
 * files. It was simply never consulted on the door guarding money. So NOTHING
 * here invents a policy: it copies a working call site.
 *
 * ⛔ NO RLS, NO GRANT AND NO VIEW IS TOUCHED. Narrowing `events_host` would
 * kill a working feature — the coordinator legitimately needs that event for
 * seating, schedule, guests and vendors. The refusal belongs at the surface
 * that prints the money, not at the row that carries the event.
 *
 * ─── WHICH WAY EACH FAILURE FALLS, AND WHY ────────────────────────────────
 * FAIL-OPEN FOR THE OWNER OF THE MONEY, FAIL-CLOSED FOR A DELEGATE. A refusal
 * is only ever returned when BOTH facts are known affirmatively: this person is
 * not a `couple` member, AND their own delegate row resolves budget to null. If
 * either read fails, or their row cannot be found, the caller renders exactly
 * what it renders today — because a Supabase read that fails resolves with
 * `{ error }` and zero rows, and a new gate that mistook that for "deny" would
 * lock a couple out of their own budget on a network blip.
 *
 * ⚠ `resolveAreaLevel`'s TAIL FAILS OPEN (any delegate with `edit_all` and no
 * explicit key gets 'edit'), which is why this module must never reach it for a
 * NEW area name. It cannot: 'budget' is answered by an explicit branch two
 * lines above that fallback. If a future area is added here, read
 * `lib/delegate-areas.ts` before choosing the predicate.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAreaLevel, type AreaLevel, type ModeratorPermissions } from './delegate-areas';

/** What a surface is allowed to do with the couple's budget target. */
export type BudgetVisibility = {
  /** Print the peso figure, the ring, the allocation planner. */
  mayRead: boolean;
  /** Change the stored target. */
  mayEdit: boolean;
  /**
   * True only when we KNOW this reader is a delegate being refused — the one
   * case that earns the Denied state. A plain read failure is not this.
   */
  refusedDelegate: boolean;
};

/** The couple see and set their own money, always. */
const COUPLE: BudgetVisibility = { mayRead: true, mayEdit: true, refusedDelegate: false };

/**
 * The pure verdict. Both inputs carry a third state on purpose:
 * `isCoupleMember: null` means the membership read did not answer, and
 * `delegateRow: undefined` means the delegate read did not answer. Neither is
 * a denial — see the fail-direction note in the module doc.
 */
export function budgetVisibilityFor(input: {
  /** true / false from a definite read; null when the read failed. */
  isCoupleMember: boolean | null;
  /**
   * The caller's OWN accepted, non-removed `event_moderators` row, or null when
   * the read definitively found none. `undefined` = the read failed.
   */
  delegatePermissions: ModeratorPermissions | null | undefined;
}): BudgetVisibility {
  const { isCoupleMember, delegatePermissions } = input;
  if (isCoupleMember === true) return COUPLE;
  // Unknown membership, or a person with no delegate row we could read: leave
  // the surface exactly as it is today. Only an ANSWERED delegate row refuses.
  if (delegatePermissions === undefined || delegatePermissions === null) return COUPLE;
  const level: AreaLevel = resolveAreaLevel(delegatePermissions, 'budget');
  if (level === null) return { mayRead: false, mayEdit: false, refusedDelegate: true };
  // 🔒 'view' NEVER becomes 'edit'. The locked D1 rule — "budget never exceeds
  // view in V1" — is stated in both the SQL function's own comment and
  // `resolveAreaLevel`'s docblock. A delegate holding checkout reads the
  // target; nobody but the couple moves it.
  return { mayRead: true, mayEdit: false, refusedDelegate: false };
}

/**
 * Resolve the verdict for one signed-in person on one event.
 *
 * Both reads are of the caller's OWN row, which every policy on both tables
 * already permits — the same pair `app/dashboard/[eventId]/layout.tsx` runs to
 * decide whether the event opens at all. Errors are swallowed INTO the
 * "unknown" states rather than thrown, so a caller can never be crashed by a
 * gate that is meant to be invisible to the couple.
 */
export async function resolveBudgetVisibility(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<BudgetVisibility> {
  const [memberRes, delegateRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('member_type', 'couple')
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);

  // ⚠ AN UNREAD ROW IS NOT AN ABSENT ROW. A refused or failed read resolves
  // with `{ error }` and `data: null` — identical to "no such row" — so the
  // error is what separates "definitely not the couple" from "we could not
  // tell", and only the first of those may lead to a refusal.
  const isCoupleMember: boolean | null = memberRes?.error ? null : Boolean(memberRes?.data);
  const delegatePermissions = delegateRes?.error
    ? undefined
    : ((delegateRes?.data?.permissions_json ?? null) as ModeratorPermissions | null);

  return budgetVisibilityFor({ isCoupleMember, delegatePermissions });
}
