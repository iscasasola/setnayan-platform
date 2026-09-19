/**
 * vendor-payment-asks-read.ts — every OPEN payment ask a shop has on one
 * booking, read to the end.
 *
 * It was `.limit(20)`: a shop that had asked a customer for money 21 times saw
 * 20 asks, with nothing on screen to say one was hidden — and the panel exists
 * so the shop does not send the same bill twice. The read now pages to the
 * server's exact count (`readAllPages`) and says whether it finished; the
 * client page turns `complete: false` into "we could not load what you have
 * already asked for", never a shorter list.
 *
 * Read on the vendor's OWN session (`vendor_payment_asks` carries a vendor
 * SELECT policy, booked event ∩ own profile). The raw PostgREST error is kept
 * (not just its message) so the caller's deploy-window carve-out
 * (`isMissingRelationError`) can still tell "table not there yet" from a refusal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';

export type OpenPaymentAskRow = {
  ask_id: string;
  amount_php: number | string | null;
  note: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
};

type RawError = { message: string; code?: string; details?: string | null; hint?: string | null };

export async function readOpenPaymentAsks(
  supabase: SupabaseClient,
  eventVendorId: string,
): Promise<{ rows: OpenPaymentAskRow[]; error: RawError | null; complete: boolean }> {
  let rawError: RawError | null = null;
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await supabase
        .from('vendor_payment_asks')
        .select('ask_id, amount_php, note, due_date, status, created_at', { count: 'exact' })
        .eq('event_vendor_id', eventVendorId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .order('ask_id', { ascending: true })
        .range(from, to);
      if (error) rawError = error as RawError;
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  return { rows: read.rows as OpenPaymentAskRow[], error: rawError, complete: read.complete };
}
