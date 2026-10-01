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
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';
import { isPubliclyVisible } from '@/lib/vendor-visibility';

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
  /** 🏛📷 The picture on this venue's card, as a stored ref (`r2://…`): one of
   *  the booked supplier's public shop photos, or the couple's own upload
   *  (owner 2026-09-30). Absent/null = a clean text card. */
  photo?: string | null;
  /** That ref, signed for display — attached by the page's loader. */
  photoUrl?: string | null;
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
  /** The supplier's PUBLIC shop photos (`vendor_profiles.portfolio_r2_keys` of a
   *  publicly visible shop — what their shop page shows), first = the default.
   *  Empty for a supplier added by hand or picked from the directory. */
  photos?: readonly string[];
};

export type VenueBookings = {
  ceremony: VenueBooking | null;
  reception: VenueBooking | null;
  /** The bookings BEFORE the couple's "Enter your own" choice was applied —
   *  what the Maker's Venue panel offers as "Use the supplier's details". */
  offered?: { ceremony: VenueBooking | null; reception: VenueBooking | null };
  /** The couple's choices for each venue card (`venue_map` config), validated. */
  choices?: VenueChoices;
};

// ─── THE COUPLE'S CHOICE PER VENUE (owner 2026-09-30) ──────────────────────
//
// *"The venue will have their Photos that the guest can pick … derived from the
// supplier's account"* · *"same as the address"* · *"but if there is none, then
// we can upload it manually"* · *"so click on it. use supplier details. or input
// your data"*. Stored in the `venue_map` scene's own `config_json.venue` — no new
// table, no new column. Each venue card (ceremony · reception):
//
//   · `source`        'supplier' (default when a venue supplier is booked) or
//                     'own' — the couple's typed name and address answer instead
//                     (Details › Venues, `std_film_*_name` / `*_address`).
//                     Switching back never deletes what they typed.
//   · `supplierPhoto` the photo in 'supplier' mode: one of the supplier's public
//                     photos or the couple's own upload; `null` = no photo;
//                     absent = the supplier's first photo.
//   · `ownPhoto`      the photo in 'own' mode (their upload); absent/null = none.

export type VenueSlotKey = 'ceremony' | 'reception';
export type VenueSource = 'supplier' | 'own';
export type VenueChoice = {
  source?: VenueSource;
  supplierPhoto?: string | null;
  ownPhoto?: string | null;
};
export type VenueChoices = Partial<Record<VenueSlotKey, VenueChoice>>;

/** The key in the `venue_map` scene's `config_json` that holds the choices. */
export const VENUE_CHOICES_KEY = 'venue';

/**
 * Where the couple's own venue photo is uploaded: the Maker's scene-media folder
 * (`sceneBackgroundPathPrefix` in lib/scene-media-choices.ts — the same string,
 * spelled here so this file does not pull the canvas module into every page that
 * names a venue; `the-venue-cards-are-readable.test.ts` holds them equal).
 */
export function venuePhotoPathPrefix(eventId: string): string {
  return `events/${eventId}/scene-background`;
}

/** A ref the couple uploaded for THIS event, in the Maker's scene-media folder. */
export function isOwnVenuePhotoRef(ref: unknown, eventId: string): ref is string {
  return (
    typeof ref === 'string' &&
    ref.startsWith(`r2://${PUBLIC_R2_BUCKET}/${venuePhotoPathPrefix(eventId)}/`) &&
    !ref.includes('..') &&
    ref.length <= 512
  );
}

/**
 * The choices as stored, sanitized. An own photo outside this event's own
 * folder is dropped (a couple-writable bag must never name someone else's file);
 * a supplier photo is kept as a string here and checked against the supplier's
 * CURRENT public photos when it is shown (`venuePhotoFor`), so a photo the
 * supplier later removes simply stops showing.
 */
export function readVenueChoices(config: unknown, eventId: string): VenueChoices {
  const bag =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>)[VENUE_CHOICES_KEY]
      : null;
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) return {};
  const out: VenueChoices = {};
  for (const key of ['ceremony', 'reception'] as const) {
    const raw = (bag as Record<string, unknown>)[key];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const c: VenueChoice = {};
    if (r.source === 'supplier' || r.source === 'own') c.source = r.source;
    if (r.supplierPhoto === null) c.supplierPhoto = null;
    else if (typeof r.supplierPhoto === 'string' && r.supplierPhoto.length <= 512 && r.supplierPhoto.startsWith('r2://'))
      c.supplierPhoto = r.supplierPhoto;
    if (isOwnVenuePhotoRef(r.ownPhoto, eventId)) c.ownPhoto = r.ownPhoto;
    if (Object.keys(c).length) out[key] = c;
  }
  return out;
}

