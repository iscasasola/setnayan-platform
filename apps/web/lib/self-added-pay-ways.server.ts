import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { budgetPaymentProofPolicy } from '@/lib/r2-client-ref';
import { displayUrlForPrivateStoredAsset } from '@/lib/uploads';
import { readStoredPayWays, waysOrNote, type PayWayView } from '@/lib/self-added-pay-ways';

/**
 * The ways to pay a supplier the couple added — read under the CALLER'S client (the couple's own RLS is the
 * ownership check), each QR presigned for this viewer only when it is this event's own private object.
 *
 * 🔒 READ ONLY, and kept out of every file that writes money: the record sheet's loader and the Pay sheet's loader
 * both call this instead of naming the column (`the-payment-note-is-inert.test.ts`).
 *
 * `{ status: 'error' }` is a refused read — said as such by the caller, never drawn as "no ways added".
 */
export async function readPayWaysForRecord(
  client: SupabaseClient,
  eventId: string,
  manualVendorId: string | null,
): Promise<{ status: 'ok'; ways: PayWayView[] } | { status: 'error' }> {
  if (!manualVendorId) return { status: 'ok', ways: [] };
  const { data, error } = await client
    .from('event_manual_vendors')
    .select('pay_ways, payment_method_note')
    .eq('manual_vendor_id', manualVendorId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return { status: 'error' };
  const row = (data ?? null) as { pay_ways?: unknown; payment_method_note?: string | null } | null;
  const stored = waysOrNote(readStoredPayWays(row?.pay_ways), row?.payment_method_note);
  const policy = budgetPaymentProofPolicy(eventId);
  const ways = await Promise.all(
    stored.map(async (w) => ({ ...w, qrUrl: w.qr ? await displayUrlForPrivateStoredAsset(w.qr, policy).catch(() => null) : null })),
  );
  return { status: 'ok', ways };
}

