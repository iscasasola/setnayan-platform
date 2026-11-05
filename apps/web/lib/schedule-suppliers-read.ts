import type { SupabaseClient } from '@supabase/supabase-js';
import { BOOKED_BY_PAYMENT_EMBED } from '@/lib/booked-by-payment';
import { scheduleSuppliersFrom, type ScheduleSupplier, type ScheduleSupplierRow } from '@/lib/schedule-suppliers';
import { SCHEDULE_MARK_COLUMNS, marksByShop } from '@/lib/supplier-schedule-marks';

/**
 * schedule-suppliers-read.ts — the schedule page's one read of who an item can
 * be given to (owner 2026-10-20): live `event_vendors` rows with their payments
 * embedded, plus the shops' own names, folded by `scheduleSuppliersFrom`.
 */
/**
 * The read the schedule page makes (couple / delegate session). 🔌 `null` on a refusal (reads-are-honest, 2026-11-02
 * audit #16): `[]` drew every tagged task as "A supplier", an empty Who picker and "A booked supplier" in the PDF —
 * a schedule that looked unassigned. Every caller now says it could not load the suppliers.
 */
export async function readScheduleSuppliers(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleSupplier[] | null> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select(`vendor_id, vendor_name, status, marketplace_vendor_id, manual_vendor_id, ${BOOKED_BY_PAYMENT_EMBED}`)
    .eq('event_id', eventId)
    .is('archived_at', null)
    .order('vendor_name', { ascending: true });
  if (error) {
    console.error('[supabase-error] lib/schedule-suppliers-read.ts · from:event_vendors.select', error.message, { event_id: eventId });
    return null;
  }
  const rows = (data ?? []) as unknown as ScheduleSupplierRow[];
  const shopIds = [...new Set(rows.map((r) => r.marketplace_vendor_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  let marks: ReturnType<typeof marksByShop> | undefined;
  if (shopIds.length > 0) {
    // ✅ With the names: each booked supplier's Seen / Confirm my times (audit G6) — the moment's supplier line says it.
    const [{ data: shops, error: shopsErr }, marksRes] = await Promise.all([
      supabase.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shopIds),
      supabase.from('event_supplier_schedule_marks').select(SCHEDULE_MARK_COLUMNS).eq('event_id', eventId),
    ]);
    if (marksRes.error) {
      // The compact line simply says no mark; the Team row (Suppliers › Booked) says the refusal in words.
      console.error('[supabase-error] lib/schedule-suppliers-read.ts · from:event_supplier_schedule_marks.select', marksRes.error.message, { event_id: eventId });
    } else {
      marks = marksByShop((marksRes.data ?? []) as Array<{ vendor_profile_id: string; seen_at: string | null; confirmed_at: string | null; locked_at: string | null }>);
    }
    if (shopsErr) {
      console.error('[supabase-error] lib/schedule-suppliers-read.ts · from:vendor_profiles.select', shopsErr.message, { event_id: eventId });
    }
    for (const s of (shops ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
      if (s.business_name) names.set(s.vendor_profile_id, s.business_name);
    }
  }
  return scheduleSuppliersFrom(rows, names, marks);
}
