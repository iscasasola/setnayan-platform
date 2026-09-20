/**
 * vendor-payday-read.ts — read EVERY row of `vendor_payday_installments()`, and
 * say whether it got to the end.
 *
 * ⚠ MONEY. This RPC feeds the Payday timeline, the "Ongoing payments" tile on
 * My Customers, each roster row's money note, and the money on one customer's
 * page. It used to be called as ONE request. PostgREST caps what one request
 * returns (Supabase's default is 1000 rows) and a capped read comes back
 * large, non-empty and `error: null` — so a supplier whose bookings held more
 * than 1,000 installment and payment rows was shown a smaller "collected of
 * expected" total, with nothing on screen to say so.
 *
 * 🔑 Paged with the shared `readAllPages` (`lib/read-all-pages.ts`), which
 * proves it finished against the server's EXACT count. The order is the RPC's
 * natural key — (event_vendor_id, seq) is unique: arm 1 has one plan per
 * booking row (`event_vendor_payment_plan.event_vendor_id` is UNIQUE) and arm 2
 * only covers booking rows with no plan — so page N+1 starts where page N ended.
 *
 * 🔑 A READ THAT DID NOT FINISH IS NOT A SMALLER TOTAL. Callers get `complete`
 * and must say "some payments couldn't load" rather than add up what arrived.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';
import type { PaydayInstallmentRow } from '@/lib/vendor-cashflow';

export type PaydayRead = {
  rows: PaydayInstallmentRow[];
  error: string | null;
  /** True only when every row the server counted was read. */
  complete: boolean;
};

/**
 * @param client   the supplier's OWN session client — the RPC resolves the shop
 *                 from `auth.uid()` inside, so an admin client would read nothing.
 * @param opts.eventId  narrow to one event's rows (one customer's page).
 */
export async function readVendorPaydayInstallments(
  client: SupabaseClient,
  opts?: { eventId?: string },
): Promise<PaydayRead> {
  const read = await readAllPages(
    async (from, to) => {
      let q = client.rpc('vendor_payday_installments', undefined, { count: 'exact' });
      if (opts?.eventId) q = q.eq('event_id', opts.eventId);
      const { data, error, count } = await q
        .order('event_vendor_id', { ascending: true })
        .order('seq', { ascending: true })
        .range(from, to);
      return {
        rows: (data as unknown[] | null) ?? null,
        error: error ? error.message : null,
        total: count,
      };
    },
    { pageSize: 1000 },
  );
  return {
    rows: read.rows as PaydayInstallmentRow[],
    error: read.error,
    complete: read.complete,
  };
}
