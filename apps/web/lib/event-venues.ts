/**
 * apps/web/lib/event-venues.ts
 *
 * A WEDDING HAS TWO VENUES — AND THE EVENT HUB READ ONE.
 *
 * Owner, 2026-09-03 (DECISION_LOG "A WEDDING HAS TWO VENUES"): *"venue is 2.
 * ceremony and reception"*. The schema caught up that day; the Event Hub did
 * not. It kept reading ONE venue off `events.venue_name / venue_address /
 * venue_latitude / venue_longitude`, so on 2026-09-27 the owner's own event
 * (`cale-ice`) — a church booked as the ceremony and a hotel booked as the
 * reception, both contracted — drew "Add your venue." in the Venue scene,
 * days before its invitations went out. Both venues were sitting in
 * `event_vendors` the whole time.
 *
 * THIS FILE IS THE ONE ANSWER to "where is this event?" for the Event Hub:
 *
 *   • CEREMONY  = the confirmed, un-archived `ceremony_venue` booking
 *                 (category `religious_venue` / `church_fees`), else the
 *                 couple's typed Save-the-Date ceremony name (name only).
 *   • RECEPTION = the confirmed, un-archived `reception_venue` booking
 *                 (category `venue`), else the event's own venue columns.
 *   • The same place twice is ONE venue, labelled "Ceremony & Reception".
 *
 * A booking's address and pin come from where the couple (or the directory, or
 * the supplier) recorded them — `event_manual_vendors` for a supplier added by
 * hand, `venue_directory` for a directory pick, `vendor_profiles.hq_*` for a
 * supplier on the platform. Nothing is geocoded, nothing is invented.
 *
 * ⛔ AN EVENT PIN IS NEVER BORROWED BY A BOOKING. `events.venue_latitude` is a
 * "first-saved-wins" anchor (its column comment says so): it can belong to a
 * venue the couple saved and then did not book. Laying it under a booking that
 * has no pin of its own would route guests to a real, wrong place — worse than
 * a directions search by name, which is what a pin-less booking gets.
 *
 * 🔒 THIS FILE DOES NOT DECIDE WHO SEES THE ADDRESS. `lib/venue-disclosure.ts`
 * does (`withheldVenue` closes the address and pin of every venue in the list,
 * exactly as it closes the event's own). The names stay visible under the same
 * rule that has always kept `venue_name` visible.
 *
 * Also the source of the Save-the-Date's finalized venue NAMES
 * (`lib/std-venues.ts` now reads its answer from here), so the film, the
 * prints and the Event Hub cannot name different places.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';

/** `event_vendors.category` values that are the CEREMONY venue
 *  (`hard_single_group = 'ceremony_venue'`). */
export const CEREMONY_VENUE_CATEGORIES = ['religious_venue', 'church_fees'] as const;
/** `event_vendors.category` value that is the RECEPTION venue
 *  (`hard_single_group = 'reception_venue'`). */
export const RECEPTION_VENUE_CATEGORY = 'venue';

export type VenueRole = 'ceremony' | 'reception' | 'both';

/** One place a guest goes to. Every field but `role` may be absent. */
export type EventVenue = {
  role: VenueRole;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** What the guest reads above each venue. */
export const VENUE_ROLE_LABEL: Record<VenueRole, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  both: 'Ceremony & Reception',
};

/** A booked venue, resolved to what a guest needs. */
export type VenueBooking = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Identity of the underlying place, for "is it the same venue twice". */
  placeKey: string | null;
};

export type VenueBookings = { ceremony: VenueBooking | null; reception: VenueBooking | null };

/** One `event_vendors` row, joined to wherever its location lives. */
export type VenueBookingRow = {
  category: string | null;
  status: string | null;
  vendor_name: string | null;
  updated_at: string | null;
  archived_at?: string | null;
  manual_vendor_id?: string | null;
  source_venue_directory_id?: string | null;
  marketplace_vendor_id?: string | null;
  linked_vendor_profile_id?: string | null;
};

