'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeAdvance } from '@/lib/run-of-show-gate';
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
 *    florist included. A screen is not an enforcement boundary: a server action
 *    is a public HTTP endpoint, reachable by anyone signed in who knows the
 *    event and block ids.
 *
 *    The narrowing lives in `lib/run-of-show-gate.ts` and is shared with every
 *    screen that decides whether to render the control, so a button can no
 *    longer appear for someone this action will turn down.
 *
 *    TWO BINDINGS MATTER HERE, and neither existed in the first cut:
 *      1. the member arm compares `member_type` (a GUEST has an event_members
 *         row too — see host-scope.ts), and
 *      2. the event authorized is READ FROM THE BLOCK, because
 *         `advance_schedule_block(p_block_id)` resolves the event from the block
 *         alone. Authorizing the caller's `eventId` while the RPC acts on the
 *         block's event is not a gate at all.
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
    .select('block_id, label, start_at, end_at, location, run_state, actual_start_at, block_type')
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

  // 🔒 BIND THE PERMISSION TO THE THING THE RPC WILL ACT ON. The RPC takes the
  // block id and finds the event itself; a caller-supplied `eventId` is just a
  // claim. Resolve the block's real event, refuse when the two disagree, and
  // authorize against the RESOLVED one.
  let privileged = null;
  try {
    // Only for the classes with no SELECT policy on event_schedule_blocks
    // (Setnayan admins). Throws when the service key is absent; a missing key
    // must narrow this action, never crash it.
    privileged = createAdminClient();
  } catch {
    privileged = null;
  }
  // 🔒 Resolve → compare → authorize, all BEFORE the timeline is touched. The
  // whole ordering is `authorizeAdvance`, in lib/, so it can be exercised by a
  // test with a stubbed client — a property that only exists inside a
  // `'use server'` module is a property nothing can check.
  const auth = await authorizeAdvance(supabase, privileged, user.id, eventId, blockId);
  if (!auth.ok) return { status: auth.status, message: auth.message };
  const blockEventId = auth.eventId;

  const { data, error } = await supabase.rpc('advance_schedule_block', {
    p_block_id: blockId,
  });
  if (error) return { status: 'error', message: error.message };

  // Refresh every surface that renders the header. Realtime already pushes the
  // change to open tabs; these revalidations keep server-rendered first paints
  // (and tabs without an active socket) current.
  revalidatePath(`/dashboard/${blockEventId}/schedule`, 'layout');
  revalidatePath(`/vendor-dashboard/clients/${blockEventId}`, 'layout');

  const env = (data ?? {}) as { status?: string; next_id?: string | null };
  return { status: env.status ?? 'ok', nextId: env.next_id ?? null };
}
