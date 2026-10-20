import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * Is this hand-added supplier WAITING TO BE LET IN — a claim of the couple's
 * link that asked for access and has not been answered (#6709,
 * `event_access_requests.kind = 'claim'`)? Then the record is still unlinked, so
 * "Move to another category" is offered, and its confirm line says what Approve
 * will give them in the new category (`moveConfirmLine`).
 *
 * On the caller's session (`event_access_requests_host_read` is couple-scoped).
 * A refused read is logged and answers false: the move itself is unaffected —
 * only the extra sentence is not said.
 */
export async function hasClaimAsk(supabase: SupabaseClient, eventId: string, vendorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_access_requests')
    .select('request_id')
    .eq('event_id', eventId)
    .eq('event_vendor_id', vendorId)
    .eq('kind', 'claim')
    .eq('status', 'pending')
    .limit(1);
  if (error) {
    logQueryError('hasClaimAsk', error, { event_id: eventId, vendor_id: vendorId }, 'graceful_degrade');
    return false;
  }
  return (data ?? []).length > 0;
}
