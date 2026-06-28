'use server';

import { createClient } from '@/lib/supabase/server';

// Vendor per-guest delivery actions (owner 2026-06-28). Thin wrappers over the
// SECURITY DEFINER RPCs — the vendor passes only (booking id, scanned qr_token);
// the function resolves the booking's event + the guest, enforces ownership via
// current_vendor_event_vendor_ids(), and writes the row. The vendor never reads
// guests (PII boundary). Returns operational data only (status + running count).

export type DeliveryResult =
  | { ok: true; result: string; total: number }
  | { ok: false; error: string };

export async function confirmDelivery(
  eventVendorId: string,
  qrToken: string,
  method: 'qr_scan' | 'manual',
): Promise<DeliveryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('confirm_guest_delivery', {
    p_event_vendor_id: eventVendorId,
    p_qr_token: qrToken,
    p_method: method,
  });
  if (error) return { ok: false, error: 'Could not record that — try again.' };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; total_delivered?: number }
    | undefined;
  const result = row?.result ?? 'not_found';
  if (result === 'not_owner') {
    return { ok: false, error: 'You can only confirm deliveries for your own booking.' };
  }
  if (result === 'not_found') {
    return { ok: false, error: 'That QR isn’t a guest on this event.' };
  }
  return { ok: true, result, total: row?.total_delivered ?? 0 };
}

export async function undoDelivery(
  eventVendorId: string,
  qrToken: string,
): Promise<DeliveryResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('undo_guest_delivery', {
    p_event_vendor_id: eventVendorId,
    p_qr_token: qrToken,
  });
  if (error) return { ok: false, error: 'Could not undo that — try again.' };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { result?: string; total_delivered?: number }
    | undefined;
  if (row?.result === 'not_owner') {
    return { ok: false, error: 'You can only undo deliveries for your own booking.' };
  }
  return { ok: true, result: row?.result ?? 'undone', total: row?.total_delivered ?? 0 };
}
