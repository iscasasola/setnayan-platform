import type { SupabaseClient } from '@supabase/supabase-js';

// Which guests count toward the live pax (events.headcount_basis). 'attending'
// = sure guests only (owner-locked default). Mirrors the same union in
// lib/guests.ts (kept local so this server module is import-independent).
export type HeadcountBasis = 'attending' | 'attending_plus_maybe' | 'invited';

// ---------------------------------------------------------------------------
// Adaptive Pax Pricing — server-side helpers (2026-06-13).
//
// The "live pax" for an event = max(minimum-pax floor, live headcount on the
// event's basis). It is the vendor-facing number once it tops the floor, and
// the value snapshotted onto a chat_threads inquiry. The pure progress/meter
// helpers live in lib/guests.ts (computePaxProgress); this module holds the
// helpers that need a DB read.
// ---------------------------------------------------------------------------

/**
 * Resolve the live pax for an event from the DB:
 *   max(events.estimated_pax floor, headcount on events.headcount_basis)
 * Only SURE attending guests count by default (the owner-locked basis); the
 * other bases are honored if the couple ever switches. Returns null when there
 * is nothing to anchor on (no target set AND no qualifying guests) — callers
 * treat null as "no pax to send / show".
 */
export async function resolveLivePax(
  supabase: SupabaseClient,
  eventId: string,
): Promise<number | null> {
  const { data: ev } = await supabase
    .from('events')
    .select('estimated_pax, headcount_basis')
    .eq('event_id', eventId)
    .maybeSingle();

  const estimatedPax: number | null = ev?.estimated_pax ?? null;
  const basis = (ev?.headcount_basis ?? 'attending') as HeadcountBasis;

  let headQuery = supabase
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (basis === 'invited') {
    headQuery = headQuery.neq('rsvp_status', 'declined');
  } else if (basis === 'attending_plus_maybe') {
    headQuery = headQuery.in('rsvp_status', ['attending', 'maybe']);
  } else {
    headQuery = headQuery.eq('rsvp_status', 'attending');
  }
  const { count } = await headQuery;
  const headcount = count ?? 0;

  if (estimatedPax == null && headcount === 0) return null;
  return Math.max(estimatedPax ?? 0, headcount);
}
