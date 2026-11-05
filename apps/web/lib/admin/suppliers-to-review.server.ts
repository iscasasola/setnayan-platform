import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readAllPages, readInChunks } from '@/lib/read-all-pages';
import {
  suppliersToReview,
  type ReviewBookingRow,
  type ReviewChargeRow,
  type ReviewPaymentRow,
  type SupplierToReview,
} from '@/lib/admin/suppliers-to-review';

export type SuppliersToReviewRead =
  | { ok: true; minEvents: number; rows: Array<SupplierToReview & { name: string | null }> }
  | { ok: false; why: string };

/**
 * The reads behind "Suppliers to review" (owner 2026-10-12 #12). Every marketplace
 * booking that is not archived, the payments couples recorded on them, and their
 * fee charges — then the pure roll-up. Service-role: it spans every shop.
 *
 * ⚠ A REFUSED READ IS NOT "NOBODY TO REVIEW". Any failed read returns `ok:false`
 * with which one failed, and the page says so — an empty list is a claim.
 */
export async function readSuppliersToReview(admin: SupabaseClient): Promise<SuppliersToReviewRead> {
  const { data: setting, error: sErr } = await admin
    .from('platform_settings')
    .select('fee_review_unsettled_events_min')
    .eq('id', 1)
    .maybeSingle();
  const min = Number((setting as { fee_review_unsettled_events_min?: number | null } | null)?.fee_review_unsettled_events_min);
  if (sErr || !Number.isFinite(min) || min < 1) {
    if (sErr) logQueryError('admin/suppliers-to-review.setting', sErr);
    return { ok: false, why: 'the review count' };
  }

  const bookings = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('event_vendors')
        .select('vendor_id, event_id, marketplace_vendor_id, status', { count: 'exact' })
        .not('marketplace_vendor_id', 'is', null)
        .is('archived_at', null)
        .or('package_role.is.null,package_role.neq.covered')
        .order('vendor_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  if (bookings.error || !bookings.complete) {
    console.error('[admin/suppliers-to-review] bookings read', bookings.error);
    return { ok: false, why: 'the bookings' };
  }
  const bookingRows: ReviewBookingRow[] = (
    bookings.rows as Array<{ vendor_id: string; event_id: string | null; marketplace_vendor_id: string; status: string }>
  ).map((b) => ({
    eventVendorId: b.vendor_id,
    eventId: b.event_id,
    vendorProfileId: b.marketplace_vendor_id,
    status: b.status,
  }));
  const ids = bookingRows.map((b) => b.eventVendorId);

  const pays = await readInChunks<{ vendor_id: string; amount_php: number | string | null }>(ids, (part) =>
    admin.from('event_vendor_payments').select('vendor_id, amount_php').in('vendor_id', part),
  );
  if (pays.error) {
    logQueryError('admin/suppliers-to-review.payments', pays.error);
    return { ok: false, why: 'the payments couples recorded' };
  }
  const charges = await readInChunks<{
    event_vendor_id: string | null;
    status: string;
    amount_charged_centavos: number | string | null;
  }>(ids, (part) =>
    admin
      .from('booking_fee_charges')
      .select('event_vendor_id, status, amount_charged_centavos')
      .in('event_vendor_id', part),
  );
  if (charges.error) {
    logQueryError('admin/suppliers-to-review.charges', charges.error);
    return { ok: false, why: 'the booking fees' };
  }

  const rows = suppliersToReview({
    bookings: bookingRows,
    payments: pays.rows.map((p): ReviewPaymentRow => ({ eventVendorId: p.vendor_id, amountPhp: Number(p.amount_php) })),
    charges: charges.rows.map(
      (c): ReviewChargeRow => ({
        eventVendorId: c.event_vendor_id,
        status: c.status,
        amountCentavos: Number(c.amount_charged_centavos) || 0,
      }),
    ),
    minEvents: min,
  });

  // Names are best-effort: a refused name read costs the row its NAME, not the row.
  const names = new Map<string, string | null>();
  if (rows.length > 0) {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', rows.map((r) => r.vendorProfileId));
    if (error) logQueryError('admin/suppliers-to-review.names', error);
    for (const v of (data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>) {
      names.set(v.vendor_profile_id, v.business_name);
    }
  }
  return { ok: true, minEvents: min, rows: rows.map((r) => ({ ...r, name: names.get(r.vendorProfileId) ?? null })) };
}
