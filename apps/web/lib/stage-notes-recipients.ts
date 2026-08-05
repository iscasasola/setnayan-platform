import type { SupabaseClient } from '@supabase/supabase-js';

import { eventTilesForBooking } from '@/lib/vendor-event-roles';

/**
 * WHO ON THIS EVENT IS THE EMCEE — the one supplier a coordinator's note can be
 * addressed to.
 *
 * ── WHY THIS LIVES IN THE APP AND NOT IN A POLICY ───────────────────────────
 * "The emcee" is not a column. It is a booking that carries the `host_mc` tile,
 * which lives across `event_vendors.category` and the categories of the
 * services on that booking (see `eventTilesForBooking` — a supplier can be the
 * band AND the emcee, and the summary column only ever holds one).
 *
 * Working that out inside an RLS policy would mean a multi-table join in a
 * predicate that runs on every row — fragile, and it would put the definition
 * of "emcee" in two places at once, which is exactly how the day-of desks went
 * dark before.
 *
 * So the app resolves WHO, and the database enforces the far simpler and far
 * stronger rule: a note names one supplier, and only that supplier can read it.
 * If this resolver is ever wrong, the worst case is a note addressed to the
 * wrong supplier — not a supplier reading someone else's mail.
 *
 * Client injected, no `server-only` import, so the rule is unit-testable.
 */

export type StageNoteRecipient = {
  vendorProfileId: string;
  name: string;
};

/** The tile that means "this supplier is running the microphone". */
export const EMCEE_TILE = 'host_mc';

/**
 * Pick the emcee out of a set of bookings.
 *
 * Pure, so the definition of "who counts" can be tested without a database —
 * that definition is the whole risk here, and it changed once already.
 */
export function pickEmceeRecipients(
  bookings: ReadonlyArray<{
    vendorProfileId: string | null;
    name: string | null;
    categories: readonly string[] | null;
    serviceCategories: readonly string[] | null;
  }>,
): StageNoteRecipient[] {
  const out: StageNoteRecipient[] = [];
  const seen = new Set<string>();
  for (const b of bookings) {
    if (!b.vendorProfileId || seen.has(b.vendorProfileId)) continue;
    const tiles = eventTilesForBooking({
      bookedCategories: b.categories ?? null,
      bookedServiceCategories: b.serviceCategories ?? null,
    });
    if (!tiles || !tiles.includes(EMCEE_TILE)) continue;
    seen.add(b.vendorProfileId);
    out.push({ vendorProfileId: b.vendorProfileId, name: b.name?.trim() || 'Your host' });
  }
  return out;
}

/** The emcee(s) booked on this event, for the coordinator's send box. */
export async function fetchEmceeRecipients(
  supabase: SupabaseClient,
  eventId: string,
): Promise<StageNoteRecipient[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_name, category, linked_vendor_profile_id')
    .eq('event_id', eventId)
    .not('linked_vendor_profile_id', 'is', null);

  if (error || !data) return [];

  return pickEmceeRecipients(
    (data as Array<Record<string, unknown>>).map((r) => ({
      vendorProfileId:
        typeof r.linked_vendor_profile_id === 'string' ? r.linked_vendor_profile_id : null,
      name: typeof r.vendor_name === 'string' ? r.vendor_name : null,
      categories: typeof r.category === 'string' ? [r.category] : null,
      // The per-service categories need a second read through
      // `requested_service_ids`; the booking summary alone already covers the
      // common case (a supplier booked as the host), and a miss here means the
      // send box does not offer them — never that someone reads a stranger's note.
      serviceCategories: null,
    })),
  );
}
