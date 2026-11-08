import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VenueVerdict } from '@/lib/venue-check';

/**
 * The event's last FINISHED venue connection check, read through the caller's own RLS.
 *
 * ⚠ THREE ANSWERS, NOT TWO. A refused or failed read is `unread`, never `none`: "we could not look" must
 * not render as "Not checked yet" to a couple who checked last week (the guest-list "No guests yet"
 * defect — lib/guests-read-is-honest.test.ts).
 */
export type LatestVenueCheck =
  | { state: 'unread' }
  | { state: 'none' }
  | {
      state: 'found';
      finishedAt: string;
      verdict: VenueVerdict;
      placeName: string | null;
      averageKbps: number | null;
      slowestKbps: number | null;
      worstRung: number | null;
      delayMs: number | null;
    };

export async function readLatestVenueCheck(supabase: SupabaseClient, eventId: string): Promise<LatestVenueCheck> {
  const { data, error } = await supabase
    .from('live_watch_venue_checks')
    .select('finished_at, verdict, place_name, average_kbps, slowest_kbps, worst_rung, delay_ms')
    .eq('event_id', eventId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('readLatestVenueCheck', error, { event_id: eventId }, 'graceful_degrade');
    return { state: 'unread' };
  }
  if (!data) return { state: 'none' };
  const r = data as {
    finished_at: string;
    verdict: VenueVerdict;
    place_name: string | null;
    average_kbps: number | null;
    slowest_kbps: number | null;
    worst_rung: number | null;
    delay_ms: number | null;
  };
  return {
    state: 'found',
    finishedAt: r.finished_at,
    verdict: r.verdict,
    placeName: r.place_name,
    averageKbps: r.average_kbps,
    slowestKbps: r.slowest_kbps,
    worstRung: r.worst_rung,
    delayMs: r.delay_ms,
  };
}
