import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readInChunks } from '@/lib/read-all-pages';
import { openAsksOf, type DatesAsk } from '@/lib/vendor-dates';

/*
  ONE READER for the asks the month marks — the one Clients screen (`page.tsx`) and the picked client's Schedule month
  (`actions.ts`, `{ whole: true }`, Build 2 #43g) both call it, so the two months can never mark asking days differently.
*/

/**
 * The shop's open conversations about unbooked, dated events — "Holding" (amber). The thread's own `event` embed is
 * always null for a supplier, so the dates come from ONE admin `events` read scoped to this shop's own threads.
 */
export async function readOpenAsks(
  threads: { thread_id: string; event_id: string; inquiry_status: string | null; created_at: string }[],
  bookedEventIds: ReadonlySet<string>,
  /** This shop — its own booking rows say which asks it already said yes to (F-W1-68). */
  vendorProfileId: string,
): Promise<{ asks: DatesAsk[]; measured: boolean }> {
  const ids = [
    ...new Set(
      threads
        .filter((t) => (t.inquiry_status === 'pending' || t.inquiry_status === 'accepted') && !bookedEventIds.has(t.event_id))
        .map((t) => t.event_id),
    ),
  ];
  if (ids.length === 0) return { asks: [], measured: true };
  const [{ rows, error }, agreedRead] = await Promise.all([
    readInChunks(ids, (part) => createAdminClient().from('events').select('event_id, display_name, event_date').in('event_id', part)),
    /* 📅 AGREED, NOT YET PAID (owner 13 Nov 2026, F-W1-68): the shop said yes — its booking row is `contracted` /
       `deposit_paid` — but no first payment holds the date yet (ruling 5, 27 Jul), so there is no pool booking and the
       thread is still open. That is Booked, never "Asking". A refused read leaves it an ask (the old words), logged. */
    readInChunks(ids, (part) =>
      createAdminClient()
        .from('event_vendors')
        .select('event_id')
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', ['contracted', 'deposit_paid'])
        .in('event_id', part),
    ),
  ]);
  if (agreedRead.error) logQueryError('VendorCustomersPage.openAsks.agreed', agreedRead.error, {}, 'graceful_degrade');
  const agreed = new Set(((agreedRead.rows ?? []) as { event_id: string }[]).map((r) => r.event_id));
  if (error) logQueryError('VendorCustomersPage.openAsks', error, {}, 'graceful_degrade');
  const events = new Map(
    ((rows ?? []) as { event_id: string; display_name: string | null; event_date: string | null }[]).map((e) => [
      e.event_id,
      { date: e.event_date, name: e.display_name },
    ]),
  );
  return { asks: openAsksOf(threads, events, bookedEventIds, agreed), measured: !error };
}

