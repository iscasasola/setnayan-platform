import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { marksByShop, type ScheduleMarkFacts } from '@/lib/supplier-schedule-marks';

/**
 * Every booked supplier's Seen / Confirm my times on this event, by shop (`lib/supplier-schedule-marks.ts`). The
 * viewer's own session: `event_supplier_schedule_marks` admits the couple and Schedule helpers (20271300619930).
 * `null` = the read was refused — said by the caller, never drawn as "not confirmed".
 */
export async function readScheduleMarks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<Map<string, ScheduleMarkFacts> | null> {
  const { data, error } = await supabase
    .from('event_supplier_schedule_marks')
    .select('vendor_profile_id, seen_at, confirmed_at')
    .eq('event_id', eventId);
  if (error) {
    logQueryError('readScheduleMarks', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return marksByShop((data ?? []) as Array<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null }>);
}
