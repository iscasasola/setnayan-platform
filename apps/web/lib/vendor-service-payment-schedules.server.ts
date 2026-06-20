/**
 * Server-only companion to lib/vendor-service-payment-schedules.ts.
 *
 * Holds the couple-facing fetch for a vendor service's PAYMENT SCHEDULE. PR-B
 * renders the result on the couple's workspace; PR-A only persists + exposes the
 * read. Kept server-side (no client import) so the security model below stays on
 * the server boundary, matching vendor-payment-methods.server.ts.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  rowToCoupleFacing,
  type CoupleFacingScheduleItem,
  type PaymentScheduleItemRow,
} from '@/lib/vendor-service-payment-schedules';

/**
 * A booked vendor service's payment schedule, seq-ordered, for couple display.
 * Security model mirrors fetchPublishedMethodsForCouple:
 *   • `authedClient` (couple RLS) proves the couple owns this event_vendor row
 *     AND that the service genuinely belongs to that vendor;
 *   • `adminClient` then reads the schedule (owner-RLS'd on the vendor side),
 *     but only AFTER ownership is proven above.
 * Returns [] for off-platform/manual vendors (no marketplace profile), when the
 * couple doesn't own the event_vendor row, when the service doesn't belong to
 * that vendor, or when the service simply has no schedule defined.
 */
export async function fetchScheduleForCouple(opts: {
  authedClient: SupabaseClient;
  adminClient: SupabaseClient;
  eventId: string;
  eventVendorId: string;
  vendorServiceId: string;
}): Promise<CoupleFacingScheduleItem[]> {
  const { authedClient, adminClient, eventId, eventVendorId, vendorServiceId } = opts;

  // 1. Prove the couple owns this event_vendor (RLS-scoped read), and resolve
  //    the marketplace vendor the booking points at.
  const { data: ev } = await authedClient
    .from('event_vendors')
    .select('vendor_id, event_id, marketplace_vendor_id')
    .eq('vendor_id', eventVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  const marketplaceVendorId =
    (ev as { marketplace_vendor_id: string | null } | null)?.marketplace_vendor_id ?? null;
  if (!marketplaceVendorId) return []; // off-platform/manual vendor → no schedule

  // 2. The service must belong to that same marketplace vendor — otherwise a
  //    couple could read any service's schedule by id. (admin client bypasses
  //    owner RLS; the ownership match is the guard.)
  const { data: svc } = await adminClient
    .from('vendor_services')
    .select('vendor_service_id, vendor_profile_id')
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', marketplaceVendorId)
    .maybeSingle();
  if (!svc) return [];

  // 3. Read the schedule (admin client bypasses owner RLS; ownership proven).
  const { data: rows } = await adminClient
    .from('vendor_service_payment_schedules')
    .select('*')
    .eq('vendor_service_id', vendorServiceId)
    .order('seq', { ascending: true });

  return ((rows ?? []) as PaymentScheduleItemRow[]).map(rowToCoupleFacing);
}