/** Is this venue card on the couple's own details? (`own` chosen, or nothing booked.) */
export function venueUsesOwnDetails(booking: VenueBooking | null, choice: VenueChoice | undefined): boolean {
  return !booking || choice?.source === 'own';
}

/**
 * The photo a venue card shows, as a stored ref — or null for a clean text card.
 * Trusts choices already checked by `applyVenueChoices`.
 *   · supplier mode: the chosen photo; `null` = none chosen; absent = the
 *     supplier's first public photo;
 *   · own mode: the couple's own upload, if any.
 */
export function venuePhotoFor(booking: VenueBooking | null, choice: VenueChoice | undefined): string | null {
  if (venueUsesOwnDetails(booking, choice)) return choice?.ownPhoto ?? null;
  if (choice?.supplierPhoto === null) return null;
  return choice?.supplierPhoto ?? booking!.photos?.[0] ?? null;
}

/**
 * The bookings a guest's page reads: a venue the couple set to "Enter your own"
 * drops its booking, so their typed name and address answer (everywhere this
 * file answers — the Event Hub, the film, the prints, the reminders). The
 * bookings as offered, and the choices, ride along for the Maker and for photos.
 *
 * 🔒 A chosen supplier photo survives only while it is STILL one of that
 * supplier's public photos (or the couple's own upload for this event): a photo
 * the supplier removes, or a shop that stops being public, stops showing — the
 * card falls back to the supplier's first photo, or to none.
 */
