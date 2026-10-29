import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readInChunks } from '@/lib/read-all-pages';
import { eventTypeLabel } from '@/lib/demand-radar';
import { displayServiceLabel } from '@/lib/vendors';
import { tilesForVendorCategories } from '@/lib/vendor-category-taxonomy';
import {
  alsoOfferFrom,
  forYourServicePages,
  eventDayWords,
  hostsInOrder,
  type EventLines,
  type EventStage,
} from '@/lib/supplier-event-lines';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * THE ONE BATCHED READ BEHIND EVERY OPENED EVENT ROW (supplier dashboard v13 — the pure half and the ruling are in
 * `supplier-event-lines.ts`). A page hands in the events on screen and gets every row's lines back in ONE round of
 * parallel reads (+ one for the names): the shop's threads · the events · their hosts · their supplier plan (what they
 * asked this shop for, the categories they added, who they booked) · this shop's services. Opening a row reads nothing.
 *
 * 🔐 ADMIN CLIENT, SCOPED TO THIS SHOP. `event_vendors`, `event_members` and `users` admit no supplier policy (the same
 * reason the Customers page reads `event_vendors` this way). An event is answered for ONLY when this shop holds a chat
 * thread on it or a supplier-plan row naming it — an id that is neither is dropped, whatever the caller passed.
 *
 * 🔴 A REFUSED READ IS SAID, NEVER EMPTY: hosts / requested / also booked go `null` ("couldn't load") on their own
 * refusal; a refused events read marks every row `read: false`.
 */
