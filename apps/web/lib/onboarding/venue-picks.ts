/**
 * venue-picks.ts — what the wedding onboarding's "We already have our venue"
 * answers hold, and how each one is written (Lane 2).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "THE EVENT HUB FOLLOWS THE LOCKED VENUES"
 * and the controller's answers on the lanes):
 *   · a venue PICKED FROM THE LIST is shortlisted as "considering" — the LOCK
 *     stays a Your Team action (the lock books a time slot and may collect a
 *     booking fee; onboarding never sends or takes one);
 *   · "Add it yourself" (name · pin · city) is the couple's own venue and is
 *     LOCKED at once — the same direct lock an off-platform supplier gets in
 *     Your Team (`status` contracted, no counterparty to ask), with NO contact
 *     required (migration 20271259075750) — Your Team shows "Add contact";
 *   · "I'll pick later" / "My supplier will fill this in" write nothing.
 *
 * Pure and client-safe. The server writer is `own-venue-rows` below + the
 * wedding commit; nothing here touches a database.
 */

export type VenueRole = 'parish' | 'reception';

export type VenuePick =
  | {
      kind: 'listed';
      vendorId: string;
      name: string;
      city: string | null;
      lat: number | null;
      lng: number | null;
      /** The couple's candidate dates this supplier is not marked busy on. */
      freeDates: string[];
    }
  | {
      kind: 'own';
      name: string;
      /** The couple's "City or area" (a curated city's label). */
      city: string;
      lat: number | null;
      lng: number | null;
    }
  | { kind: 'later' }
  | { kind: 'supplier' };

export type VenueAnswers = {
  /** "We already have our venue" is open — the Area ▾ is not asked then. */
  open: boolean;
  parish: VenuePick | null;
  reception: VenuePick | null;
};

export const EMPTY_VENUES: VenueAnswers = { open: false, parish: null, reception: null };

/** The `event_vendors.category` each role is written under (the plan groups' own). */
export const VENUE_CATEGORY: Record<VenueRole, 'religious_venue' | 'venue'> = {
  parish: 'religious_venue',
  reception: 'venue',
};

export const OWN_VENUE_NAME_MAX = 128;
export const OWN_VENUE_CITY_MAX = 200;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** BOTH or NEITHER — the table's CHECK refuses half a coordinate. */
export function cleanPin(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (!finite(lat) || !finite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** The picks that go to the server shortlist (`event_vendors` 'considering'). */
export function shortlistFromVenues(v: VenueAnswers): Array<{ vendorId: string; name: string; category: 'religious_venue' | 'venue' }> {
  const out: Array<{ vendorId: string; name: string; category: 'religious_venue' | 'venue' }> = [];
  for (const role of ['parish', 'reception'] as const) {
    const p = v[role];
    if (p?.kind === 'listed') out.push({ vendorId: p.vendorId, name: p.name, category: VENUE_CATEGORY[role] });
  }
  return out;
}

export type OwnVenue = {
  role: VenueRole;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
};

/** The couple's own venues, cleaned — a nameless one is no venue. */
export function ownVenuesFromVenues(v: VenueAnswers): OwnVenue[] {
  const out: OwnVenue[] = [];
  for (const role of ['parish', 'reception'] as const) {
    const p = v[role];
    if (p?.kind !== 'own') continue;
    const name = p.name.trim().slice(0, OWN_VENUE_NAME_MAX);
    if (!name) continue;
    const pin = cleanPin(p.lat, p.lng);
    out.push({ role, name, city: p.city.trim().slice(0, OWN_VENUE_CITY_MAX), lat: pin?.lat ?? null, lng: pin?.lng ?? null });
  }
  return out;
}

/**
 * The rows an own venue becomes. `event_manual_vendors` carries NO contact (it is
 * optional now); `event_vendors` is the direct lock Your Team gives an
 * off-platform supplier: `contracted`, rank 1, nobody to ask.
 * The address is what the couple actually told us — their city or area; the pin
 * is the exact place.
 */
export function ownVenueRows(
  venue: OwnVenue,
  ids: { eventId: string; userId: string },
): {
  manual: Record<string, unknown>;
  vendor: (manualVendorId: string) => Record<string, unknown>;
} {
  return {
    manual: {
      event_id: ids.eventId,
      business_name: venue.name,
      address: venue.city || null,
      address_latitude: venue.lat,
      address_longitude: venue.lng,
      created_by_user_id: ids.userId,
    },
    vendor: (manualVendorId: string) => ({
      event_id: ids.eventId,
      category: VENUE_CATEGORY[venue.role],
      vendor_name: venue.name,
      manual_vendor_id: manualVendorId,
      status: 'contracted',
      selection_match_rank: 1,
      linked_vendor_profile_id: null,
      source: 'host_manual',
    }),
  };
}

/**
 * The candidate dates once the listed picks are applied: each listed venue
 * keeps only the dates it is not marked busy on (parish, then reception — the
 * chain). An own venue, "later" and "my supplier" never narrow (we know nothing
 * about their calendar). Never narrows to nothing: see `narrowDates`.
 */
export function narrowedByVenues(candidates: readonly string[], v: VenueAnswers): string[] {
  let dates = [...candidates];
  for (const role of ['parish', 'reception'] as const) {
    const p = v[role];
    if (p?.kind !== 'listed') continue;
    const kept = dates.filter((d) => p.freeDates.includes(d));
    if (kept.length > 0) dates = kept;
  }
  return dates;
}
