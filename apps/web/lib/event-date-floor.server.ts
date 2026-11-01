/**
 * Who the "no event before December 19, 2026" rule does not bind
 * (`lib/event-date-floor.ts` — owner 2026-11-01).
 *
 * The founders' accounts (`users.is_internal`) may use any date: the person
 * acting is internal, or — for a date change on an event that already exists —
 * the event's host is (their co-host moving the founders' own wedding is the
 * founders' event, the same "an unlock belongs to the event" reading as
 * `eventHostIsInternal`).
 *
 * FAIL-CLOSED: a read that does not answer is "not internal", so the rule
 * applies. Nobody is let through an unread answer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { viewerIsInternal } from '@/lib/view-as-free.server';
import { eventHostIsInternal } from '@/lib/entitlements';

export async function eventDateFloorExempt(
  supabase: SupabaseClient | null,
  opts: { eventId?: string | null } = {},
): Promise<boolean> {
  if (await viewerIsInternal().catch(() => false)) return true;
  if (supabase && opts.eventId) return eventHostIsInternal(supabase, opts.eventId).catch(() => false);
  return false;
}