export async function readSupplierEventLines(
  admin: Admin,
  input: {
    vendorProfileId: string;
    /** `vendor_profiles.services` — which of the event's pages are this shop's ("For your service"). */
    shopServices: readonly string[] | null;
    events: ReadonlyArray<{ eventId: string; stage: EventStage }>;
    /**
     * Event ids the caller has ALREADY proven are this shop's by a read of its own that this one cannot repeat (a live
     * reservation in the shop's own schedule — `fetchVendorPoolBookings`). Never a list from the address bar.
     */
    vouched?: ReadonlySet<string>;
  },
): Promise<Map<string, EventLines>> {
  const out = new Map<string, EventLines>();
  const ids = [...new Set(input.events.map((e) => e.eventId).filter(Boolean))];
  if (ids.length === 0) return out;
  const me = input.vendorProfileId;

  const [threadsRead, eventsRead, membersRead, planRead, servicesRead] = await Promise.all([
    readInChunks<{
      thread_id: string;
      event_id: string;
      created_by_user_id: string | null;
      pax_at_inquiry: number | null;
      pax_current: number | null;
      is_returning: boolean | null;
      updated_at: string | null;
    }>(ids, (part) =>
      admin
        .from('chat_threads')
        .select('thread_id, event_id, created_by_user_id, pax_at_inquiry, pax_current, is_returning, updated_at')
        .eq('vendor_profile_id', me)
        .in('event_id', part),
    ),
    readInChunks<{
      event_id: string;
      display_name: string | null;
      event_type: string | null;
      venue_name: string | null;
      event_date: string | null;
      event_date_precision: string | null;
      estimated_pax: number | null;
    }>(ids, (part) =>
      admin
        .from('events')
        .select('event_id, display_name, event_type, venue_name, event_date, event_date_precision, estimated_pax')
        .in('event_id', part),
    ),
    readInChunks<{ event_id: string; user_id: string | null }>(ids, (part) =>
      admin.from('event_members').select('event_id, user_id').eq('member_type', 'couple').in('event_id', part),
    ),
    readInChunks<{
      event_id: string;
      marketplace_vendor_id: string | null;
      category: string | null;
      service_id: string | null;
      requested_service_ids: string[] | null;
      status: string | null;
      vendor_name: string | null;
    }>(ids, (part) =>
      admin
        .from('event_vendors')
        .select('event_id, marketplace_vendor_id, category, service_id, requested_service_ids, status, vendor_name')
        .is('archived_at', null)
        .in('event_id', part),
    ),
    admin
      .from('vendor_services')
      .select('vendor_service_id, title, category, starting_price_php, is_active')
      .eq('vendor_profile_id', me),
  ]);
  for (const [site, r] of [
    ['threads', threadsRead],
    ['events', eventsRead],
    ['members', membersRead],
    ['plan', planRead],
    ['services', servicesRead],
  ] as const) {
    if (r.error) logQueryError(`readSupplierEventLines.${site}`, r.error, { vendorProfileId: me }, 'graceful_degrade');
  }

  // 🔐 THE SCOPE: this shop's own thread or own plan row on the event — nothing else is answered for.
  const threadOf = new Map<string, (typeof threadsRead.rows)[number]>();
  for (const t of [...threadsRead.rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))) {
    if (!threadOf.has(t.event_id)) threadOf.set(t.event_id, t);
  }
  const planOf = new Map<string, typeof planRead.rows>();
  for (const r of planRead.rows) planOf.set(r.event_id, [...(planOf.get(r.event_id) ?? []), r]);
  const inScope = (id: string) =>
    threadOf.has(id) || (planOf.get(id) ?? []).some((r) => r.marketplace_vendor_id === me) || Boolean(input.vouched?.has(id));

  const memberIds = new Map<string, string[]>();
  for (const m of membersRead.rows) if (m.user_id) memberIds.set(m.event_id, [...(memberIds.get(m.event_id) ?? []), m.user_id]);

  // Round two: the hosts' names, and a returning customer's first event with this shop — both need round one.
  const people = [
    ...new Set([
      ...[...memberIds.entries()].filter(([id]) => inScope(id)).flatMap(([, us]) => us),
      ...[...threadOf.values()].map((t) => t.created_by_user_id).filter((u): u is string => Boolean(u)),
    ]),
  ];
  const returningAskers = [
    ...new Set([...threadOf.values()].filter((t) => t.is_returning && t.created_by_user_id).map((t) => t.created_by_user_id as string)),
  ];
  const [usersRead, earlierRead] = await Promise.all([
    readInChunks<{ user_id: string; display_name: string | null; first_name: string | null }>(people, (part) =>
      admin.from('users').select('user_id, display_name, first_name').in('user_id', part),
    ),
    returningAskers.length > 0
      ? admin
          .from('chat_threads')
          .select('thread_id, event_id, created_by_user_id, created_at, event:events(display_name, event_type, event_date)')
          .eq('vendor_profile_id', me)
          .in('created_by_user_id', returningAskers)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  if (usersRead.error) logQueryError('readSupplierEventLines.users', usersRead.error, { vendorProfileId: me }, 'graceful_degrade');
  if (earlierRead.error) logQueryError('readSupplierEventLines.earlier', earlierRead.error, { vendorProfileId: me }, 'graceful_degrade');

  const nameOf = new Map<string, string>();
  for (const u of usersRead.rows) {
    const n = (u.display_name ?? '').trim() || (u.first_name ?? '').trim();
    if (n) nameOf.set(u.user_id, n);
  }
  const eventOf = new Map(eventsRead.rows.map((e) => [e.event_id, e]));
  const services = ((servicesRead.data ?? []) as Array<{
    vendor_service_id: string;
    title: string | null;
    category: string | null;
    starting_price_php: number | null;
    is_active: boolean | null;
  }>).map((s) => ({
    id: s.vendor_service_id,
    name: (s.title ?? '').trim() || (s.category ? displayServiceLabel(s.category) : 'Service'),
    category: s.category,
    fromPhp: s.starting_price_php,
    live: s.is_active !== false,
  }));
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const earlier = (earlierRead.data ?? []) as Array<{
    thread_id: string;
    event_id: string;
    created_by_user_id: string | null;
    event: { display_name: string | null; event_type: string | null; event_date: string | null } | null;
  }>;

  for (const { eventId, stage } of input.events) {
    if (!inScope(eventId) || out.has(eventId)) continue;
    const ev = eventOf.get(eventId) ?? null;
    const t = threadOf.get(eventId) ?? null;
    const mine = (planOf.get(eventId) ?? []).filter((r) => r.marketplace_vendor_id === me);
    const requestedIds = new Set<string>();
    for (const r of mine) {
      if (r.service_id) requestedIds.add(r.service_id);
      for (const s of r.requested_service_ids ?? []) requestedIds.add(s);
    }
    const requested = planRead.error
      ? null
      : requestedIds.size > 0
        ? [...requestedIds].map((id) => ({ name: serviceName.get(id) ?? 'A service you no longer list' }))
        : [...new Set(mine.map((r) => r.category).filter((c): c is string => Boolean(c)))].map((c) => ({ name: displayServiceLabel(c) }));
    const eventCategories = (planOf.get(eventId) ?? []).map((r) => r.category).filter((c): c is string => Boolean(c));
    const eventTiles = tilesForVendorCategories(mine.map((r) => r.category).filter((c): c is string => Boolean(c)));
    const first = t?.is_returning && t.created_by_user_id
      ? earlier.find((e) => e.created_by_user_id === t.created_by_user_id && e.event_id !== eventId) ?? null
      : null;
    out.set(eventId, {
      eventId,
      threadId: t?.thread_id ?? null,
      stage,
      read: !eventsRead.error && ev !== null,
      type: ev?.event_type && ev.event_type !== 'unspecified' ? eventTypeLabel(ev.event_type) : null,
      celebrant: ev?.display_name?.trim() || null,
      location: ev?.venue_name?.trim() || null,
      date: eventDayWords(ev?.event_date ?? null, ev?.event_date_precision ?? null),
      pax: t?.pax_current ?? t?.pax_at_inquiry ?? ev?.estimated_pax ?? null,
      hosts: membersRead.error || usersRead.error ? null : hostsInOrder(memberIds.get(eventId) ?? [], t?.created_by_user_id ?? null, nameOf),
      requested,
      alsoOffer: servicesRead.error || planRead.error
        ? []
        : alsoOfferFrom({ stage, services: services.filter((s) => s.live), requestedIds, eventCategories }),
      alsoBooked: planRead.error
        ? null
        : (planOf.get(eventId) ?? [])
            .filter((r) => r.status === 'locked' && r.marketplace_vendor_id !== me && (r.vendor_name ?? '').trim())
            .map((r) => ({ name: (r.vendor_name ?? '').trim(), service: r.category ? displayServiceLabel(r.category) : 'Supplier' })),
      forYou: forYourServicePages({ eventId, stage, shopServices: input.shopServices, eventTiles }),
      firstEvent: first
        ? {
            title: [first.event?.display_name?.trim(), first.event?.event_type && first.event.event_type !== 'unspecified' ? eventTypeLabel(first.event.event_type) : null, eventDayWords(first.event?.event_date ?? null)]
              .filter(Boolean)
              .join(' · ') || 'Their first event',
            href: `/vendor-dashboard/messages/${first.thread_id}`,
          }
        : null,
    });
  }
  return out;
}