/** A recorded location (manual supplier · directory · supplier profile). */
export type PlaceRecord = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PlaceLookup = {
  manual?: ReadonlyMap<string, PlaceRecord>;
  directory?: ReadonlyMap<string, PlaceRecord>;
  profile?: ReadonlyMap<string, PlaceRecord>;
};

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim();
  return t ? t : null;
};

/** A coordinate as a finite number, or null. NUMERIC may arrive as a string. */
export function coord(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Both halves of a pin, or neither — half a coordinate is not a location. */
function pin(lat: unknown, lng: unknown): { latitude: number | null; longitude: number | null } {
  const la = coord(lat);
  const lo = coord(lng);
  return la != null && lo != null ? { latitude: la, longitude: lo } : { latitude: null, longitude: null };
}

function isCeremony(category: string | null): boolean {
  return category != null && (CEREMONY_VENUE_CATEGORIES as readonly string[]).includes(category);
}
function isReception(category: string | null): boolean {
  return category === RECEPTION_VENUE_CATEGORY;
}

/** Where a booking's location is recorded, most specific first. */
function placeOf(row: VenueBookingRow, places: PlaceLookup): { rec: PlaceRecord | null; key: string | null } {
  const tries: [string | null | undefined, ReadonlyMap<string, PlaceRecord> | undefined, string][] = [
    [row.manual_vendor_id, places.manual, 'm'],
    [row.source_venue_directory_id, places.directory, 'd'],
    [row.marketplace_vendor_id, places.profile, 'p'],
    [row.linked_vendor_profile_id, places.profile, 'p'],
  ];
  let key: string | null = null;
  for (const [id, map, tag] of tries) {
    if (!id) continue;
    key ??= `${tag}:${id}`;
    const rec = map?.get(id);
    if (rec && (clean(rec.address) || (coord(rec.latitude) != null && coord(rec.longitude) != null))) {
      return { rec, key: `${tag}:${id}` };
    }
  }
  return { rec: null, key };
}

/** The winning ceremony + reception rows (see {@link pickVenueBookings}). */
export function pickVenueBookingRows(rows: readonly VenueBookingRow[]): {
  ceremony: VenueBookingRow | null;
  reception: VenueBookingRow | null;
} {
  const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as unknown as string[]);
  const live = rows.filter(
    (r) => !r.archived_at && r.status != null && confirmed.has(r.status) && clean(r.vendor_name),
  );
  const pick = (match: (c: string | null) => boolean): VenueBookingRow | null =>
    live
      .filter((r) => match(r.category))
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))[0] ?? null;
  return { ceremony: pick(isCeremony), reception: pick(isReception) };
}

/**
 * Pick the ceremony and reception bookings out of an event's `event_vendors`
 * rows. Only a CONFIRMED status (contracted and later) counts — a supplier the
 * couple is still considering is not where the wedding is — and an archived row
 * never counts. Most-recently-updated wins if a couple somehow holds two.
 */
export function pickVenueBookings(
  rows: readonly VenueBookingRow[],
  places: PlaceLookup = {},
): VenueBookings {
  const won = pickVenueBookingRows(rows);
  const toBooking = (row: VenueBookingRow | null): VenueBooking | null => {
    if (!row) return null;
    const { rec, key } = placeOf(row, places);
    return {
      name: clean(row.vendor_name)!,
      address: clean(rec?.address),
      ...pin(rec?.latitude, rec?.longitude),
      placeKey: key,
    };
  };
  return { ceremony: toBooking(won.ceremony), reception: toBooking(won.reception) };
}

/** The event columns the fallback reads. */
export type EventVenueColumns = {
  venue_name?: string | null;
  venue_address?: string | null;
  venue_latitude?: number | string | null;
  venue_longitude?: number | string | null;
  std_film_ceremony_name?: string | null;
  std_film_venue_name?: string | null;
};

