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
 *    ✅ THE DATABASE NOW HOLDS THIS ITSELF. Migration 20271227867922 narrowed
 *    `advance_schedule_block`'s vendor arm from `current_vendor_booked_event_ids()`
 *    — every supplier contracted on the wedding, caterer and florist included —
 *    to `current_coordinator_booked_event_ids()`, the SAME SECURITY DEFINER
 *    helper this file's gate uses (migration 20271013100000,
 *    `'coordinator' = ANY(vp.services)` over the booked statuses). Reused, not
 *    re-implemented: a marketplace vendor cannot read their own `event_vendors`
 *    row under RLS, so a hand-rolled copy of the booked check would silently
 *    return "not booked" for everyone. The guard is
 *    `tests/db/only-the-coordinator-advances-the-programme.db.test.ts`, which
 *    calls the RPC directly — a test driving THIS action would have passed
 *    before that migration existed.
 *
 *    `lib/run-of-show-advance.ts` is therefore no longer the only enforcement,
 *    and it is still not redundant: it refuses BEFORE the round trip, returns a
 *    status the caller can show instead of an opaque 42501, and it is STRICTER
 *    than the database on arm 1 — `current_event_ids()` is any `event_members`
 *    row, so the DB still admits a QR-scanning guest and a view-only delegate
 *    where `decideMayAdvance` requires member_type === 'couple'. That arm is an
 *    open gap, measured in section 4 of the db test above. Do not delete this
 *    gate on the strength of the migration.
 *
 *    Every refusal returns a status the caller can show; it never resolves as a
 *    silent success.
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
  if (error) console.error('[supabase-error] app/_actions/run-of-show.ts · from:event_schedule_blocks.select', error);
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