export function applyVenueChoices(
  bookings: { ceremony: VenueBooking | null; reception: VenueBooking | null },
  raw: VenueChoices,
  eventId: string,
): VenueBookings {
  const choices: VenueChoices = {};
  for (const key of ['ceremony', 'reception'] as const) {
    const c = raw[key];
    if (!c) continue;
    const next: VenueChoice = { ...c };
    const pick = c.supplierPhoto;
    if (typeof pick === 'string' && !(bookings[key]?.photos ?? []).includes(pick) && !isOwnVenuePhotoRef(pick, eventId)) {
      delete next.supplierPhoto;
    }
    if (c.ownPhoto != null && !isOwnVenuePhotoRef(c.ownPhoto, eventId)) delete next.ownPhoto;
    choices[key] = next;
  }
  return {
    ceremony: choices.ceremony?.source === 'own' ? null : bookings.ceremony,
    reception: choices.reception?.source === 'own' ? null : bookings.reception,
    offered: { ceremony: bookings.ceremony, reception: bookings.reception },
    choices,
  };
}

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
  /** Each platform supplier's PUBLIC shop photos, by `vendor_profile_id`. */
  photos: ReadonlyMap<string, readonly string[]> = new Map(),
): { ceremony: VenueBooking | null; reception: VenueBooking | null } {
  const won = pickVenueBookingRows(rows);
  const toBooking = (row: VenueBookingRow | null): VenueBooking | null => {
    if (!row) return null;
    const { rec, key } = placeOf(row, places);
    const profile = row.marketplace_vendor_id ?? row.linked_vendor_profile_id ?? null;
    return {
      name: clean(row.vendor_name)!,
      address: clean(rec?.address),
      ...pin(rec?.latitude, rec?.longitude),
      placeKey: key,
      photos: (profile ? photos.get(profile) : undefined) ?? [],
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
  /** The ceremony's typed street address (owner 2026-09-29, "yes to all 4";
   *  migration 20271252997367). Used only when no ceremony is booked. */
  ceremony_venue_address?: string | null;
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
  // 🏛📷 Each card's picture (owner 2026-09-30) — the supplier's, the couple's
  // own, or none. Decided per slot BEFORE the merge below, so "one place" keeps
  // whichever photo it had.
  const choices = bookings.choices ?? {};
  const ceremonyPhoto = venuePhotoFor(bookings.ceremony, choices.ceremony);
  const receptionPhoto = venuePhotoFor(bookings.reception, choices.reception);

  const ceremony: (EventVenue & { placeKey?: string | null }) | null = bookings.ceremony
    ? { role: 'ceremony', ...bookings.ceremony, photo: ceremonyPhoto }
    : clean(event.std_film_ceremony_name) || clean(event.ceremony_venue_address)
      ? {
          role: 'ceremony',
          name: clean(event.std_film_ceremony_name),
          // 🏠 The couple's typed street address (Details › Venues) — maps and
          // directions search it with the name (`venueSearchQuery`).
          address: clean(event.ceremony_venue_address),
          latitude: null,
          longitude: null,
          photo: ceremonyPhoto,
        }
      : null;

  let reception: (EventVenue & { placeKey?: string | null }) | null = null;
  if (bookings.reception) {
    reception = { role: 'reception', ...bookings.reception, photo: receptionPhoto };
  } else {
    const p = pin(event.venue_latitude, event.venue_longitude);
    const name = clean(event.venue_name) ?? clean(event.std_film_venue_name);
    const address = clean(event.venue_address);
    if (name || address || p.latitude != null) reception = { role: 'reception', name, address, ...p, photo: receptionPhoto };
  }

  const strip = (v: EventVenue & { placeKey?: string | null }): EventVenue => ({
    role: v.role,
    name: v.name,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
    ...(v.photo ? { photo: v.photo } : {}),
  });

  // The event row's one venue, with nothing saying where the ceremony is, keeps
  // the label every event carried before this file existed ("Ceremony &
  // Reception"). A BOOKED reception is only ever labelled the reception.
  if (!ceremony && reception && !bookings.reception) return [{ ...strip(reception), role: 'both' }];

  if (ceremony && reception && sameVenue(ceremony, reception)) {
    // One place: keep whichever knows more about where it is.
    const richer = (v: EventVenue) => (v.latitude != null ? 2 : 0) + (v.address ? 1 : 0);
    const best = richer(reception) > richer(ceremony) ? reception : ceremony;
    return [
      {
        ...strip(best),
        role: 'both',
        name: ceremony.name ?? reception.name,
        ...((best.photo ?? (best === reception ? ceremony.photo : reception.photo))
          ? { photo: best.photo ?? (best === reception ? ceremony.photo : reception.photo) }
          : {}),
      },
    ];
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
    // 🏛📷 The couple's per-venue choices live in the Venue scene's own config.
    // Read beside the bookings; a refused read means "no choices" (the defaults:
    // the supplier's details and first photo) and is logged, never thrown.
    const choicesRead = (async (): Promise<VenueChoices> => {
      const { data: ws, error: we } = await admin
        .from('invitation_widgets')
        .select('config_json')
        .eq('event_id', eventId)
        .eq('widget_type', 'venue_map')
        .limit(1);
      if (we) console.error('[supabase-error] lib/event-venues.ts · from:invitation_widgets.select', we);
      return readVenueChoices((ws as { config_json?: unknown }[] | null)?.[0]?.config_json ?? null, eventId);
    })().catch((): VenueChoices => ({}));
    const { data, error } = await admin
      .from('event_vendors')
      .select(
        'category, status, vendor_name, updated_at, manual_vendor_id, source_venue_directory_id, marketplace_vendor_id, linked_vendor_profile_id',
      )
      .eq('event_id', eventId)
      .is('archived_at', null)
      .in('category', [...CEREMONY_VENUE_CATEGORIES, RECEPTION_VENUE_CATEGORY]);
    if (error) console.error('[supabase-error] lib/event-venues.ts · from:event_vendors.select', error);
    if (error || !data) return applyVenueChoices(none, await choicesRead, eventId);

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
    // The supplier's PUBLIC shop photos — the portfolio their shop page shows
    // (`app/v/[slug]/page.tsx`: first 12 of `portfolio_r2_keys`), only while the
    // shop is publicly visible (`isPubliclyVisible`, the shop page's own gate).
    const photosRead = (async (): Promise<Map<string, string[]>> => {
      const out = new Map<string, string[]>();
      if (!profileIds.length) return out;
      const { data: ps, error: pe } = await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, portfolio_r2_keys, public_visibility')
        .in('vendor_profile_id', profileIds);
      if (pe) console.error('[supabase-error] lib/event-venues.ts · from:vendor_profiles.select(photos)', pe);
      for (const r of (ps ?? []) as { vendor_profile_id: string; portfolio_r2_keys: unknown; public_visibility: unknown }[]) {
        if (!isPubliclyVisible(r.public_visibility as Parameters<typeof isPubliclyVisible>[0])) continue;
        const keys = Array.isArray(r.portfolio_r2_keys)
          ? r.portfolio_r2_keys.filter((k): k is string => typeof k === 'string' && k.startsWith('r2://')).slice(0, 12)
          : [];
        out.set(String(r.vendor_profile_id), keys);
      }
      return out;
    })();
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
    const [photos, choices] = await Promise.all([photosRead, choicesRead]);
    return applyVenueChoices(pickVenueBookings(rows, { manual, directory, profile }, photos), choices, eventId);
  } catch {
    return none;
  }
}
