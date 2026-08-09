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

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { advanceScheduleBlock } from '@/app/_actions/run-of-show';
import { fetchScheduleBlocks } from '@/lib/schedule';
import { computeRetimePatches } from '@/lib/schedule-ros';
import { checkRetime } from '@/lib/floor-command';
import { advanceRefusalMessage } from '@/lib/run-of-show';
import { isBookedCoordinatorOnEvent } from '@/lib/run-of-show-gate';
import { COORDINATOR_TILE } from '@/lib/day-requests';

export type FloorActionResult = { ok: boolean; error?: string; message?: string };

/**
 * Resolve the caller to the booked COORDINATOR on this event, or explain.
 *
 * ⚠ THE BOOKED CHECK USED A DIFFERENT TABLE FROM EVERY OTHER SURFACE. It read
 * `vendor_schedule_pool_bookings` (a held date) while the run-of-show gate reads
 * `event_vendors.status IN ('contracted', …)` through
 * `current_coordinator_booked_event_ids()`. Those two lifecycles are offset, so
 * a real coordinator could pass here and be refused by the action a line later
 * — a control that animates and does nothing. One shared source now answers it,
 * the same one the server action enforces.
 *
 * The profile + tile reads stay: they are what turns "no" into a sentence that
 * names the reason.
 */
async function requireCoordinator(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' as const };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'No vendor profile.' as const };
  if (!profile.services?.includes(COORDINATOR_TILE)) {
    return { error: 'Only the coordinator can run the floor.' as const };
  }

  if (!(await isBookedCoordinatorOnEvent(supabase, eventId))) {
    return { error: 'You are not booked on this event.' as const };
  }

  return { supabase, user, profile };
}

/**
 * Advance the run-of-show one step.
 *
 * Thin on purpose — `advanceScheduleBlock` (shipped with the day-of handover,
 * PR #3412's neighbourhood) already wraps the single-winner
 * `advance_schedule_block` RPC, whose auth arm for a booked vendor predates
 * this surface. This adds ONLY the coordinator re-check and the revalidate of
 * the live console, which that action does not currently refresh.
 */
export async function floorAdvanceBlock(
  eventId: string,
  blockId: string,
): Promise<FloorActionResult> {
  const ctx = await requireCoordinator(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const res = await advanceScheduleBlock(eventId, blockId);

  // 🔴 EVERY UNNAMED STATUS USED TO FALL THROUGH TO `{ ok: true }`. It mapped
  // three by name, so `not_the_coordinator` — and anything added later — was
  // reported as a clean run on the live floor while nothing had moved. The
  // shared mapper inverts that: only the success statuses are success, and each
  // refusal arrives as a sentence.
  const refusal = advanceRefusalMessage(res);
  if (refusal) return { ok: false, error: refusal };
  if (res.status === 'already') return { ok: true, message: 'Already done.' };

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  return { ok: true };
}

/**
 * Push the rest of the run-of-show by N minutes, from `fromBlockId` onward.
 *
 * Reuses `computeRetimePatches` — the same pure cascade the couple-side bulk
 * retime uses (PR #3412) — so the floor and the couple dashboard can never
 * disagree about what "+15 minutes" means. Not a fork: only the entry point is
 * new, because that panel lives solely on the couple's schedule page today.
 *
 * Writes go through the caller's own client, so RLS decides. A coordinator who
 * is a delegate moderator with schedule:'edit' lands; a booked-vendor-only
 * coordinator does not, and gets told so rather than half-applying.
 */
export async function floorRetimeFrom(
  eventId: string,
  fromBlockId: string,
  deltaMinutes: number,
): Promise<FloorActionResult> {
  const check = checkRetime(deltaMinutes);
  if (!check.ok) {
    return {
      ok: false,
      error: check.reason === 'too_large' ? 'That is more than 12 hours.' : 'Pick a delay first.',
    };
  }

  const ctx = await requireCoordinator(eventId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const blocks = await fetchScheduleBlocks(ctx.supabase, eventId);
  if (blocks.length === 0) return { ok: false, error: 'No schedule to move.' };

  let patches;
  try {
    patches = computeRetimePatches(blocks, fromBlockId, check.minutes);
  } catch {
    return { ok: false, error: 'Could not work out the new times.' };
  }
  if (patches.length === 0) return { ok: false, error: 'Nothing after that block to move.' };

  let moved = 0;
  for (const p of patches) {
    const { error } = await ctx.supabase
      .from('event_schedule_blocks')
      .update({ start_at: p.start_at, end_at: p.end_at })
      .eq('block_id', p.block_id)
      .eq('event_id', eventId);
    if (error) {
      // Report what actually happened rather than claiming a clean run.
      return {
        ok: false,
        error:
          moved === 0
            ? 'You do not have permission to move this schedule.'
            : `Only ${moved} of ${patches.length} blocks moved — reload and check the timeline.`,
      };
    }
    moved += 1;
  }

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/schedule`);
  return { ok: true, message: `Moved ${moved} ${moved === 1 ? 'block' : 'blocks'}.` };
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
): Promise<SeatLookupResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

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
