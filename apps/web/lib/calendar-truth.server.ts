import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { namedCalendarsEnabled } from '@/lib/schedule-pools';
import { UNBOOKABLE_MAX_CARDS, inBatches } from '@/lib/bench-bookable-days';
import { refusedDaysBySupplier, type CalendarTruth } from '@/lib/calendar-truth';

/**
 * calendar-truth.server — the ONE read behind every "is this supplier free on our day?" the couple is shown
 * (`lib/calendar-truth.ts` has the rule). Three reads that cannot disagree, started together:
 *
 *   1. their schedule pools — a supplier with none has never set a calendar ("Not set");
 *   2. their bookable cards (active, not linked-only) —
 *   3. …asked of `service_cards_unbookable_on`, the lock's own refusal (closure · hard hold · full pool · full slot,
 *      H6's mirror of `acquire_schedule_pools`), on the days asked, with the same Named Calendars switch the lock reads.
 *
 * ADMIN client: the RPC is service_role-only and pools are the shop's own rows; only a verdict per supplier leaves
 * here, never a supplier's days. The caller must already have proven the viewer is on the event.
 *
 * FAILS TOWARD SILENCE: any error → null, and the caller draws no fit at all — never "Free", never "Booked".
 */
export async function readCalendarTruth(args: {
  admin: SupabaseClient;
  supplierIds: readonly string[];
  days: readonly string[];
}): Promise<Map<string, CalendarTruth> | null> {
  const ids = [...new Set(args.supplierIds)];
  if (ids.length === 0 || args.days.length === 0) return new Map();
  try {
    const [pools, cards] = await Promise.all([
      args.admin.from('vendor_schedule_pools').select('vendor_profile_id').in('vendor_profile_id', ids),
      args.admin
        .from('vendor_services')
        .select('vendor_service_id, vendor_profile_id')
        .in('vendor_profile_id', ids)
        .eq('is_active', true)
        .eq('is_linked_only', false),
    ]);
    if (pools.error) {
      logQueryError('calendar-truth: pools', pools.error);
      return null;
    }
    if (cards.error) {
      logQueryError('calendar-truth: cards', cards.error);
      return null;
    }
    const withPool = new Set(((pools.data ?? []) as { vendor_profile_id: string }[]).map((r) => r.vendor_profile_id));
    const cardsBySupplier = new Map<string, string[]>(ids.map((id) => [id, []]));
    for (const r of (cards.data ?? []) as { vendor_service_id: string; vendor_profile_id: string }[]) {
      cardsBySupplier.get(r.vendor_profile_id)?.push(r.vendor_service_id);
    }
    const allCards = [...cardsBySupplier.values()].flat();
    const refusals: { service_id: string | null; refused_on: string | null }[] = [];
    for (const batch of inBatches(allCards, UNBOOKABLE_MAX_CARDS)) {
      const { data, error } = await args.admin.rpc('service_cards_unbookable_on', {
        p_service_ids: batch,
        p_dates: [...args.days],
        p_named_calendars: namedCalendarsEnabled(),
      });
      if (error) {
        logQueryError('calendar-truth: service_cards_unbookable_on', error);
        return null;
      }
      refusals.push(...((data ?? []) as { service_id: string | null; refused_on: string | null }[]));
    }
    const refused = refusedDaysBySupplier(cardsBySupplier, refusals, args.days);
    return new Map(ids.map((id) => [id, { set: withPool.has(id), refused: refused.get(id) ?? new Set<string>() }]));
  } catch {
    return null;
  }
}
