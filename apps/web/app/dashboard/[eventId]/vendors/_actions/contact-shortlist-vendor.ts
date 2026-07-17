'use server';

/**
 * contactShortlistVendor — open an inquiry with a vendor the couple already
 * SHORTLISTED for this event (Creator Economy PR-D · owner 2026-07-17,
 * completes the 9-source taxonomy). The couple's shortlist / build workspace is
 * event-scoped, so this stamps `inquiry_source='shortlist'` against the CURRENT
 * event — not the primary-event default the public-profile composer uses.
 *
 * This is a THIN resolver over the canonical `startServiceInquiry`: it turns the
 * couple's `event_vendors` shortlist row into the (vendorProfileId, eventId,
 * initialService) triple that action expects, then delegates. It never opens a
 * thread itself, so the provenance stamp, the follow-gate, the token/unlock
 * economy, and the chat_threads UNIQUE(event_id, vendor_profile_id) dedupe are
 * all inherited unchanged — an already-open thread resolves to the existing one
 * rather than a duplicate or an error.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  startServiceInquiry,
  type StartServiceInquiryResult,
} from '@/app/v/[slug]/inquiry-actions';

export type ContactShortlistVendorResult =
  | StartServiceInquiryResult
  /** The shortlisted vendor is off-platform / manually added — no marketplace
   *  profile to open a thread against. The caller only shows the affordance for
   *  marketplace-connected picks, so this is a belt-and-suspenders guard. */
  | { status: 'not_marketplace' };

export async function contactShortlistVendor(input: {
  eventId: string;
  /** event_vendors.vendor_id — the couple's shortlist row for this vendor. */
  vendorId: string;
}): Promise<ContactShortlistVendorResult> {
  const eventId = String(input.eventId ?? '').trim();
  const vendorId = String(input.vendorId ?? '').trim();
  if (!eventId || !vendorId) {
    return { status: 'error', message: 'Missing event or vendor.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // Resolve the shortlist row under the couple's own RLS — this AUTHORIZES the
  // call (only a row the couple can read passes) AND yields the marketplace
  // vendor + the service they were considering. A row the user can't read (not
  // their event) simply resolves to null → not_marketplace, never a leak.
  const { data: row } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id, service_id, category')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  const vendorProfileId = row?.marketplace_vendor_id
    ? String(row.marketplace_vendor_id)
    : null;
  if (!vendorProfileId) return { status: 'not_marketplace' };

  // Anchor the inquiry on a concrete ACTIVE service: prefer the exact service
  // the couple shortlisted (when still active), else the vendor's first active
  // service. Resolving from the active set guarantees startServiceInquiry's
  // "service belongs to this vendor + is active" validation passes. adminClient
  // bypasses vendor_services RLS — same pattern as the other add/inquiry actions.
  const admin = createAdminClient();
  const { data: activeSvcs } = await admin
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true);
  const active = (activeSvcs ?? []) as {
    vendor_service_id: string;
    category: string | null;
  }[];
  if (active.length === 0) {
    return {
      status: 'error',
      message: 'This vendor has no services to inquire about yet.',
    };
  }
  const preferred = row?.service_id
    ? active.find((s) => s.vendor_service_id === String(row.service_id))
    : null;
  const chosen = preferred ?? active[0]!;

  return startServiceInquiry({
    vendorProfileId,
    eventId,
    initialServiceId: chosen.vendor_service_id,
    // The shortlist row's stored category wins (it's what the couple picked
    // under), falling back to the resolved service's canonical category.
    initialCategoryKey: (row?.category ? String(row.category) : null) ?? chosen.category ?? null,
    alsoServiceIds: [],
    // Inquiry-source taxonomy (owner 2026-07-17) — this inquiry originated from
    // the couple's shortlist/build workspace.
    inquirySource: 'shortlist',
  });
}
