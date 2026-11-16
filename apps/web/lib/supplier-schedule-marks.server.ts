import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SCHEDULE_MARK_COLUMNS, marksByShop, type ScheduleMarkFacts } from '@/lib/supplier-schedule-marks';

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
 * 🕕 Every booked shop's OWN crew call on this event, by shop — `supplier_own_times.call_clock` (cut 5, migration
 * 20271346335702), set on the supplier's Schedule tab, before the hosts have any chapter and after. The Team row shows
 * it as "Crew call 6:00 AM", apart from "On site from …" (owner, DECISION_LOG 16 Nov "SCHEDULE MODEL"). The viewer's
 * own session (RLS `supplier_own_times_event_read`). `null` = the read was refused — said, never drawn as "none".
 */
export async function readCrewCalls(supabase: SupabaseClient, eventId: string): Promise<Map<string, string> | null> {
  const { data, error } = await supabase
    .from('supplier_own_times')
    .select('vendor_profile_id, call_clock')
    .eq('event_id', eventId)
    .not('call_clock', 'is', null);
  if (error) {
    logQueryError('readCrewCalls', error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return new Map(
    ((data ?? []) as Array<{ vendor_profile_id: string; call_clock: string | null }>).flatMap((r) =>
      r.call_clock ? [[r.vendor_profile_id, r.call_clock] as const] : [],
    ),
  );
}