const norm = (s: string | null) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Roughly the same spot (≈ 150 m) — a ceremony in the hotel's own chapel. */
function nearby(a: EventVenue, b: EventVenue): boolean {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return false;
  return Math.abs(a.latitude - b.latitude) < 0.0014 && Math.abs(a.longitude - b.longitude) < 0.0014;
}

/** Is this the same place twice? Same record, same name, or the same pin. */
export function sameVenue(
  a: EventVenue & { placeKey?: string | null },
  b: EventVenue & { placeKey?: string | null },
): boolean {
  if (a.placeKey && b.placeKey && a.placeKey === b.placeKey) return true;
  const na = norm(a.name);
  if (na && na === norm(b.name)) return true;
  return nearby(a, b);
}

/**
 * THE RESOLVER. The event's venues, in the order a guest goes to them:
 * ceremony, then reception — or one entry when they are the same place.
 * Empty when nothing names or locates a venue; never a placeholder.
 */
export function resolveEventVenues(bookings: VenueBookings, event: EventVenueColumns): EventVenue[] {
  const ceremony: (EventVenue & { placeKey?: string | null }) | null = bookings.ceremony
    ? { role: 'ceremony', ...bookings.ceremony }
    : clean(event.std_film_ceremony_name)
      ? { role: 'ceremony', name: clean(event.std_film_ceremony_name), address: null, latitude: null, longitude: null }
      : null;

  let reception: (EventVenue & { placeKey?: string | null }) | null = null;
  if (bookings.reception) {
    reception = { role: 'reception', ...bookings.reception };
  } else {
    const p = pin(event.venue_latitude, event.venue_longitude);
    const name = clean(event.venue_name) ?? clean(event.std_film_venue_name);
    const address = clean(event.venue_address);
    if (name || address || p.latitude != null) reception = { role: 'reception', name, address, ...p };
  }

  const strip = (v: EventVenue & { placeKey?: string | null }): EventVenue => ({
    role: v.role,
    name: v.name,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
  });

  // The event row's one venue, with nothing saying where the ceremony is, keeps
  // the label every event carried before this file existed ("Ceremony &
  // Reception"). A BOOKED reception is only ever labelled the reception.
  if (!ceremony && reception && !bookings.reception) return [{ ...strip(reception), role: 'both' }];

  if (ceremony && reception && sameVenue(ceremony, reception)) {
    // One place: keep whichever knows more about where it is.
    const richer = (v: EventVenue) => (v.latitude != null ? 2 : 0) + (v.address ? 1 : 0);
    const best = richer(reception) > richer(ceremony) ? reception : ceremony;
    return [{ ...strip(best), role: 'both', name: ceremony.name ?? reception.name }];
  }
  return [ceremony, reception].filter((v): v is EventVenue & { placeKey?: string | null } => v != null).map(strip);
}

/** Every venue's name on one line — "Santuario … · Seda Vertis North". */
export function venueNamesLine(
  event: { venues?: readonly EventVenue[] | null; venue_name?: string | null },
  separator = ' · ',
): string | null {
  const names = (event.venues ?? []).map((v) => clean(v.name)).filter((n): n is string => Boolean(n));
  if (names.length) return names.join(separator);
  return clean(event.venue_name);
}

/**
 * What a maps app should search for when a venue has no pin: its name and its
 * address together (a name alone finds the building; an address alone can land
 * on the wrong gate). Null when there is nothing to search for.
 */
export function venueSearchQuery(v: Pick<EventVenue, 'name' | 'address'>): string | null {
  const parts = [clean(v.name), clean(v.address)].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(', ') : null;
}

/** The first place a guest goes (the ceremony when there is one). */
export function firstVenue(event: { venues?: readonly EventVenue[] | null }): EventVenue | null {
  return event.venues?.[0] ?? null;
}

