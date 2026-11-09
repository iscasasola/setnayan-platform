import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { DELEGATE_AREAS, type DelegateArea } from '@/lib/delegate-areas';
import { logQueryError } from '@/lib/supabase/error-detect';

/** One supplier's access ask the booked coordinator may answer — the shape the hosts' `RequestCard` draws. */
export type CoordinatorAsk = {
  requestId: string;
  askerName: string;
  requestedAreas: DelegateArea[];
  note: string | null;
  createdAt: string;
  /** Always false: an ask the coordinator may answer is, by construction, a non-coordinator's. */
  askerIsCoordinator: false;
};

/**
 * 🤝 THE ASKS WAITING ON THE BOOKED COORDINATOR (owner 8 Nov 2026: *"only coordinator and hosts has the final say"*) —
 * other suppliers' pending area asks on this event, as `event_access_requests_coordinator_read` lets them be read:
 * stamped `answerable_by_coordinator` (the asker is a booked supplier who is not the coordinator), never their own,
 * never another event's. Two round trips (the asks, then their shops' names). `measured: false` when the read was
 * refused — said on screen, never drawn as "nothing waiting".
 */
export async function readAsksForCoordinator(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ measured: boolean; asks: CoordinatorAsk[] }> {
  const { data, error } = await supabase
    .from('event_access_requests')
    .select('request_id, vendor_profile_id, requested_areas, note, created_at')
    .eq('event_id', eventId)
    .eq('kind', 'areas')
    .eq('status', 'pending')
    .eq('answerable_by_coordinator', true)
    .order('created_at', { ascending: true })
    .limit(30);
  if (error) {
    logQueryError('readAsksForCoordinator', error, { eventId }, 'graceful_degrade');
    return { measured: false, asks: [] };
  }
  const rows = (data ?? []) as {
    request_id: string;
    vendor_profile_id: string | null;
    requested_areas: string[] | null;
    note: string | null;
    created_at: string;
  }[];
  const ids = [...new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const shops = await supabase.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', ids);
    // A refused name read draws "A supplier", never a wrong name.
    if (shops.error) logQueryError('readAsksForCoordinator.names', shops.error, { eventId }, 'graceful_degrade');
    for (const s of (shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
      if (s.business_name) names.set(s.vendor_profile_id, s.business_name);
    }
  }
  return {
    measured: true,
    asks: rows.map((r) => ({
      requestId: r.request_id,
      askerName: (r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'A supplier',
      requestedAreas: (r.requested_areas ?? []).filter((a): a is DelegateArea => (DELEGATE_AREAS as readonly string[]).includes(a)),
      note: r.note,
      createdAt: r.created_at,
      askerIsCoordinator: false as const,
    })),
  };
}
