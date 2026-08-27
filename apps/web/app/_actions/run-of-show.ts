'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAdvance } from '@/lib/run-of-show-advance';
import type { RunOfShowBlock, RunState } from '@/lib/run-of-show';

/**
 * Day-of run-of-show server actions for the shared RunOfShowHeader.
 *
 *  • fetchRunOfShowBlocks — RLS-respecting read used by the header's realtime
 *    refetch (cron-free; fired by the Supabase channel on event_schedule_blocks).
 *    Returns exactly the rows the caller may see: couple/host/coordinator + booked
 *    vendor get the full timeline via their existing SELECT policies; an
 *    unauthenticated guest gets the is_public rows via the anon public-read
 *    policy — so the same action backs all three surfaces.
 *
 *  • advanceScheduleBlock — calls the single-winner advance_schedule_block RPC
 *    (start / advance run-state). The RPC is single-winner + idempotent, so a
 *    concurrent tap is a benign no-op.
 *
 *    🔒 WHO MAY ADVANCE (owner ruling: only the coordinator runs the programme).
 *    The RPC's own gate (migration 20270917100000) admits
 *      host/couple ∪ delegate-with-schedule:edit ∪ ANY BOOKED VENDOR ∪ admin
 *    — that third arm is every supplier contracted on the wedding, caterer and
 *    florist included. Only the SCREEN narrowed it (and on the vendor client
 *    workspace not even that: `canAdvance` is hardcoded there), and a screen is
 *    not an enforcement boundary — a server action is a public HTTP endpoint,
 *    reachable by anyone signed in who knows the event and block ids.
 *
 *    `lib/run-of-show-advance.ts` re-checks the SAME four arms minus the wide one:
 *    the vendor arm is narrowed to the BOOKED COORDINATOR via the existing
 *    SECURITY DEFINER helper `current_coordinator_booked_event_ids()`
 *    (migration 20271013100000 — `'coordinator' = ANY(vp.services)` over the
 *    booked statuses). Reused, not re-implemented: a marketplace vendor cannot
 *    read their own `event_vendors` row under RLS, so a hand-rolled copy of the
 *    booked check would silently return "not booked" for everyone.
 *
 *    This is a NARROWING, so it is the enforcement — the DB gate stays wider
 *    until a migration follows. Every refusal returns a status the caller can
 *    show; it never resolves as a silent success.
 */


export async function fetchRunOfShowBlocks(
  eventId: string,
): Promise<RunOfShowBlock[] | null> {
  if (!eventId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    // `block_type` drives the per-trade relevance lens (lib/role-run-of-day.ts).
    // One extra column on a read this console already makes, rather than a second
    // query on a live day-of screen.
    // `is_public` travels because the supplier's desk on the celebration's own
    // page renders the whole running order and must MARK the lines the guests
    // were never told about. Additive for the other two readers, which ignore
    // it: the anonymous policy already filters the column away, so a guest's
    // rows all come back `true`.
    .select(
      'block_id, label, start_at, end_at, location, run_state, actual_start_at, block_type, is_public',
    )
    .eq('event_id', eventId)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) return null;
  return (data ?? []).map((b) => ({
    block_id: b.block_id as string,
    label: b.label as string,
    start_at: b.start_at as string,
    end_at: (b.end_at as string | null) ?? null,
    location: (b.location as string | null) ?? null,
    run_state: (b.run_state as RunState) ?? 'upcoming',
    actual_start_at: (b.actual_start_at as string | null) ?? null,
    block_type: (b.block_type as string | null) ?? '',
    is_public: (b.is_public as boolean | null) ?? true,
  }));
}

export async function advanceScheduleBlock(
  eventId: string,
  blockId: string,
): Promise<{ status: string; nextId?: string | null; message?: string }> {
  if (!eventId || !blockId) {
    return { status: 'error', message: 'Invalid input' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // 🔒 The authorization and the RPC both live in lib/run-of-show-advance.ts,
  // with their clients injected, so a test can drive the real path and assert
  // the thing that matters: on a refusal the RPC is NEVER called. Two earlier
  // generations of this gate lived inline here and were defended only by
  // assertions over this file's source — both were beaten by keeping the call
  // and discarding its result.
  const result = await runAdvance(
    { user: supabase as never, admin: createAdminClient() as never },
    user.id,
    eventId,
    blockId,
  );
  if (result.status !== 'ok' && result.status !== 'noop') return result;

  // Refresh every surface that renders the header. Realtime already pushes the
  // change to open tabs; these revalidations keep server-rendered first paints
  // (and tabs without an active socket) current.
  revalidatePath(`/dashboard/${eventId}/schedule`, 'layout');
  revalidatePath(`/vendor-dashboard/clients/${eventId}`, 'layout');

  return result;
}
