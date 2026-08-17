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

/**
 * The emcee(s) booked on this event, for the coordinator's send box.
 *
 * ── WHY A SECOND CLIENT ─────────────────────────────────────────────────────
 * This used to hardcode `serviceCategories: null`, so the answer came from
 * `event_vendors.category` alone — ONE value on a row that can carry several
 * jobs. A band who also emcees, booked as a single package, summarised to
 * "band", never matched the host tile, and the whole "Tell the host" section
 * rendered nothing: a wedding with a host reading as a wedding with none.
 *
 * The per-service categories live on `vendor_services`, and that table's
 * SELECT policy is `is_active AND the shop is published`. So reading it through
 * the CALLER's client silently narrows again — a booked-but-unpublished shop
 * returns no rows and no error, which is the same empty value as "not the
 * emcee". `event_vendors` has the mirror problem from the other side: its
 * SELECT policy admits the couple and event moderators, and nobody else.
 *
 * So the service read takes its own injected client. Callers pass the
 * service-role one, having already gated the surface. Nothing new is disclosed:
 * the only thing derived is whether a supplier the viewer is ALREADY looking at
 * is the host, and the database still enforces that a note names one supplier
 * and only that supplier can read it.
 *
 * UNION-ONLY, so this can only ever ADD a recipient: if the service read fails
 * or returns nothing, the answer is exactly the booking summary — the behaviour
 * that shipped before.
 */
export async function fetchEmceeRecipients(
  supabase: SupabaseClient,
  eventId: string,
  /** Reader for `vendor_services`. Defaults to the caller's own client. */
  serviceReader?: SupabaseClient,
): Promise<StageNoteRecipient[]> {
  const { data, error } = await supabase
    .from('event_vendors')
    .select('vendor_name, category, linked_vendor_profile_id, requested_service_ids')
    .eq('event_id', eventId)
    .not('linked_vendor_profile_id', 'is', null);

  if (error || !data) return [];

  const rows = data as Array<Record<string, unknown>>;

  const serviceIdsOf = (r: Record<string, unknown>): string[] =>
    Array.isArray(r.requested_service_ids)
      ? (r.requested_service_ids as unknown[]).filter(
          (v): v is string => typeof v === 'string' && v.length > 0,
        )
      : [];

  // One read for every service on every booking, keyed back per row below.
  const allServiceIds = [...new Set(rows.flatMap(serviceIdsOf))];
  const categoryByServiceId = new Map<string, string>();
  if (allServiceIds.length > 0) {
    const { data: svc, error: svcErr } = await (serviceReader ?? supabase)
      .from('vendor_services')
      .select('vendor_service_id, category')
      .in('vendor_service_id', allServiceIds);
    // A failed read must not read as "no extra roles" any louder than it has
    // to — it already degrades to the summary category, which is the shipped
    // answer. Nothing here may narrow.
    if (!svcErr && svc) {
      for (const s of svc as Array<Record<string, unknown>>) {
        if (typeof s.vendor_service_id === 'string' && typeof s.category === 'string') {
          categoryByServiceId.set(s.vendor_service_id, s.category);
        }
      }
    }
  }

  return pickEmceeRecipients(
    rows.map((r) => {
      const svcCats = serviceIdsOf(r)
        .map((id) => categoryByServiceId.get(id))
        .filter((c): c is string => typeof c === 'string');
      return {
        vendorProfileId:
          typeof r.linked_vendor_profile_id === 'string' ? r.linked_vendor_profile_id : null,
        name: typeof r.vendor_name === 'string' ? r.vendor_name : null,
        categories: typeof r.category === 'string' ? [r.category] : null,
        // null, never [] — `eventTilesForBooking` treats an empty pair of
        // sources as "the event cannot say" and must not be handed a list that
        // merely failed to load.
        serviceCategories: svcCats.length > 0 ? svcCats : null,
      };
    }),
  );
}
