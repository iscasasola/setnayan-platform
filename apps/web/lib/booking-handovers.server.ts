import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Delivery-handover server reads (Wave 4 day-of run-of-show & handover).
 *
 * Admin-surface helper: pull every booking handover for a set of vendors,
 * keyed by vendor_profile_id, so the dispute console can show delivery + couple
 * acknowledgement state alongside a dispute (a "did they deliver, did the couple
 * confirm?" trail). Mirrors fetchPolicyAcknowledgementsByVendor.
 */

export type HandoverEvidenceRow = {
  handoverId: string;
  eventId: string;
  eventVendorId: string;
  vendorProfileId: string;
  kind: 'gallery_link' | 'file' | 'note' | 'signoff';
  label: string | null;
  payload: string | null;
  status: 'delivered' | 'acknowledged' | 'disputed';
  deliveredAt: string;
  coupleAcknowledgedAt: string | null;
};

export async function fetchHandoversByVendor(opts: {
  adminClient: SupabaseClient;
  vendorProfileIds: string[];
}): Promise<Map<string, HandoverEvidenceRow[]>> {
  const { adminClient, vendorProfileIds } = opts;
  const out = new Map<string, HandoverEvidenceRow[]>();
  if (vendorProfileIds.length === 0) return out;
  const { data } = await adminClient
    .from('booking_handovers')
    .select(
      'handover_id, event_id, event_vendor_id, vendor_profile_id, kind, label, payload, status, delivered_at, couple_acknowledged_at',
    )
    .in('vendor_profile_id', vendorProfileIds)
    .order('delivered_at', { ascending: false });
  for (const row of (data ?? []) as Array<{
    handover_id: string;
    event_id: string;
    event_vendor_id: string;
    vendor_profile_id: string | null;
    kind: HandoverEvidenceRow['kind'];
    label: string | null;
    payload: string | null;
    status: HandoverEvidenceRow['status'];
    delivered_at: string;
    couple_acknowledged_at: string | null;
  }>) {
    if (!row.vendor_profile_id) continue;
    const list = out.get(row.vendor_profile_id) ?? [];
    list.push({
      handoverId: row.handover_id,
      eventId: row.event_id,
      eventVendorId: row.event_vendor_id,
      vendorProfileId: row.vendor_profile_id,
      kind: row.kind,
      label: row.label,
      payload: row.payload,
      status: row.status,
      deliveredAt: row.delivered_at,
      coupleAcknowledgedAt: row.couple_acknowledged_at,
    });
    out.set(row.vendor_profile_id, list);
  }
  return out;
}
