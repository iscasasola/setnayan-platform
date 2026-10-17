import type { SupabaseClient } from '@supabase/supabase-js';
import { floorPlanOrStop, guestsOrStop, keepApartOrStop, membershipsOrStop } from '@/lib/seating-inputs';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import {
  fetchTables,
  fetchAssignments,
  reconcileProvisionalSeats,
  type AutoSeatGuest,
} from '@/lib/seating';

/**
 * Smart seat-plan · Phase 5 — keep the seat plan in sync with the guest list.
 *
 * Called (best-effort) after a couple-side guest write so the plan reacts to the
 * roster without the couple pressing Auto-Arrange:
 *  - a newly-added, unseated guest gets a PROVISIONAL (unlocked) seat, and
 *  - a guest whose role / group / priority / +1 changed is re-placed next to
 *    their tier/group — pass their id in `reseatGuestIds` (their +1 is pulled in
 *    automatically so the pair stays together).
 *
 * BEST-EFFORT BY DESIGN: seating is secondary to the guest write, so this never
 * throws — a failure logs and leaves the plan untouched (the couple can still run
 * Auto-Arrange manually). No-op when `events.seating_autoplace_enabled` is FALSE
 * or the couple hasn't built any tables yet. LOCKED (Phase 4) seats are never
 * moved — that invariant lives in reconcileProvisionalSeats.
 *
 * 🔁 A WRITE THAT LOSES A RACE IS PLANNED AGAIN, THEN RECORDED (event-day L1·7).
 * Every attending RSVP runs this. Two guests replying in the same second each
 * read the same empty chairs and plan the same seat; the second upsert then hits
 * `event_seat_assignments_chair_uniq` and — being ONE statement — seats NOBODY
 * in its batch. That error used to be ignored, so a guest who said yes was left
 * without a seat and nothing anywhere said so. Now each pass returns its write
 * error (`reconcilePass`); a lost pass is planned once more from FRESH reads (the
 * winner's chairs are taken by then); a second loss is recorded as a fault
 * (`SUPABASE_SAVE_ERROR`) so somebody sees it. Still never thrown.
 */
export type SeatWriteFault = { message: string; code?: string | null };
export type ReconcileDeps = {
  pass: typeof reconcilePass;
  record: (eventId: string, fault: SeatWriteFault) => Promise<void>;
};

async function recordSeatFault(eventId: string, fault: SeatWriteFault): Promise<void> {
  const { insertFaultLog } = await import('@/lib/telemetry/fault-log');
  await insertFaultLog({
    event_type: 'SUPABASE_SAVE_ERROR',
    element_name: 'Seat a guest after their reply',
    file_path: 'lib/seating-reconcile.ts',
    error_message: fault.message,
    payload_snapshot: { eventId, code: fault.code ?? null },
  });
}

export async function applyReconcileForEvent(
  supabase: SupabaseClient,
  eventId: string,
  opts: { reseatGuestIds?: string[] } = {},
  deps: ReconcileDeps = { pass: reconcilePass, record: recordSeatFault },
): Promise<void> {
  try {
    let lost: SeatWriteFault | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      lost = await deps.pass(supabase, eventId, opts);
      if (!lost) return;
      console.error(`applyReconcileForEvent: pass ${attempt} could not write the seats`, eventId, lost);
    }
    // Both passes lost — recorded, never thrown: a guest who said yes is unseated and somebody must see it.
    if (lost) await deps.record(eventId, lost);
  } catch (err) {
    // Seating must never block a guest write. Log + move on.
    console.error('applyReconcileForEvent failed', eventId, err);
  }
}

/**
 * ONE pass: read everything, plan, write. Returns the write's error, or null
 * when the seats landed (or there was nothing to do). A refused READ throws
 * (`lib/seating-inputs.ts`) — the caller's catch logs it and the plan is left
 * untouched; it is not retried, because a read that did not happen is not a race.
 */
export async function reconcilePass(
  supabase: SupabaseClient,
  eventId: string,
  opts: { reseatGuestIds?: string[] } = {},
): Promise<SeatWriteFault | null> {
  const { data: ev } = await supabase
    .from('events')
    .select('seating_autoplace_enabled, seating_group_adjacency')
    .eq('event_id', eventId)
    .maybeSingle();
  // Column DEFAULTs TRUE; a null/missing value is treated as enabled so the
  // feature is on out-of-the-box (only an explicit FALSE opts out).
  if (ev && ev.seating_autoplace_enabled === false) return null;
  // Group-overflow adjacency (gap G8) — ON unless the couple explicitly opted out.
  const groupAdjacency = (ev as { seating_group_adjacency?: boolean | null } | null)
    ?.seating_group_adjacency !== false;

  const [tables, assignments, guests, floorPlan, memberships, constraints] =
    await Promise.all([
      fetchTables(supabase, eventId),
      fetchAssignments(supabase, eventId),
      // 🛑 Each of these STOPS the re-seat when its read did not happen (`lib/seating-inputs.ts`) — caught below,
      // logged, the plan untouched. A refused read must never re-seat people as if they had no group or no rule.
      guestsOrStop(supabase, eventId),
      floorPlanOrStop(supabase, eventId),
      membershipsOrStop(supabase, eventId),
      keepApartOrStop(supabase, eventId),
    ]);
  // No tables yet → nothing to place onto (a couple builds the floor first).
  if (tables.length === 0) return null;

  const roleSet = await resolveRoleSetForEvent(eventId);
  const autoSeatGuests: AutoSeatGuest[] = guests.map((g) => ({
    guest_id: g.guest_id,
    role: g.role,
    group_category: g.group_category,
    rsvp_status: g.rsvp_status,
    plus_one_of_guest_id: g.plus_one_of_guest_id,
    last_name: g.last_name,
    first_name: g.first_name,
    // Primary group = first membership, mirroring how the editor colours a
    // guest, so reconcile clusters the same groups the couple sees.
    group_id: memberships.get(g.guest_id)?.[0] ?? null,
    seating_priority: g.seating_priority ?? null,
  }));

  // Pull each reseat target's +1 into the set so a pair re-clusters together.
  const reseat = new Set(opts.reseatGuestIds ?? []);
  if (reseat.size > 0) {
    for (const g of guests) {
      if (g.plus_one_of_guest_id && reseat.has(g.plus_one_of_guest_id)) {
        reseat.add(g.guest_id);
      }
    }
  }

  const { assign, release } = reconcileProvisionalSeats({
    tables,
    guests: autoSeatGuests,
    assignments,
    constraints,
    groupMembers: memberships,
    priorityOrder: floorPlan.priority_order,
    stage: { x: floorPlan.stage_x, y: floorPlan.stage_y },
    roleSet,
    reseatGuestIds: reseat,
    groupAdjacency,
    roleSeating: floorPlan.role_seating,
  });

  // Delete stale rows first (a displaced guest whose seat got reused), then
  // upsert placements (UNIQUE(event,guest) replaces a re-placed guest's row).
  if (release.length > 0) {
    const { error: releaseErr } = await supabase
      .from('event_seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .in('guest_id', release);
    if (releaseErr) return releaseErr;
  }
  if (assign.length > 0) {
    const { error: assignErr } = await supabase.from('event_seat_assignments').upsert(
      assign.map((r) => ({
        event_id: eventId,
        table_id: r.table_id,
        guest_id: r.guest_id,
        seat_number: r.seat_number,
      })),
      { onConflict: 'event_id,guest_id' },
    );
    if (assignErr) return assignErr;
  }
  return null;
}

