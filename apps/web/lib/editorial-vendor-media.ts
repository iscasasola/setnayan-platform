// ============================================================================
// "From Your Vendors" editorial media — shared eligibility gate (iteration
// 0046, Inc 2). Plain server-side helper (NOT 'use server') so both the submit
// action and the vendor page can call it with an admin client.
// ============================================================================

import type { createAdminClient } from '@/lib/supabase/admin';
import { isReviewable, type CompletionFields } from '@/lib/completion-handshake';

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

type EventVendorGateRow = {
  vendor_id: string;
  service_id: string | null;
  // Completion-handshake fields — the Stage-10 gate (editorial opens only AFTER
  // the couple confirms the vendor's service is complete).
  status: string | null;
  completion_status: string | null;
  service_marked_complete_at: string | null;
  customer_confirmed_received_at: string | null;
};

/**
 * The vendor's editorial-eligibility on an event, with enough detail for the UI
 * to show the right locked state.
 *
 *   • isRecommendedPick — this vendor IS the couple's recommended pick
 *     (selection_match_rank = 1) for some category on the event.
 *   • completionConfirmed — that booking's service is confirmed complete
 *     (Stage-10 gate; see isReviewable below).
 *   • eligible — both of the above; the only state where editorial may be added.
 *   • eventVendorId — the event_vendors.vendor_id of the matched booking
 *     (present whenever isRecommendedPick, even pre-completion).
 *   • isDisputed — the matched booking is in a non-delivery dispute (editorial
 *     stays frozen; surfaced so the UI can explain the freeze).
 */
export type EditorialEligibility = {
  isRecommendedPick: boolean;
  completionConfirmed: boolean;
  isDisputed: boolean;
  eligible: boolean;
  eventVendorId: string | null;
};

/**
 * Resolve the matched recommended-pick booking (selection_match_rank = 1 whose
 * service_id → vendor_services.vendor_profile_id === this vendor) + its
 * Stage-10 completion state. Admin-read (event_vendors is couple-scoped under
 * RLS). Shared by the gate helper and the page so the resolution logic lives
 * in one place.
 */
export async function getEditorialEligibility(
  admin: Admin,
  eventId: string,
  vendorProfileId: string,
): Promise<EditorialEligibility> {
  const none: EditorialEligibility = {
    isRecommendedPick: false,
    completionConfirmed: false,
    isDisputed: false,
    eligible: false,
    eventVendorId: null,
  };

  const { data: evRows } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, service_id, status, completion_status, service_marked_complete_at, customer_confirmed_received_at',
    )
    .eq('event_id', eventId)
    .eq('selection_match_rank', 1);
  const rows = (evRows ?? []) as EventVendorGateRow[];
  const withService = rows.filter((r) => r.service_id);
  if (withService.length === 0) return none;

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
  if (!match) return none;

  // Stage-10 completion gate. event_date drives the N=30d vendor-auto-complete
  // fallback inside isReviewable — fetch it once for the matched booking. A
  // null/missing date just disables that one fallback path.
  const { data: eventRow } = await admin
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventDate = (eventRow as { event_date: string | null } | null)?.event_date ?? null;

  const completion: CompletionFields = {
    status: match.status,
    completion_status: match.completion_status,
    service_marked_complete_at: match.service_marked_complete_at,
    customer_confirmed_received_at: match.customer_confirmed_received_at,
  };
  const completionConfirmed = isReviewable(completion, eventDate);

  return {
    isRecommendedPick: true,
    completionConfirmed,
    isDisputed: match.completion_status === 'disputed',
    eligible: completionConfirmed,
    eventVendorId: match.vendor_id,
  };
}

/**
 * The event_vendors row id (vendor_id) where this vendor is the couple's
 * RECOMMENDED pick (selection_match_rank = 1) AND the booking's completion is
 * confirmed (Stage-10 gate). Returns null when this vendor is not the
 * recommended pick for any category on the event, OR when its service hasn't
 * been confirmed complete yet. This is the hard gate enforced server-side in
 * BOTH the submit action and the page.
 *
 * BOTH conditions must hold:
 *   1. selection_match_rank = 1 (the couple's recommended pick for a category)
 *   2. completion confirmed — reuses isReviewable() from completion-handshake.ts,
 *      i.e. completion_status IN ('confirmed','auto_confirmed') OR the legacy
 *      event_vendors.status IN ('delivered','complete') OR the read-side
 *      M/N auto-confirm windows have elapsed. A 'disputed' booking is NOT
 *      reviewable, so a non-delivery freezes editorial too.
 */
export async function findRecommendedEventVendorId(
  admin: Admin,
  eventId: string,
  vendorProfileId: string,
): Promise<string | null> {
  const e = await getEditorialEligibility(admin, eventId, vendorProfileId);
  return e.eligible ? e.eventVendorId : null;
}
