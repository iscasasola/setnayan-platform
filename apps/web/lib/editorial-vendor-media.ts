// ============================================================================
// "From Your Vendors" editorial media — shared eligibility gate (iteration
// 0046, Inc 2). Plain server-side helper (NOT 'use server') so both the submit
// action and the vendor page can call it with an admin client.
// ============================================================================

import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/** Hard cap per media type, per vendor, per event (3 photos + 3 clips). */
export const MAX_PER_TYPE = 3;

/** One staged item the vendor submits (uploads already done client-side). */
export type SubmitMediaItem = {
  type: 'photo' | 'clip';
  stillRef: string; // r2://… JPEG (photo itself, or the clip's freeze-still)
  boomerangRef?: string | null; // r2://… baked boomerang MP4 (clips only)
  caption?: string | null;
};

/**
 * The event_vendors row id (vendor_id) where this vendor is the couple's
 * RECOMMENDED pick (selection_match_rank = 1) for the event — resolved through
 * service_id → vendor_services.vendor_profile_id. Returns null if this vendor
 * is not the recommended pick for any category on the event. Admin-read
 * (event_vendors is couple-scoped under RLS).
 */
export async function findRecommendedEventVendorId(
  admin: Admin,
  eventId: string,
  vendorProfileId: string,
): Promise<string | null> {
  const { data: evRows } = await admin
    .from('event_vendors')
    .select('vendor_id, service_id')
    .eq('event_id', eventId)
    .eq('selection_match_rank', 1);
  const rows = (evRows ?? []) as Array<{ vendor_id: string; service_id: string | null }>;
  const withService = rows.filter((r) => r.service_id);
  if (withService.length === 0) return null;

  const { data: svcRows } = await admin
    .from('vendor_services')
    .select('vendor_service_id, vendor_profile_id')
    .in(
      'vendor_service_id',
      withService.map((r) => r.service_id as string),
    );
  const svcToProfile = new Map<string, string>();
  for (const s of (svcRows ?? []) as Array<{
    vendor_service_id: string;
    vendor_profile_id: string;
  }>) {
    svcToProfile.set(s.vendor_service_id, s.vendor_profile_id);
  }
  const match = withService.find(
    (r) => svcToProfile.get(r.service_id as string) === vendorProfileId,
  );
  return match?.vendor_id ?? null;
}
