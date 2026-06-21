/**
 * Vendor-side schedule data — pools, blocks, bookings — shaped for the
 * /vendor-dashboard/calendar and /vendor-dashboard/clients surfaces.
 *
 * Model (owner lock 2026-06-12): one schedule pool per (vendor, leaf
 * category); merged categories share a pool; only BOOKED reservations and
 * external-client blocks consume capacity; manual blocks close dates.
 * The vendor's calendar renders one swimlane/tab per pool — the "new
 * category shows a new schedule" rule made visible.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export type SchedulePool = {
  poolId: string;
  label: string;
  capacity: number;
  categories: string[];
  /** Named Calendars (flag): the vendor-entered calendar name, null for an
   *  auto category pool not yet named. */
  calendarName: string | null;
  /** TRUE when the vendor explicitly created this calendar (vs an auto
   *  per-category pool). */
  isVendorCreated: boolean;
  /** vendor_service_ids explicitly assigned to this calendar (Named Calendars
   *  membership). Empty for a pure category pool. */
  serviceIds: string[];
};

/** A vendor service shaped for the calendar service-picker (Named Calendars). */
export type CalendarServiceOption = {
  serviceId: string;
  label: string;
  /** The calendar (pool) this service is currently assigned to, or null when
   *  it still falls back to its category pool. */
  poolId: string | null;
};

export type PoolBookingEntry = {
  poolBookingId: string;
  poolId: string;
  eventId: string;
  bookedDate: string; // YYYY-MM-DD
  eventName: string;
  threadId: string | null;
};

export type CalendarBlockEntry = {
  blockId: string;
  poolId: string | null; // null = org-wide
  source: 'manual' | 'setnayan_booking' | 'synced_calendar' | 'external_client';
  label: string;
  clientName: string | null;
  clientContact: string | null;
  clientNote: string | null;
  startDate: string; // YYYY-MM-DD (PH civil day)
  endDate: string;   // YYYY-MM-DD
};

