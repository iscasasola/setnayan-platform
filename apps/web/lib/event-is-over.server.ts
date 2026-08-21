import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';

/**
 * event-is-over.server.ts — HAS THIS CELEBRATION FINISHED?
 *
 * One I/O helper over the ONE resolver, for the server paths that need the
 * answer and have nothing but an event id: server actions, and components that
 * are not the page holding the event row.
 *
 * ─── WHY IT EXISTS ────────────────────────────────────────────────────────
 * The pages already resolve this from the row they loaded — the Overview, the
 * rail, the guest list, the Hosts page, the Suite. The BUY paths do not have a
 * row: they resolve an event id off a credential and go straight to minting an
 * order. Each of them writing its own four-column read and its own
 * five-argument call is how the product ends up with two answers to
 * "did this happen".
 *
 * ⚠ NEVER SUBSTITUTE THE PAPIC CAPTURE WINDOW FOR THIS. That window FAILS OPEN
 * by design when a couple never set bounds — most events — so a gate built on
 * it would simply not exist for them.
 *
 * ⚠ FAIL-SOFT, AND THE DIRECTION IS DELIBERATE. An event row we cannot read
 * returns false — "not over" — so a transient database blip never refuses a
 * paying customer. The presentation layer has already closed the offer by the
 * time anything reaches these gates, so arriving here at all is unusual.
 */
export async function eventIsOver(
  supabase: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('events')
      .select('event_date, event_end_date, cleared_at, timezone')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!data) return false;
    return (
      getMenuLifecyclePhase(
        (data as { event_date?: string | null }).event_date ?? null,
        (data as { cleared_at?: string | null }).cleared_at ?? null,
        (data as { timezone?: string | null }).timezone ?? undefined,
        undefined,
        (data as { event_end_date?: string | null }).event_end_date ?? null,
      ) === 'after'
    );
  } catch {
    return false;
  }
}
