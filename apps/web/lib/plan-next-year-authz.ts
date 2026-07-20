/**
 * Authorization seam for "Plan next year" (app/dashboard/(account)/create-event
 * /actions.ts › planNextYearEvent).
 *
 * WHY THIS IS A SEPARATE MODULE: the clone runs its INSERTs on the SERVICE-ROLE
 * admin client (RLS-bypassing) and makes the caller `member_type='couple'` of the
 * brand-new event. The only thing standing between a guest and owning a clone of
 * their host's event is this gate — so it gets a DB-free seam the repo's
 * `tsx --test "lib/**\/*.test.ts"` glob can actually drive (a test beside the
 * 'use server' action under app/ is never collected). Same extraction rationale
 * as lib/add-single-guest-core.ts.
 *
 * WHY AN RLS READ IS NOT A GATE (the bug this closes, live 2026-07-20): the
 * `events` SELECT policy `event_member_can_read` resolves through
 * `current_event_ids()`, which returns EVERY event_id the user has an
 * `event_members` row for — with NO member_type filter. The join flow seeds real
 * `member_type='guest'` rows, so a guest reads the host's event back fine. And a
 * server action is a public POST: the `[eventId]` layout's couple gate never runs
 * for it, and the caller need not have rendered the form. "The RLS read returned
 * a row" therefore proves membership of SOME kind, never ownership.
 *
 * COUPLE-ONLY, deliberately. The event layout also admits an accepted
 * `event_moderators` row, but only to VIEW the event shell (per-area writes stay
 * behind the moderator RLS policies). A delegate proposes, never executes, and
 * must not be handed couple-ownership of a fresh event — so moderators are NOT
 * admitted here.
 */

/** The shape `select('member_type')…maybeSingle()` returns: a row, or null. */
export type EventMembershipRow = { member_type?: string | null } | null;

/** Member types permitted to clone an event forward. Couple-only by design. */
export const PLAN_NEXT_YEAR_MEMBER_TYPES: readonly string[] = ['couple'];

export type PlanNextYearAuthz =
  | { ok: true }
  /** No membership row at all — not a member of the source event. */
  | { ok: false; reason: 'not_a_member' }
  /** A member, but not a couple (guest / vendor / coordinator / moderator). */
  | { ok: false; reason: 'not_a_couple' };

/**
 * Reads the CALLER'S OWN membership row for the source event. Production injects
 * a user-scoped (RLS-honouring) Supabase read — `member_reads_membership` lets a
 * member read exactly their own row, so this is RLS-safe and needs no admin
 * client. Must never be given the service-role client.
 */
export interface PlanNextYearAuthzDeps {
  readMembership(eventId: string, userId: string): Promise<EventMembershipRow>;
}

/**
 * Fail-closed authorization decision. Anything that is not an explicit
 * `member_type='couple'` — missing row, a read error surfaced as null, a guest,
 * an unexpected/renamed member_type — is a rejection.
 */
export async function authorizePlanNextYear(
  eventId: string,
  userId: string,
  deps: PlanNextYearAuthzDeps,
): Promise<PlanNextYearAuthz> {
  if (!eventId || !userId) return { ok: false, reason: 'not_a_member' };

  let membership: EventMembershipRow = null;
  try {
    membership = await deps.readMembership(eventId, userId);
  } catch {
    // A throwing read is not permission. Fail closed.
    return { ok: false, reason: 'not_a_member' };
  }

  if (!membership) return { ok: false, reason: 'not_a_member' };
  const memberType = membership.member_type ?? null;
  if (memberType === null || !PLAN_NEXT_YEAR_MEMBER_TYPES.includes(memberType)) {
    return { ok: false, reason: 'not_a_couple' };
  }
  return { ok: true };
}
