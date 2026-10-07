import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { COMMITTED_BOOKING_STATUSES } from './vendor-addon-first5-free';
import { anyPerHead } from './headcount-row';
import { logQueryError } from './supabase/error-detect';

/**
 * Does a BOOKED supplier price this event per head? (`lib/headcount-row.ts`.)
 * true / false — or null when either read was refused, so a failure never reads
 * as "nothing to finalize". Two reads: the committed bookings' service ids, then
 * those services' `pricing_basis`.
 */
export async function readPerHeadBooked(client: SupabaseClient, eventId: string): Promise<boolean | null> {
  const booked = await client
    .from('event_vendors')
    .select('service_id')
    .eq('event_id', eventId)
    .in('status', COMMITTED_BOOKING_STATUSES as unknown as string[])
    .not('service_id', 'is', null);
  if (booked.error) {
    logQueryError('GuestSetup.headcount (event_vendors)', booked.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  const ids = Array.from(new Set((booked.data ?? []).map((r) => r.service_id as string | null).filter((v): v is string => !!v)));
  if (ids.length === 0) return false;
  const services = await client.from('vendor_services').select('pricing_basis').in('vendor_service_id', ids);
  if (services.error) {
    logQueryError('GuestSetup.headcount (vendor_services)', services.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return anyPerHead((services.data ?? []).map((s) => s.pricing_basis as string | null));
}
