import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { namedCalendarsEnabled } from '@/lib/schedule-pools';
import {
  UNBOOKABLE_MAX_CARDS,
  inBatches,
  refusalKey,
  suppliersWithNoBookingLeft,
  unbookableDateScope,
} from '@/lib/bench-bookable-days';

/**
 * bench-bookable-days.server — reads the refusals for the bench search (H6).
 *
 * The cards judged are the ones the search itself prices a supplier from: in
 * the searched categories, active, and bookable on their own (a linked-only
 * card is a component of another card, never booked alone). The refusals are
 * asked with the ADMIN client: the function is server-only (service_role), so a
 * signed-in browser can never read another supplier's full days — the caller
 * only ever returns which suppliers stay on the list. The same Named Calendars
 * switch the lock reads is passed, so the search and the lock resolve the same
 * pools. The caller must have already checked the couple is on the event.
 *
 * FAILS OPEN. Any error → nobody is hidden. A supplier wrongly left on the list
 * costs the couple a message; a supplier wrongly hidden costs them a supplier
 * who could have said yes.
 */
export async function findSuppliersWithNoBookingLeft(args: {
  admin: SupabaseClient;
  supplierIds: readonly string[];
  canonicals: readonly string[];
  eventDate: string | null;
  eventDatePrecision: string | null;
}): Promise<Set<string>> {
  const days = unbookableDateScope(args.eventDate, args.eventDatePrecision);
  if (!days || args.supplierIds.length === 0 || args.canonicals.length === 0) return new Set();

  try {
    const { data: cardRows, error: cardErr } = await args.admin
      .from('vendor_services')
      .select('vendor_service_id, vendor_profile_id')
      .in('vendor_profile_id', args.supplierIds as string[])
      .in('category', args.canonicals as string[])
      .eq('is_active', true)
      .eq('is_linked_only', false);
    if (cardErr) {
      logQueryError('bench-bookable-days: cards', cardErr);
      return new Set();
    }
    const cardsBySupplier = new Map<string, string[]>();
    for (const r of (cardRows ?? []) as { vendor_service_id: string; vendor_profile_id: string }[]) {
      const list = cardsBySupplier.get(r.vendor_profile_id) ?? [];
      list.push(r.vendor_service_id);
      cardsBySupplier.set(r.vendor_profile_id, list);
    }
    const cards = [...cardsBySupplier.values()].flat();
    if (cards.length === 0) return new Set();

    const refused = new Set<string>();
    for (const batch of inBatches(cards, UNBOOKABLE_MAX_CARDS)) {
      const { data, error } = await args.admin.rpc('service_cards_unbookable_on', {
        p_service_ids: batch,
        p_dates: days,
        p_named_calendars: namedCalendarsEnabled(),
      });
      if (error) {
        logQueryError('bench-bookable-days: service_cards_unbookable_on', error);
        return new Set();
      }
      for (const r of (data ?? []) as { service_id: string | null; refused_on: string | null }[]) {
        if (r.service_id && r.refused_on) refused.add(refusalKey(r.service_id, r.refused_on));
      }
    }
    return suppliersWithNoBookingLeft(cardsBySupplier, refused, days);
  } catch {
    return new Set();
  }
}
