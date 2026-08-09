/**
 * run-of-show-advance-gate.ts — WHO may advance the programme, as a pure decision.
 *
 * Owner ruling: only the coordinator runs the programme. This file holds the
 * decision and nothing else — no client, no I/O — so it can be tested against
 * the exact row shapes production produces.
 *
 * ## Why this is a separate, pure function
 *
 * The first two attempts at this gate lived inline in the server action, and an
 * adversarial reviewer broke both of them the same way: **keep the call, discard
 * its result.** Every guard was a structural or source-text assertion over the
 * action body, so deleting the authorization entirely still left the suite green.
 * A decision that is a plain function of plain data cannot be defended that way —
 * the tests call it and read what it returns.
 *
 * ## The two defects this exists to close, both measured on `main`
 *
 * **1 · A WEDDING GUEST COULD ADVANCE THE PROGRAMME.** The shipped gate read
 * `if (memberRes.data) return true;` — it SELECTed `member_type` and then never
 * compared it. `public.member_type` is ('couple','guest','vendor','coordinator'),
 * and a guest who scans the event QR gets a row they can read
 * (`app/join/[eventId]/actions.ts`). This is verbatim the bug
 * `app/[slug]/_lib/host-scope.ts` was written to kill, recurring exactly as its
 * docblock predicted.
 *
 * **2 · A `coordinator` MEMBER ROW PROVES NOTHING.** The obvious repair — reuse
 * `isHostMemberType()` (couple ∪ coordinator) — is NOT enough here, and this is
 * the subtlety both agent rounds missed. `app/host/accept/[token]/actions.ts`
 * upserts `member_type: 'coordinator'` for **every** accepted host invite, whatever
 * that delegate's permissions say. So a delegate holding `schedule: 'view'` carries
 * a coordinator membership row, and a couple/coordinator test would wave them
 * straight through. The row means "this person is on the event's host side"; it
 * does **not** mean "this person may run the night".
 *
 * Hence the split below: `couple` is the host and needs nothing else; `coordinator`
 * must be corroborated by the delegate grid or by the booked-coordinator arm.
 *
 * ⚠ A test whose fixture gives a delegate NO member row is testing a state
 * production cannot produce — accepting an invite always writes one. A green test
 * over an impossible fixture is worth less than no test, because it stops the next
 * person looking.
 */

import { HOST_MEMBER_TYPES } from '@/app/[slug]/_lib/host-scope';

export type AreaLevelLike = 'edit' | 'view' | null | undefined;

export type AdvanceGateInputs = {
  /** `event_members.member_type` for this caller on THIS event, or null. */
  memberType: string | null | undefined;
  /**
   * The delegate's resolved permission level for the `schedule` area, from an
   * ACCEPTED, non-removed `event_moderators` row. Null when there is no such row.
   */
  delegateScheduleLevel: AreaLevelLike;
  /** Result of `current_coordinator_booked_event_ids()`, or null if unreadable. */
  coordinatorBookedEventIds: readonly unknown[] | null | undefined;
  /** The event the caller is being authorized for — the BLOCK's own event id. */
  eventId: string;
  /** `isAdminProfile(users row)`. */
  isAdmin: boolean;
  /**
   * True when ANY of the reads above failed. **Fails closed.** Supabase resolves
   * `{ error }` rather than throwing, so a discarded error turns a failed read into
   * an empty one — which here would read as "not a guest, not a delegate" and could
   * only ever loosen the answer. The caller must pass this honestly.
   */
  readFailed: boolean;
};

/** Reason codes, so a refusal can be explained rather than merely returned. */
export type AdvanceDecision =
  | { allowed: true; via: 'couple' | 'delegate_edit' | 'booked_coordinator' | 'admin' }
  | { allowed: false; reason: 'read_failed' | 'not_on_this_event' | 'insufficient_role' };

export function decideMayAdvance(input: AdvanceGateInputs): AdvanceDecision {
  if (input.readFailed) return { allowed: false, reason: 'read_failed' };

  // The host themselves. The only membership type that stands alone.
  if (input.memberType === 'couple') return { allowed: true, via: 'couple' };

  // A delegate with edit rights on the schedule — whether or not they also carry
  // the `coordinator` membership row that accepting an invite always mints.
  if (input.delegateScheduleLevel === 'edit') {
    return { allowed: true, via: 'delegate_edit' };
  }

  // The booked coordinator supplier. Narrower than the RPC's own arm, which
  // admits EVERY booked vendor — caterer and florist included.
  if (
    Array.isArray(input.coordinatorBookedEventIds) &&
    input.coordinatorBookedEventIds.includes(input.eventId)
  ) {
    return { allowed: true, via: 'booked_coordinator' };
  }

  if (input.isAdmin) return { allowed: true, via: 'admin' };

  return { allowed: false, reason: 'insufficient_role' };
}

/**
 * The membership types that are NOT, on their own, permission to advance.
 * Exported so the test can state the rule positively rather than by example.
 *
 * `coordinator` is deliberately in this list even though it is a
 * `HOST_MEMBER_TYPES` value — see the docblock: the invite-accept path mints it
 * for every delegate regardless of their grid.
 */
export const MEMBER_TYPES_THAT_ARE_NOT_ENOUGH = ['guest', 'vendor', 'coordinator'] as const;

/** Sanity: `couple` must remain a host type, or the split above is meaningless. */
export const COUPLE_IS_A_HOST_TYPE: boolean = (HOST_MEMBER_TYPES as readonly string[]).includes(
  'couple',
);
