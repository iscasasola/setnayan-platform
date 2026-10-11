import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGroupMembershipsByEventMeasured, fetchGuestsByEventMeasured, type GuestRow } from '@/lib/guests';
import { fetchFloorPlanMeasured, fetchSeatingConstraintsMeasured, type FloorPlanRow, type KeepApartRule } from '@/lib/seating';

/**
 * seating-inputs.ts — 🛑 A SEAT PLAN IS NEVER ARRANGED FROM A READ THAT DID NOT HAPPEN.
 *
 * Auto arrange, Build my seating, Lock & fill and Auto-seat each READ the guest list, who is in which group, the
 * keep-apart rules and the floor plan — and then WRITE seats. Each of those four reads degrades on failure to an
 * empty stand-in (`[]`, an empty Map, the default plan): right for a page, which can say "we couldn't load this".
 * An action cannot. Measured 2026-10-11: with the memberships read refused, Auto arrange seated every guest as if
 * the couple had made no groups — "Cousins" scattered across the room — and reported success. With the guest read
 * refused, Lock & fill clears every unlocked seat and then has nobody to put back.
 *
 * So the arranging actions ask through these: the same value as the plain reader when the read HAPPENED, and
 * `SeatingInputsUnreadError` when it did not — thrown inside the action's own read fan-out, BEFORE its first write,
 * so nothing is cleared, moved or seated. The seat plan says it in its notice strip ("Couldn’t save that — please
 * try again.", `runGated`); the plan is exactly as it was.
 *
 * Its own module (not `seating/actions.ts`) for the reason `seating-lock-error.ts` gives: a 'use server' file may
 * export only async actions. Server-side only — imported by `seating/actions.ts` and `lib/seating-reconcile.ts`
 * (the background re-seat after a guest write: it catches the stop, logs it, and leaves the plan untouched).
 * 🛡 lib/a-seat-plan-is-never-arranged-from-an-unread-list.test.ts.
 */
export type SeatingInput = 'guests' | 'groups' | 'keep-apart rules' | 'floor plan';

export class SeatingInputsUnreadError extends Error {
  readonly code = 'seating_inputs_unread';
  readonly unread: SeatingInput;
  constructor(unread: SeatingInput) {
    super(`The ${unread} could not be read, so nothing was arranged. Please try again.`);
    this.name = 'SeatingInputsUnreadError';
    this.unread = unread;
  }
}

/** The accepted, living guest list (what `fetchGuestsByEvent` returns) — or a stop. */
export async function guestsOrStop(supabase: SupabaseClient, eventId: string): Promise<GuestRow[]> {
  const read = await fetchGuestsByEventMeasured(supabase, eventId);
  if (!read.measured) throw new SeatingInputsUnreadError('guests');
  return read.rows;
}

/** guest_id → their custom groups — or a stop. An empty map here means the couple really made no groups. */
export async function membershipsOrStop(supabase: SupabaseClient, eventId: string): Promise<Map<string, string[]>> {
  const read = await fetchGroupMembershipsByEventMeasured(supabase, eventId);
  if (!read.measured) throw new SeatingInputsUnreadError('groups');
  return read.memberships;
}

/** The keep-apart rules — or a stop. (Unread, they used to be "no rules": two people kept apart were seated together.) */
export async function keepApartOrStop(supabase: SupabaseClient, eventId: string): Promise<KeepApartRule[]> {
  const read = await fetchSeatingConstraintsMeasured(supabase, eventId);
  if (!read.measured) throw new SeatingInputsUnreadError('keep-apart rules');
  return read.rules;
}

/** The floor plan (stage, priority order, role seating) — or a stop. No row yet is an answer: the defaults. */
export async function floorPlanOrStop(supabase: SupabaseClient, eventId: string): Promise<FloorPlanRow> {
  const read = await fetchFloorPlanMeasured(supabase, eventId);
  if (!read.measured) throw new SeatingInputsUnreadError('floor plan');
  return read.plan;
}