/** Where the guests dine — the reception (or the one shared venue). */
export function receptionVenue(event: { venues?: readonly EventVenue[] | null }): EventVenue | null {
  return (event.venues ?? []).find((v) => v.role === 'reception' || v.role === 'both') ?? null;
}

// ─── I/O ────────────────────────────────────────────────────────────────────

/**
 * Read the confirmed ceremony + reception bookings and the address / pin each
 * one has on record. Service-role read: the Event Hub renders for guests who
 * hold no RLS on `event_vendors`. SELECTS ONLY name, category, status and the
 * location columns — a supplier's contact details, price and notes never leave
 * the database on this path.
 *
 * Never throws. A refused read degrades to "no booking" (the event's own venue
 * columns then answer) and leaves its reason in the log.
 */
export async function loadVenueBookings(admin: SupabaseClient, eventId: string): Promise<VenueBookings> {
  const none: VenueBookings = { ceremony: null, reception: null };
  try {
    const { data, error } = await admin
      .from('event_vendors')
      .select(
        'category, status, vendor_name, updated_at, manual_vendor_id, source_venue_directory_id, marketplace_vendor_id, linked_vendor_profile_id',
      )
      .eq('event_id', eventId)
      .is('archived_at', null)
      .in('category', [...CEREMONY_VENUE_CATEGORIES, RECEPTION_VENUE_CATEGORY]);
    if (error) console.error('[supabase-error] lib/event-venues.ts · from:event_vendors.select', error);
    if (error || !data) return none;

    // Pick first, then look up the location of just the (at most two) winners.
    const rows = data as VenueBookingRow[];
    const won = pickVenueBookingRows(rows);
    const winners = [won.ceremony, won.reception].filter((r): r is VenueBookingRow => r != null);
    const ids = (f: (r: VenueBookingRow) => (string | null | undefined)[]) => [
      ...new Set(winners.flatMap(f).filter((x): x is string => Boolean(x))),
    ];
    const manualIds = ids((r) => [r.manual_vendor_id]);
    const dirIds = ids((r) => [r.source_venue_directory_id]);
    const profileIds = ids((r) => [r.marketplace_vendor_id, r.linked_vendor_profile_id]);

    const read = async (
      table: string,
      idCol: string,
      cols: string,
      idList: string[],
      map: (r: Record<string, unknown>) => PlaceRecord,
      scopeToEvent = false,
    ): Promise<Map<string, PlaceRecord>> => {
      const out = new Map<string, PlaceRecord>();
      if (!idList.length) return out;
      let q = admin.from(table).select(`${idCol}, ${cols}`).in(idCol, idList);
      if (scopeToEvent) q = q.eq('event_id', eventId);
      const { data: rs, error: e } = await q;
      if (e) console.error(`[supabase-error] lib/event-venues.ts · from:${table}.select`, e);
      for (const r of (rs ?? []) as unknown as Record<string, unknown>[]) out.set(String(r[idCol]), map(r));
      return out;
    };
    const hq = (r: Record<string, unknown>): PlaceRecord => ({
      address: (r.hq_address as string | null) ?? null,
      latitude: coord(r.hq_latitude),
      longitude: coord(r.hq_longitude),
    });
    const [manual, directory, profile] = await Promise.all([
      read(
        'event_manual_vendors',
        'manual_vendor_id',
        'address, address_latitude, address_longitude',
        manualIds,
        (r) => ({
          address: (r.address as string | null) ?? null,
          latitude: coord(r.address_latitude),
          longitude: coord(r.address_longitude),
        }),
        true,
      ),
      read('venue_directory', 'venue_directory_id', 'hq_address, hq_latitude, hq_longitude', dirIds, hq),
      read('vendor_profiles', 'vendor_profile_id', 'hq_address, hq_latitude, hq_longitude', profileIds, hq),
    ]);
    return pickVenueBookings(rows, { manual, directory, profile });
  } catch {
    return none;
  }
}
