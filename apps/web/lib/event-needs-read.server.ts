import 'server-only';

/**
 * event-needs-read.server.ts — THE ONE READ of what an event needs (Level 1, owner 2026-10-08).
 *
 * The dashboard layout (the bar), Home and the Maker each ask it — on its OWN small select, never by
 * adding three columns to a read that already carries a page: a select naming a column the database
 * does not have yet (a preview ahead of its migration) is refused WHOLE, and the layout's read is
 * every event page.
 *
 * ⚖ A READ THAT FAILED DEGRADES TO "EVERYTHING ON" — yesterday's dashboard, every tab and stage drawn.
 * Hiding is the claim that needs evidence: a tab must never vanish because a read was refused. The
 * refusal is logged, never silent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readEventNeeds, type EventNeedsRead, type EventNeedsRow } from '@/lib/event-needs';

export async function readEventNeedsFor(supabase: SupabaseClient, eventId: string, callSite: string): Promise<EventNeedsRead> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('guest_list_on, suppliers_on, hub_details_on')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) {
      logQueryError(`${callSite}.needs`, error, { event_id: eventId }, 'graceful_degrade');
      return readEventNeeds(null);
    }
    return readEventNeeds(data as EventNeedsRow | null);
  } catch (caught) {
    logQueryError(`${callSite}.needs (threw)`, caught, { event_id: eventId }, 'graceful_degrade');
    return readEventNeeds(null);
  }
}
