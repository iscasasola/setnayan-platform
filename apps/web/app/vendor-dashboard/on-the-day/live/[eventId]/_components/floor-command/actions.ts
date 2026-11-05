'use server';

/**
 * Floor-command server actions — the three writes/reads the coordinator's
 * surface needs that did not already have a vendor-side entry point.
 *
 * Everything here re-checks "are you the booked COORDINATOR on this event"
 * before touching anything. That is defence-in-depth, not the boundary: the
 * advance RPC, the retime UPDATEs and the seat lookup are each independently
 * gated in the database. The re-check exists so a caller gets a sentence
 * instead of an opaque policy violation.
 */

import { revalidatePath, revalidateTag } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { advanceScheduleBlock } from '@/app/_actions/run-of-show';
import { changeTheSchedule } from '@/lib/change-the-schedule.server';
import { mayAdvance } from '@/lib/run-of-show-advance';
import type { ScheduleChange } from '@/lib/change-the-schedule';
import { liveDayTag } from '@/lib/live-day-cache';
import { isCoordinatorTrade } from '@/lib/coordinator-trade';
import { eventFeeBlocksAction } from '@/lib/vendor-event-fee-access.server';

export type FloorActionResult = { ok: boolean; error?: string; message?: string };

/** Resolve the caller to the booked COORDINATOR on this event, or explain. */
async function requireCoordinator(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' as const };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'No supplier profile.' as const };
  if (!isCoordinatorTrade(profile.services)) {
    return { error: 'Only the coordinator can run the floor.' as const };
  }

  const bookings = await fetchVendorRoomEvents(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { error: 'You are not booked on this event.' as const };
  }
  // The booking fee unlocks the event (owner, 2026-09-20). No-op while the
  // flag is off; a refused or missing fee read returns null (fail OPEN).
  const feeBlocked = await eventFeeBlocksAction(profile.vendor_profile_id, eventId);
  if (feeBlocked) return { error: feeBlocked as string };

  return { supabase, user, profile };
}

/**
 * Advance the run-of-show one step.
 *
 * Thin on purpose — `advanceScheduleBlock` (shipped with the day-of handover,
 * PR #3412's neighbourhood) already wraps the single-winner
 * `advance_schedule_block` RPC. That RPC's supplier arm is now the booked
 * COORDINATOR alone (migration 20271227867922; it admitted every booked vendor
 * when this surface was written), which is the same question `requireCoordinator`
 * asks — so the re-check below is now a SENTENCE for a caller the database would
 * refuse anyway, not a narrowing of it. This adds ONLY that re-check and the
 * revalidate of the live console, which that action does not refresh.
 */
