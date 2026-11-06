import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterFavoritableVendorIds } from '@/lib/vendor-favorite-gate';
import { hydrateVendorCards } from '@/lib/vendor-cards';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { resolveProfile } from '@/lib/event-type-profile';
import { readServiceLabels, serviceLabelOf } from '@/lib/service-labels';
import { manilaToday } from '@/lib/provisional-approval';
import { readBookedServices, readCheckedInEvents, readHostedEvents, readServiceNames } from '@/lib/favorites.server';
import {
  collapseFavorites,
  favoriteHref,
  favoriteSourceDetail,
  favoriteSourceLine,
  moreEventsFor,
  type BookedService,
  type FavoriteRow,
  type FavoriteSource,
} from '@/lib/favorites';

/** One row of Library › Suppliers › Favorites (prototype §G). */
export type FavoriteListRow = {
  shopId: string;
  serviceId: string | null;
  name: string;
  logoUrl: string | null;
  /** "Mobile bar" — the service, else the shop's category. */
  line: string | null;
  /** "From your wedding · Dec 2026" · "From Maria & Jose’s wedding · you were a guest" (+ "· and 1 more event"). */
  from: string | null;
  /** The ⓘ's line: "From your wedding · 12 Dec 2026 · you were a host". */
  detail: string | null;
  /** The shop page at that service; null while the shop has no public page. */
  href: string | null;
};

/**
 * Library · FAVORITES — the services this person keeps from events they hosted or attended
 * (`guest_saved_vendors`, owner 2026-11-06 "Favorites after an event"). One row per shop + service
 * (`collapseFavorites`); each says where it came from, host or guest decided HERE at read time (does this person host
 * the favorite's event?). Distinct from `fetchSavedVendors` (the shortlists inside their own plans).
 *
 * Cross-event linkage gate (RA 10173): this read deliberately spans ALL of the person's events, so it is fenced
 * behind the `cross_event_vendor_recall` data-privacy control. Fail-closed — when the control isn't Active, the list
 * returns nothing. The subscription gate (`filterFavoritableVendorIds`, flag default OFF) still hides a lapsed shop.
 *
 * Returns NULL when the favorites themselves could not be read — the tab then says so, never "No favorites yet".
 */
export async function fetchAttendedSavedVendors(): Promise<FavoriteListRow[] | null> {
  if (!(await isDataPrivacyControlActive('cross_event_vendor_recall'))) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: raw, error } = await supabase
    .from('guest_saved_vendors')
    .select('id, vendor_profile_id, vendor_service_id, source_event_id, saved_at')
    .order('saved_at', { ascending: false });
  if (error) {
    console.error('[supabase-error] library/_data/attended-vendors.ts · from:guest_saved_vendors.select', error);
    return null;
  }
  if (!raw || raw.length === 0) return [];

  const rows: FavoriteRow[] = (raw as {
    id: number;
    vendor_profile_id: string;
    vendor_service_id: string | null;
    source_event_id: string | null;
    saved_at: string;
  }[]).map((r) => ({
    id: r.id,
    shopId: r.vendor_profile_id,
    serviceId: r.vendor_service_id ?? null,
    sourceEventId: r.source_event_id ?? null,
    savedAt: r.saved_at,
  }));

  const admin = createAdminClient();
  const favoritable = await filterFavoritableVendorIds(admin, [...new Set(rows.map((r) => r.shopId))]);
  const favorites = collapseFavorites(rows.filter((r) => favoritable.has(r.shopId)));
  if (favorites.length === 0) return [];

  const shopIds = [...new Set(favorites.map((f) => f.shopId))];
  const serviceIds = favorites.map((f) => f.serviceId).filter((s): s is string => Boolean(s));
  const sourceIds = [...new Set(favorites.map((f) => f.sourceEventId).filter((e): e is string => Boolean(e)))];

  const [cards, labels, hosted, checked, sources] = await Promise.all([
    hydrateVendorCards(shopIds),
    serviceIds.length ? readServiceLabels() : Promise.resolve({} as Record<string, string>),
    readHostedEvents(admin, user.id, null),
    readCheckedInEvents(admin, user.id, null),
    sourceIds.length
      ? admin.from('events').select('event_id, display_name, event_type, event_date').in('event_id', sourceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const names = await readServiceNames(admin, serviceIds, labels, serviceLabelOf);

  // "and N more": every OTHER event this person experienced the same service at — hosted with the day behind, or
  // checked in at the door — and the service booked there. A refused read leaves the count at 0 (never invented).
  const today = manilaToday();
  const experiencedEvents = new Set<string>(checked ?? []);
  for (const [id, date] of hosted ?? []) if (date && date.slice(0, 10) < today) experiencedEvents.add(id);
  const booked = await readBookedServices(admin, [...experiencedEvents]);
  const experienced = [...(booked ?? new Map<string, BookedService[]>()).entries()].flatMap(([eventId, list]) =>
    list.map((b) => ({ eventId, shopId: b.shopId, serviceId: b.serviceId })),
  );

  if (sources.error) console.error('[supabase-error] library/_data/attended-vendors.ts · from:events.select', sources.error);
  const eventRows = new Map(
    ((sources.data ?? []) as { event_id: string; display_name: string | null; event_type: string | null; event_date: string | null }[]).map(
      (e) => [e.event_id, e],
    ),
  );
  const words = new Map<string, string | null>();
  await Promise.all(
    [...new Set([...eventRows.values()].map((e) => e.event_type ?? 'wedding'))].map(async (t) => {
      try {
        words.set(t, (await resolveProfile(t)).terminology?.eventWord ?? null);
      } catch {
        words.set(t, null);
      }
    }),
  );

  return favorites.flatMap((f) => {
    const card = cards.get(f.shopId);
    if (!card) return [];
    const service = f.serviceId ? names.get(f.serviceId) ?? null : null;
    const ev = f.sourceEventId ? eventRows.get(f.sourceEventId) ?? null : null;
    // Host or guest, decided now: does this person host the favorite's event? (A refused read says nothing.)
    const source: FavoriteSource | null =
      ev && hosted
        ? {
            role: hosted.has(ev.event_id) ? 'host' : 'guest',
            hostsName: ev.display_name,
            eventWord: words.get(ev.event_type ?? 'wedding') ?? null,
            eventDate: ev.event_date,
            moreEvents: moreEventsFor(f, experienced),
          }
        : null;
    return [
      {
        shopId: f.shopId,
        serviceId: f.serviceId,
        name: card.displayName,
        logoUrl: card.logoUrl,
        line: service?.label || card.categoryLabel,
        from: source ? favoriteSourceLine(source) : null,
        detail: source ? favoriteSourceDetail(source) : null,
        href: favoriteHref(card.businessSlug, service?.publicId ?? null),
      },
    ];
  });
}
