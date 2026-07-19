'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
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
 *    (start / advance run-state). The RPC self-gates auth (host/coordinator ∪
 *    booked vendor ∪ admin) and is single-winner + idempotent, so a concurrent
 *    tap is a benign no-op.
 */

export async function fetchRunOfShowBlocks(
  eventId: string,
): Promise<RunOfShowBlock[] | null> {
  if (!eventId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select('block_id, label, start_at, end_at, location, run_state, actual_start_at')
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

  const { data, error } = await supabase.rpc('advance_schedule_block', {
    p_block_id: blockId,
  });
  if (error) return { status: 'error', message: error.message };

  // Refresh every surface that renders the header. Realtime already pushes the
  // change to open tabs; these revalidations keep server-rendered first paints
  // (and tabs without an active socket) current.
  revalidatePath(`/dashboard/${eventId}/schedule`, 'layout');
  revalidatePath(`/vendor-dashboard/clients/${eventId}`, 'layout');

  const env = (data ?? {}) as { status?: string; next_id?: string | null };
  return { status: env.status ?? 'ok', nextId: env.next_id ?? null };
}
