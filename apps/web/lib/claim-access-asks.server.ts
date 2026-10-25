import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isCoordinatorTrade } from '@/lib/coordinator-trade';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { ClaimAccessAsk } from '@/lib/claim-access-asks';

export type { ClaimAccessAsk };

/**
 * claim-access-asks.server.ts — THE SUPPLIERS WAITING TO BE LET IN, read once
 * for every surface that shows the approval card (owner 2026-10-20: a supplier
 * who claims the couple's link asks for access on its own; the couple
 * approves). Event Details › Event access, the Access requests page and Home's
 * doorway all read THIS, so they cannot disagree about who is waiting.
 *
 * On the COUPLE's session: `event_access_requests_host_read` is couple-scoped,
 * so a helper or a coordinator counts none. A refused read is `measured:false`
 * — never "nobody is waiting".
 */

export type ClaimAccessAsksRead =
  | { measured: true; asks: ClaimAccessAsk[] }
  | { measured: false; asks: ClaimAccessAsk[] };

export async function readClaimAccessAsks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ClaimAccessAsksRead> {
  const { data, error } = await supabase
    .from('event_access_requests')
    .select(
      'request_id, created_at, vendor_profile_id, event_vendor_id, ' +
        'shop:vendor_profiles(business_name), record:event_vendors!event_access_requests_event_vendor_id_fkey(vendor_name, category)',
    )
    .eq('event_id', eventId)
    .eq('kind', 'claim')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('readClaimAccessAsks', error, { event_id: eventId }, 'graceful_degrade');
    return { measured: false, asks: [] };
  }
  type Row = {
    request_id: string;
    created_at: string;
    shop: { business_name: string | null } | null;
    record: { vendor_name: string | null; category: string | null } | null;
  };
  const asks = ((data ?? []) as unknown as Row[]).map((r) => {
    const category = (r.record?.category ?? null) as VendorCategory | null;
    return {
      requestId: r.request_id,
      name: (r.shop?.business_name ?? '').trim() || (r.record?.vendor_name ?? '').trim() || 'Your supplier',
      categoryLabel: (category && VENDOR_CATEGORY_LABEL[category]) || 'Supplier',
      coordinator: category ? isCoordinatorTrade([category]) : false,
      createdAt: r.created_at,
    };
  });
  return { measured: true, asks };
}
