import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SCHEDULE_MARK_COLUMNS, marksByShop, type ScheduleMarkFacts } from '@/lib/supplier-schedule-marks';
import type { OwnClocks } from '@/lib/supplier-own-times';

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
    .select(SCHEDULE_MARK_COLUMNS)
    .eq('event_id', eventId);
  if (error) {
    logQueryError('readScheduleMarks', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return marksByShop((data ?? []) as Array<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null; locked_at: string | null }>);
}

/**
 * 🕕 Every booked shop's OWN times on this event, by shop — `supplier_own_times` (cut 5, migration 20271346335702):
 * call / arrive / done as wall clocks, set on the supplier's Schedule tab, before the hosts have any chapter and after.
 * The Team row shows them as "Crew call 11:00 AM" and "On site from … · arrives … · done …" (owner, DECISION_LOG 16 Nov
 * "SCHEDULE MODEL"). The viewer's own session (RLS `supplier_own_times_event_read`). `null` = the read was refused —
 * said, never drawn as "No times yet".
 */
export async function readCrewCalls(supabase: SupabaseClient, eventId: string): Promise<Map<string, OwnClocks> | null> {
  const { data, error } = await supabase
    .from('supplier_own_times')
    .select('vendor_profile_id, call_clock, arrive_clock, done_clock')
    .eq('event_id', eventId);
  if (error) {
    logQueryError('readCrewCalls', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return new Map(
    ((data ?? []) as Array<{ vendor_profile_id: string; call_clock: string | null; arrive_clock: string | null; done_clock: string | null }>).map((r) => [
      r.vendor_profile_id,
      { call: r.call_clock, arrive: r.arrive_clock, done: r.done_clock },
    ]),
  );
}
