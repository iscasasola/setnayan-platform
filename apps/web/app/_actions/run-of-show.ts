'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { resolveAreaLevel, type ModeratorPermissions } from '@/lib/delegate-areas';
import { isAdminProfile } from '@/lib/admin/admin-predicate';
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
 *    `assertMayAdvance` below re-checks the SAME four arms minus the wide one:
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

// The status `advanceScheduleBlock` returns instead of touching the timeline
// when the caller is not the coordinator. NOT exported — Next.js allows only
// async function exports from a `'use server'` module.
const ADVANCE_REFUSED_NOT_COORDINATOR = 'not_the_coordinator';

/**
 * Is this caller allowed to advance THIS event's run of show?
 *
 * Arms, cheapest first (each is a read of the caller's OWN rows, so RLS is
 * satisfied; a read error degrades to "no", never to "yes"):
 *   1. event side — any `event_members` row (mirrors `current_event_ids()`)
 *   2. delegate coordinator — accepted, non-removed `event_moderators` row
 *      whose permission grid resolves schedule:'edit'
 *   3. booked coordinator — `current_coordinator_booked_event_ids()`
 *   4. Setnayan admin — the shared `isAdminProfile` predicate
 */
async function mayAdvanceRunOfShow(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
): Promise<boolean> {
  const [memberRes, delegateRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('event_moderators')
      .select('permissions_json')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('removed_at', null)
      .maybeSingle(),
  ]);
  if (memberRes.data) return true;
  if (
    resolveAreaLevel(
      (delegateRes.data?.permissions_json ?? null) as ModeratorPermissions | null,
      'schedule',
    ) === 'edit'
  ) {
    return true;
  }

  // THE NARROWING. `current_vendor_booked_event_ids()` (what the RPC uses) is
  // every booked supplier; this helper is the same query with the coordinator
  // tile required.
  const { data: coordEvents } = await supabase.rpc('current_coordinator_booked_event_ids');
  if (Array.isArray(coordEvents) && (coordEvents as unknown[]).includes(eventId)) return true;

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', userId)
    .maybeSingle();
  return isAdminProfile(me);
}

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

  // 🔒 Only the coordinator advances the programme. See the module docblock —
  // the RPC's own gate still admits every booked supplier, so this is the
  // boundary, and it runs BEFORE the RPC call.
  if (!(await mayAdvanceRunOfShow(supabase, user.id, eventId))) {
    return {
      status: ADVANCE_REFUSED_NOT_COORDINATOR,
      message: 'Only the coordinator can advance the run of show.',
    };
  }

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
