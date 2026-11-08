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
): Promise<{ asks: DatesAsk[]; measured: boolean }> {
  const ids = [
    ...new Set(
      threads
        .filter((t) => (t.inquiry_status === 'pending' || t.inquiry_status === 'accepted') && !bookedEventIds.has(t.event_id))
        .map((t) => t.event_id),
    ),
  ];
  if (ids.length === 0) return { asks: [], measured: true };
  const { rows, error } = await readInChunks(ids, (part) =>
    createAdminClient().from('events').select('event_id, display_name, event_date').in('event_id', part),
  );
  if (error) logQueryError('VendorCustomersPage.openAsks', error, {}, 'graceful_degrade');
  const events = new Map(
    ((rows ?? []) as { event_id: string; display_name: string | null; event_date: string | null }[]).map((e) => [
      e.event_id,
      { date: e.event_date, name: e.display_name },
    ]),
  );
  return { asks: openAsksOf(threads, events, bookedEventIds), measured: !error };
}

