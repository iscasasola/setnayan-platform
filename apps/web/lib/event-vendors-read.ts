/**
 * The couple's team, read so that a REFUSAL can reach the screen.
 *
 * `fetchEventVendors` throws on a refused read, which takes the whole Your Team
 * page to the error boundary; and every `?? []` fallback a caller might write
 * around it would do worse — render "No one booked yet" to a couple with five
 * suppliers booked, byte-identical to a brand-new event. Same disease as the
 * guest list (lib/guests.ts `fetchGuestsByEventMeasured`), same cure: the read
 * reports whether it MEASURED, and the page says "Couldn't load your team"
 * when it did not (`your-team-read-is-honest.test.ts`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchEventVendors, type EventVendorRow } from '@/lib/vendors';
import { logQueryError } from '@/lib/supabase/error-detect';

export type EventVendorsRead =
  | { measured: true; rows: EventVendorRow[] }
  /** The read was refused. `rows` is empty because the rows are UNKNOWN — never render it as "none". */
  | { measured: false; rows: EventVendorRow[] };

export async function readEventVendorsMeasured(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventVendorsRead> {
  try {
    return { measured: true, rows: await fetchEventVendors(supabase, eventId) };
  } catch (caught) {
    logQueryError(
      'readEventVendorsMeasured',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
    return { measured: false, rows: [] };
  }
}
