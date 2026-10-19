import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BOOKED_BY_PAYMENT_EMBED,
  paidSupplierIds,
  supplierStandingWord,
  type SupplierStandingWord,
} from '@/lib/booked-by-payment';

/**
 * schedule-suppliers.ts — WHO THE SCHEDULE NAMES ON AN ITEM, AND HOW THEY STAND.
 *
 * Owner, 2026-10-20 (DECISION_LOG "A CLAIMED SUPPLIER ARRIVES BOOKED IF PAID…"):
 * *"Schedule will have booked or shortlisted if there is no booking yet."* ⇒
 * an item the couple gave to a supplier shows that supplier by its SHOP name,
 * with "Booked" — or "Shortlisted" when there is no booking yet — before and
 * after the supplier claims the couple's link.
 *
 *   · NAME — the shop's own name once the record is bonded to a shop (after the
 *     couple approves the claim), else the name the couple typed. A shop whose
 *     name the couple cannot read falls back to the typed name.
 *   · STANDING — `supplierStandingWord`, the ONE booked-if-paid resolver
 *     (lib/booked-by-payment.ts): a booked status, or a hand-added supplier with
 *     a recorded payment, reads Booked.
 *   · LIVE ROWS ONLY. A record a claim merged onto the shop's row is archived,
 *     and its items now point at the surviving row (`claim_link_record_to_shop`,
 *     migration 20271280900282), so the archived copy is not offered again.
 */

export type ScheduleSupplier = {
  vendor_id: string;
  /** The shop name, or the couple's own name for them. */
  vendor_name: string;
  standing: SupplierStandingWord;
};

type Row = {
  vendor_id: string;
  vendor_name: string | null;
  status: string | null;
  marketplace_vendor_id: string | null;
  manual_vendor_id: string | null;
  vendor_payments?: Array<{ payment_refused_at: string | null }> | null;
};

/** Pure: rows (+ shop names by shop id) → what the schedule names. Booked first, then by name. */
export function scheduleSuppliersFrom(
  rows: ReadonlyArray<Row>,
  shopNames: ReadonlyMap<string, string>,
): ScheduleSupplier[] {
  const paid = paidSupplierIds(
    rows.flatMap((r) => (r.vendor_payments ?? []).map((p) => ({ vendor_id: r.vendor_id, payment_refused_at: p.payment_refused_at }))),
  );
  const named = rows.map((r): ScheduleSupplier => {
    const shop = r.marketplace_vendor_id ? (shopNames.get(r.marketplace_vendor_id) ?? '').trim() : '';
    return {
      vendor_id: r.vendor_id,
      vendor_name: shop || (r.vendor_name ?? '').trim() || 'Supplier',
      standing: supplierStandingWord(r, paid),
    };
  });
  return named.sort(
    (a, b) => Number(b.standing === 'Booked') - Number(a.standing === 'Booked') || a.vendor_name.localeCompare(b.vendor_name),
  );
}

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
    console.error('[supabase-error] lib/schedule-suppliers.ts · from:event_vendors.select', error.message, { event_id: eventId });
    return [];
  }
  const rows = (data ?? []) as unknown as Row[];
  const shopIds = [...new Set(rows.map((r) => r.marketplace_vendor_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (shopIds.length > 0) {
    const { data: shops, error: shopsErr } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', shopIds);
    if (shopsErr) {
      console.error('[supabase-error] lib/schedule-suppliers.ts · from:vendor_profiles.select', shopsErr.message, { event_id: eventId });
    }
    for (const s of (shops ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
      if (s.business_name) names.set(s.vendor_profile_id, s.business_name);
    }
  }
  return scheduleSuppliersFrom(rows, names);
}
