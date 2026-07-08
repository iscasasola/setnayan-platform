import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchGuestsByEvent, fetchGroupMembershipsByEvent } from '@/lib/guests';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import {
  fetchTables,
  fetchAssignments,
  fetchFloorPlan,
  fetchSeatingConstraints,
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
 */
export async function applyReconcileForEvent(
  supabase: SupabaseClient,
  eventId: string,
  opts: { reseatGuestIds?: string[] } = {},
): Promise<void> {
  try {
    const { data: ev } = await supabase
      .from('events')
      .select('seating_autoplace_enabled, seating_group_adjacency')
      .eq('event_id', eventId)
      .maybeSingle();
    // Column DEFAULTs TRUE; a null/missing value is treated as enabled so the
    // feature is on out-of-the-box (only an explicit FALSE opts out).
    if (ev && ev.seating_autoplace_enabled === false) return;
    // Group-overflow adjacency (gap G8) — ON unless the couple explicitly opted out.
    const groupAdjacency = (ev as { seating_group_adjacency?: boolean | null } | null)
      ?.seating_group_adjacency !== false;

    const [tables, assignments, guests, floorPlan, memberships, constraints] =
      await Promise.all([
        fetchTables(supabase, eventId),
        fetchAssignments(supabase, eventId),
        fetchGuestsByEvent(supabase, eventId),
        fetchFloorPlan(supabase, eventId),
        fetchGroupMembershipsByEvent(supabase, eventId),
        fetchSeatingConstraints(supabase, eventId),
      ]);
    // No tables yet → nothing to place onto (a couple builds the floor first).
    if (tables.length === 0) return;

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
    });

    // Delete stale rows first (a displaced guest whose seat got reused), then
    // upsert placements (UNIQUE(event,guest) replaces a re-placed guest's row).
    if (release.length > 0) {
      await supabase
        .from('event_seat_assignments')
        .delete()
        .eq('event_id', eventId)
        .in('guest_id', release);
    }
    if (assign.length > 0) {
      await supabase.from('event_seat_assignments').upsert(
        assign.map((r) => ({
          event_id: eventId,
          table_id: r.table_id,
          guest_id: r.guest_id,
          seat_number: r.seat_number,
        })),
        { onConflict: 'event_id,guest_id' },
      );
    }
  } catch (err) {
    // Seating must never block a guest write. Log + move on.
    console.error('applyReconcileForEvent failed', eventId, err);
  }
}