/** PH civil date for a timestamptz ISO string. */
export function manilaDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function humanizeCategory(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The vendor's pools with their category mappings. Bootstraps missing pools
 * for every active service category + linked "comes with" category first
 * (lazy materialization — resolve_schedule_pool is owner-permitted), so a
 * vendor's first visit to the calendar shows every schedule they operate.
 */
export async function fetchVendorPools(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<SchedulePool[]> {
  // 1. Every category the catalog references (own + linked).
  const categories = new Set<string>();
  const [{ data: services }, { data: links }] = await Promise.all([
    supabase
      .from('vendor_services')
      .select('category')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true),
    supabase
      .from('vendor_service_links')
      .select('linked_canonical_service')
      .eq('vendor_profile_id', vendorProfileId),
  ]);
  for (const row of (services ?? []) as { category: string | null }[]) {
    if (row.category) categories.add(row.category);
  }
  for (const row of (links ?? []) as { linked_canonical_service: string | null }[]) {
    if (row.linked_canonical_service) categories.add(row.linked_canonical_service);
  }

  // 2. Bootstrap pools for unmapped categories (no-op when already mapped).
  const { data: mapped } = await supabase
    .from('vendor_schedule_pool_categories')
    .select('category_key, pool_id')
    .eq('vendor_profile_id', vendorProfileId);
  const mappedKeys = new Set(
    ((mapped ?? []) as { category_key: string }[]).map((m) => m.category_key),
  );
  for (const categoryKey of categories) {
    if (!mappedKeys.has(categoryKey)) {
      await supabase.rpc('resolve_schedule_pool', {
        p_vendor_profile_id: vendorProfileId,
        p_category_key: categoryKey,
      });
    }
  }

  // 3. Read back pools + mappings. Named Calendars (flag): also read the
  //    vendor-entered name, the vendor-created marker, and explicit
  //    service→calendar memberships.
  // LIVE by default (Phase A migration applied 2026-06-21); kill-switch
  // NEXT_PUBLIC_NAMED_CALENDARS_ENABLED=false reverts to category pools.
  const namedCalendars =
    process.env.NEXT_PUBLIC_NAMED_CALENDARS_ENABLED !== 'false';
  // Rollout contract: the Phase A migration (which adds calendar_name /
  // is_vendor_created / vendor_schedule_calendar_services) is applied BEFORE the
  // flag is flipped. So the new columns + membership table are read ONLY when the
  // flag is on — flag-off selects exactly today's columns and never touches the
  // new table, keeping the page safe on a pre-migration DB.
  const poolCols = namedCalendars
    ? 'pool_id, pool_label, calendar_name, is_vendor_created, daily_booking_capacity, is_active'
    : 'pool_id, pool_label, daily_booking_capacity, is_active';
  const [{ data: pools }, { data: cats }, { data: members }] = await Promise.all([
    supabase
      .from('vendor_schedule_pools')
      .select(poolCols)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_schedule_pool_categories')
      .select('category_key, pool_id')
      .eq('vendor_profile_id', vendorProfileId),
    // Membership read — flag-on only; soft-probe degrades to [] if the table is
    // somehow still absent.
    namedCalendars
      ? supabase
          .from('vendor_schedule_calendar_services')
          .select('vendor_service_id, pool_id')
          .eq('vendor_profile_id', vendorProfileId)
          .then((r) => (r.error ? { data: [] as { vendor_service_id: string; pool_id: string }[] } : r))
      : Promise.resolve({ data: [] as { vendor_service_id: string; pool_id: string }[] }),
  ]);

  const byPool = new Map<string, string[]>();
  for (const row of (cats ?? []) as { category_key: string; pool_id: string }[]) {
    const list = byPool.get(row.pool_id) ?? [];
    list.push(row.category_key);
    byPool.set(row.pool_id, list);
  }
  const servicesByPool = new Map<string, string[]>();
  for (const row of (members ?? []) as { vendor_service_id: string; pool_id: string }[]) {
    const list = servicesByPool.get(row.pool_id) ?? [];
    list.push(row.vendor_service_id);
    servicesByPool.set(row.pool_id, list);
  }

  return ((pools ?? []) as unknown as {
    pool_id: string;
    pool_label: string;
    calendar_name: string | null;
    is_vendor_created: boolean | null;
    daily_booking_capacity: number;
  }[])
    .map((p) => {
      const cats2 = (byPool.get(p.pool_id) ?? []).sort();
      const serviceIds = servicesByPool.get(p.pool_id) ?? [];
      const categoryLabel =
        cats2.length > 0
          ? cats2.map(humanizeCategory).join(' · ')
          : humanizeCategory(p.pool_label || 'Schedule');
      return {
        poolId: p.pool_id,
        // Named Calendars (flag on): the vendor's own name wins. Otherwise the
        // merged-category label ("Photo Video · Same Day Edit").
        label:
          namedCalendars && p.calendar_name && p.calendar_name.trim().length > 0
            ? p.calendar_name.trim()
            : categoryLabel,
        capacity: p.daily_booking_capacity,
        categories: cats2,
        calendarName: p.calendar_name ?? null,
        isVendorCreated: p.is_vendor_created === true,
        serviceIds,
      };
    })
    // Flag off: orphaned pools (no categories — e.g. after a merge moved them
    // away) stay out of the UI; their booking history remains in the tables.
    // Flag on: keep vendor-created calendars + any pool that holds assigned
    // services, even with no category rows.
    .filter((p) =>
      namedCalendars
        ? p.categories.length > 0 || p.serviceIds.length > 0 || p.isVendorCreated
        : p.categories.length > 0,
    );
}

/**
 * The vendor's active services shaped for the Named Calendars service-picker:
 * a human label + which calendar each is currently assigned to (null = still on
 * its category pool). Soft-probes the membership table so it degrades cleanly
 * pre-migration.
 */
export async function fetchVendorServicesForPicker(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<CalendarServiceOption[]> {
  const [{ data: services }, { data: members }] = await Promise.all([
    supabase
      .from('vendor_services')
      .select('vendor_service_id, title, category')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('vendor_schedule_calendar_services')
      .select('vendor_service_id, pool_id')
      .eq('vendor_profile_id', vendorProfileId)
      .then((r) => (r.error ? { data: [] as { vendor_service_id: string; pool_id: string }[] } : r)),
  ]);
  const poolByService = new Map(
    ((members ?? []) as { vendor_service_id: string; pool_id: string }[]).map((m) => [
      m.vendor_service_id,
      m.pool_id,
    ]),
  );
  return ((services ?? []) as {
    vendor_service_id: string;
    title: string | null;
    category: string | null;
  }[]).map((s) => ({
    serviceId: s.vendor_service_id,
    label:
      s.title && s.title.trim().length > 0
        ? s.title.trim()
        : humanizeCategory(s.category || 'Service'),
    poolId: poolByService.get(s.vendor_service_id) ?? null,
  }));
}

/**
 * Live (un-released) pool reservations, enriched with the event's display
 * name + the chat thread for deep-linking. Event names read via the admin
 * client — the vendor is party to the booking but holds no events RLS.
 */
export async function fetchVendorPoolBookings(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<PoolBookingEntry[]> {
  const { data: rows } = await supabase
    .from('vendor_schedule_pool_bookings')
    .select('pool_booking_id, pool_id, event_id, booked_date')
    .eq('vendor_profile_id', vendorProfileId)
    .is('released_at', null)
    .order('booked_date', { ascending: true });
  const bookings = (rows ?? []) as {
    pool_booking_id: string;
    pool_id: string;
    event_id: string;
    booked_date: string;
  }[];
  if (bookings.length === 0) return [];

  const eventIds = [...new Set(bookings.map((b) => b.event_id))];
  const admin = createAdminClient();
  const [{ data: events }, { data: threads }] = await Promise.all([
    admin
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds),
    admin
      .from('chat_threads')
      .select('thread_id, event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .in('event_id', eventIds),
  ]);
  const nameByEvent = new Map(
    ((events ?? []) as { event_id: string; display_name: string }[]).map((e) => [
      e.event_id,
      e.display_name,
    ]),
  );
  const threadByEvent = new Map(
    ((threads ?? []) as { thread_id: string; event_id: string }[]).map((t) => [
      t.event_id,
      t.thread_id,
    ]),
  );

  return bookings.map((b) => ({
    poolBookingId: b.pool_booking_id,
    poolId: b.pool_id,
    eventId: b.event_id,
    bookedDate: b.booked_date,
    eventName: nameByEvent.get(b.event_id) ?? 'A Setnayan event',
    threadId: threadByEvent.get(b.event_id) ?? null,
  }));
}

/** All calendar blocks for the vendor, normalized to PH civil-day ranges. */
export async function fetchVendorBlocks(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<CalendarBlockEntry[]> {
  const { data: rows } = await supabase
    .from('vendor_calendar_blocks')
    .select(
      'block_id, pool_id, block_source, block_label, client_name, client_contact, client_note, blocked_at, blocked_until',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('blocked_at', { ascending: true });
  return ((rows ?? []) as {
    block_id: string;
    pool_id: string | null;
    block_source: CalendarBlockEntry['source'];
    block_label: string;
    client_name: string | null;
    client_contact: string | null;
    client_note: string | null;
    blocked_at: string;
    blocked_until: string;
  }[]).map((b) => ({
    blockId: b.block_id,
    poolId: b.pool_id,
    source: b.block_source,
    label: b.block_label,
    clientName: b.client_name,
    clientContact: b.client_contact,
    clientNote: b.client_note,
    startDate: manilaDate(b.blocked_at),
    endDate: manilaDate(b.blocked_until),
  }));
}