export async function floorAdvanceBlock(
  eventId: string,
  blockId: string,
): Promise<FloorActionResult> {
  const ctx = await requireCoordinator(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const res = await advanceScheduleBlock(eventId, blockId);

  // The RPC reports its own no-ops rather than throwing; surface them as
  // sentences so a double-tap on the floor is explained, not silent.
  if (res.status === 'noop_live_in_progress') {
    return { ok: false, error: 'Finish the block that is running first.' };
  }
  if (res.status === 'not_signed_in') return { ok: false, error: 'Not signed in.' };
  if (res.status === 'already') return { ok: true, message: 'Already done.' };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  return { ok: true };
}

/**
 * 🗓 CHANGE THE SCHEDULE — move a part ± minutes (the later parts follow) or skip one (owner 2026-11-04: it replaces
 * Hold 10 min / the +5 · +10 · +15 · +30 row; supplier prototype v59 `rosMoveSheet`). The rule and the words are
 * `lib/change-the-schedule.ts`; the write and the notices `lib/change-the-schedule.server.ts`.
 *
 * ONE ACTION, TWO DOORS — every export is a Vercel route (`lint-server-action-budget.mjs`), so the crew's phone rides
 * this one the way the crew scanner rides `floorSeatByQr`:
 *   · `floor` — a CHANGE: the booked coordinator, the couple, or a delegate the hosts lent The Day = Edit (an emcee,
 *     within the access window) — the shipped "Done · next" gate (`mayAdvance`), asked here for a sentence; RLS and
 *     the running-late door decide the write (owner 2026-11-05, DECISION_LOG "WHO CHANGES THE SCHEDULE…" (A)(C));
 *   · `crew`  — a crew Member's phone ASKS (D): signed in (an anonymous account is enough), and
 *     `crew_request_schedule_move` holds every gate itself and files requests the coordinator / hosts approve.
 *
 * One revalidate per change for the guests (`liveDayTag` — the cached Event Hub copies wear it; the schedule write
 * moves the event's stamp too). No live connection is opened for anyone.
 */
export async function floorChangeSchedule(
  eventId: string,
  change: ScheduleChange,
  via: 'floor' | 'crew' = 'floor',
): Promise<FloorActionResult & { locked?: string | null; moved?: readonly string[] }> {
  let supabase;
  let userId: string;
  if (via === 'crew') {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Scan the crew QR again to sign this phone in.' };
    userId = user.id;
  } else {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not signed in.' };
    userId = user.id;
    // A supplier's booking fee still unlocks the event (owner 2026-09-20) — no-op while the flag is off.
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    const feeBlocked = profile ? await eventFeeBlocksAction(profile.vendor_profile_id, eventId) : null;
    if (feeBlocked) return { ok: false, error: feeBlocked as string };
    const allowed = await mayAdvance({ user: supabase as never, admin: createAdminClient() as never }, user.id, eventId);
    if (!allowed) return { ok: false, error: 'The hosts haven’t lent you the schedule to change — ask them for The Day = Edit.' };
  }

  const res = await changeTheSchedule(supabase, userId, eventId, change, via);
  if (!res.ok) return { ok: false, error: res.error, locked: res.locked ?? null };

  revalidateTag(liveDayTag(eventId));
  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/schedule`);
  return { ok: true, message: res.message, moved: res.moved };
}

export type SeatLookupResponse =
  | { ok: true; found: boolean; tableLabel: string | null }
  | { ok: false; error: string };

/**
 * Resolve a scanned guest QR to that guest's table.
 *
 * All of the authorisation lives in `coordinator_seat_by_guest_qr` (migration
 * 20271013200000): booked + coordinator tile + a PUBLISHED plan, returning one
 * table label and nothing else. This wrapper adds no reach — it exists to turn
 * the RPC's three RAISEs into sentences the floor can act on.
 */
export async function floorSeatByQr(
  eventId: string,
  token: string,
  /**
   * 📱 `crew` — a crew phone the shop Allowed (owner 2026-10-29, crew passes): the SAME lookup through
   * `crew_seat_by_guest_qr`, which asks the coordinator scanner's gates of the SHOP plus an allowed, unexpired pass.
   * One action for both doors — every export is a Vercel route (`lint-server-action-budget.mjs`).
   */
  via: 'floor' | 'crew' = 'floor',
): Promise<SeatLookupResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: via === 'crew' ? 'Scan the crew QR again to sign this phone in.' : 'Not signed in.' };
  if (via === 'crew') {
    const { data, error } = await supabase.rpc('crew_seat_by_guest_qr', { p_event_id: eventId, p_token: token });
    if (error) {
      if (error.message?.includes('no_crew_pass')) return { ok: false, error: 'This phone is not on the crew for this event right now.' };
      if (error.message?.includes('not_published')) return { ok: false, error: 'The seating plan has not been published yet.' };
      if (error.message?.includes('seat_plan_not_shared')) return { ok: false, error: 'The hosts haven’t shared the seat plan with the shop yet.' };
      if (error.message?.includes('not_the_coordinator')) return { ok: false, error: 'Finding seats is for the coordinator’s crew.' };
      return { ok: false, error: 'Could not look that up.' };
    }
    const row = (data ?? {}) as { found?: boolean; table_label?: string | null };
    return { ok: true, found: row.found === true, tableLabel: row.table_label ?? null };
  }

  const { data, error } = await supabase.rpc('coordinator_seat_by_guest_qr', {
    p_event_id: eventId,
    p_token: token,
  });

  if (error) {
    if (error.message?.includes('not_published')) {
      return { ok: false, error: 'The seating plan has not been published yet.' };
    }
    if (error.message?.includes('seat_plan_not_shared')) {
      // Owner ruling 2026-07-27: the host chooses what to share. Say so plainly
      // rather than implying a fault — the coordinator must go and ask.
      return { ok: false, error: 'The host hasn’t shared the seat plan with you yet.' };
    }
    if (error.message?.includes('not_the_coordinator')) {
      return { ok: false, error: 'Only the booked coordinator can look up seats.' };
    }
    return { ok: false, error: 'Could not look that up.' };
  }

  const row = (data ?? {}) as { found?: boolean; table_label?: string | null };
  return { ok: true, found: row.found === true, tableLabel: row.table_label ?? null };
}
