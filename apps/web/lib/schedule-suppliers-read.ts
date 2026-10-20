import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKED_BY_PAYMENT_EMBED } from '@/lib/booked-by-payment';
import { scheduleSuppliersFrom, type ScheduleSupplier, type ScheduleSupplierRow } from '@/lib/schedule-suppliers';

/**
 * schedule-suppliers-read.ts — the schedule page's one read of who an item can
 * be given to (owner 2026-10-20): live `event_vendors` rows with their payments
 * embedded, plus the shops' own names, folded by `scheduleSuppliersFrom`.
 */
/** The read the schedule page makes (couple / delegate session). Empty on a refusal, said in the log. */
export async function readScheduleSuppliers(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleSupplier[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select(`vendor_id, vendor_name, status, marketplace_vendor_id, manual_vendor_id, ${BOOKED_BY_PAYMENT_EMBED}`)
    .eq('event_id', eventId)
    .is('archived_at', null)
    .order('vendor_name', { ascending: true });
  if (error) {
    console.error('[supabase-error] lib/schedule-suppliers-read.ts · from:event_vendors.select', error.message, { event_id: eventId });
    return [];
  }
  const rows = (data ?? []) as unknown as ScheduleSupplierRow[];
  const shopIds = [...new Set(rows.map((r) => r.marketplace_vendor_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (shopIds.length > 0) {
    const { data: shops, error: shopsErr } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', shopIds);
    if (shopsErr) {
      console.error('[supabase-error] lib/schedule-suppliers-read.ts · from:vendor_profiles.select', shopsErr.message, { event_id: eventId });
    }
    for (const s of (shops ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
      if (s.business_name) names.set(s.vendor_profile_id, s.business_name);
    }
  }
  return scheduleSuppliersFrom(rows, names);
}
