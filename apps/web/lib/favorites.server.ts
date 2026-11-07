import 'server-only';
/**
 * favorites.server.ts — the READS and the WRITE behind "favorites after an event" (owner 2026-11-06). Every rule is
 * decided in `lib/favorites.ts`; this file only fetches what those rules need and writes the one row.
 *
 * 🔑 Every read takes the user id FROM THE SESSION (the caller's `auth.getUser()`), never from a form, and uses the
 * admin client on purpose: a guest has no RLS path to the event's bookings or to their own check-in row
 * (`guest_checkins` is couple/coordinator/admin), exactly like `fetchEventVendorCredits` and the Hub's own arrival
 * read. The narrowing to THIS person is done here, explicitly.
 *
 * 🔑 A REFUSED READ IS NOT "NO". Each reader returns `null` when it could not look; the gate turns that into
 * `unread` (the press is refused and says so) — never into "you were not there".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FAVORITE_BOOKED_STATUSES,
  favoriteKey,
  guestFavoriteVerdict,
  hostFavoriteVerdict,
  type BookedService,
  type FavoriteVerdict,
} from '@/lib/favorites';
import { manilaToday } from '@/lib/provisional-approval';

type Admin = SupabaseClient;

const logErr = (where: string, error: unknown) => console.error(`[supabase-error] lib/favorites.server.ts · ${where}`, error);

/**
 * The events (of `eventIds`, or all) where THIS person's own guest row was checked in at the door. The guest row is
 * the one bound to the account — `event_members.guest_id` (member_type guest, not hidden) — or a row on the person
 * node the account claimed (`guests.person_id → people.claimed_by_user_id`). Removed rows (`deleted_at`) never count.
 */
export async function readCheckedInEvents(admin: Admin, userId: string, eventIds: readonly string[] | null): Promise<Set<string> | null> {
  if (eventIds && eventIds.length === 0) return new Set();
  let members = admin
    .from('event_members')
    .select('event_id, guest_id')
    .eq('user_id', userId)
    .eq('member_type', 'guest')
    .not('guest_id', 'is', null)
    .is('hidden_at', null);
  if (eventIds) members = members.in('event_id', [...eventIds]);
  const [m, p] = await Promise.all([members, admin.from('people').select('person_id').eq('claimed_by_user_id', userId)]);
  if (m.error) return (logErr('from:event_members.select', m.error), null);
  if (p.error) return (logErr('from:people.select', p.error), null);
  const personIds = ((p.data ?? []) as { person_id: string }[]).map((r) => r.person_id).filter(Boolean);
  const boundIds = ((m.data ?? []) as { guest_id: string | null }[]).map((r) => r.guest_id).filter((g): g is string => Boolean(g));

  // Every candidate seat must still be a live row on its event.
  let seatsQ = admin.from('guests').select('guest_id, event_id').is('deleted_at', null);
  const ors: string[] = [];
  if (boundIds.length) ors.push(`guest_id.in.(${boundIds.join(',')})`);
  if (personIds.length) ors.push(`person_id.in.(${personIds.join(',')})`);
  if (ors.length === 0) return new Set();
  seatsQ = seatsQ.or(ors.join(','));
  if (eventIds) seatsQ = seatsQ.in('event_id', [...eventIds]);
  const seats = await seatsQ;
  if (seats.error) return (logErr('from:guests.select', seats.error), null);
  const seatRows = (seats.data ?? []) as { guest_id: string; event_id: string }[];
  if (seatRows.length === 0) return new Set();

  const checks = await admin
    .from('guest_checkins')
    .select('event_id, guest_id')
    .in('guest_id', seatRows.map((s) => s.guest_id));
  if (checks.error) return (logErr('from:guest_checkins.select', checks.error), null);
  const seatEvent = new Map(seatRows.map((s) => [s.guest_id, s.event_id]));
  const out = new Set<string>();
  for (const c of (checks.data ?? []) as { event_id: string; guest_id: string }[]) {
    // The check-in must be FOR the seat's own event.
    if (seatEvent.get(c.guest_id) === c.event_id) out.add(c.event_id);
  }
  return out;
}

/** The booked services of each event: a booked status, and a shop on Setnayan. */
export async function readBookedServices(admin: Admin, eventIds: readonly string[]): Promise<Map<string, BookedService[]> | null> {
  const out = new Map<string, BookedService[]>();
  if (eventIds.length === 0) return out;
  const { data, error } = await admin
    .from('event_vendors')
    .select('event_id, marketplace_vendor_id, service_id')
    .in('event_id', [...eventIds])
    .in('status', [...FAVORITE_BOOKED_STATUSES])
    .not('marketplace_vendor_id', 'is', null);
  if (error) return (logErr('from:event_vendors.select', error), null);
  for (const r of (data ?? []) as { event_id: string; marketplace_vendor_id: string; service_id: string | null }[]) {
    const list = out.get(r.event_id) ?? [];
    list.push({ shopId: r.marketplace_vendor_id, serviceId: r.service_id ?? null });
    out.set(r.event_id, list);
  }
  return out;
}

/** The events THIS person hosts (a couple seat — a coordinator is never a host here), with each locked date. */
export async function readHostedEvents(admin: Admin, userId: string, eventIds: readonly string[] | null): Promise<Map<string, string | null> | null> {
  let q = admin.from('event_members').select('event_id').eq('user_id', userId).eq('member_type', 'couple');
  if (eventIds) q = q.in('event_id', [...eventIds]);
  const m = await q;
  if (m.error) return (logErr('from:event_members.select(couple)', m.error), null);
  const ids = [...new Set(((m.data ?? []) as { event_id: string }[]).map((r) => r.event_id))];
  const out = new Map<string, string | null>();
  if (ids.length === 0) return out;
  const ev = await admin.from('events').select('event_id, event_date').in('event_id', ids);
  if (ev.error) return (logErr('from:events.select', ev.error), null);
  for (const r of (ev.data ?? []) as { event_id: string; event_date: string | null }[]) out.set(r.event_id, r.event_date ?? null);
  return out;
}

/**
 * THE GATE for one press — re-checked on the server for every write (never trust the button).
 * Host first: a host of the event is judged as a host (they were not a "guest" at their own wedding).
 */
export async function favoriteGate(
  admin: Admin,
  f: { userId: string; eventId: string; shopId: string; serviceId: string | null; as: 'host' | 'guest'; now?: number },
): Promise<FavoriteVerdict> {
  const [booked, hosted] = await Promise.all([readBookedServices(admin, [f.eventId]), readHostedEvents(admin, f.userId, [f.eventId])]);
  if (!booked || !hosted) return { ok: false, why: 'unread' };
  const services = booked.get(f.eventId) ?? [];
  if (f.as === 'host') {
    return hostFavoriteVerdict({
      isHost: hosted.has(f.eventId),
      eventDate: hosted.get(f.eventId) ?? null,
      today: manilaToday(f.now),
      booked: services,
      shopId: f.shopId,
      serviceId: f.serviceId,
    });
  }
  const checked = await readCheckedInEvents(admin, f.userId, [f.eventId]);
  if (!checked) return { ok: false, why: 'unread' };
  return guestFavoriteVerdict({ checkedIn: checked.has(f.eventId), booked: services, shopId: f.shopId, serviceId: f.serviceId });
}

/** One booked row's ♡ — offered to a host after the day (`offerHostFavorites`). */
export type HostFavoriteOffer = { shopId: string; serviceId: string | null; on: boolean };

/**
 * THE HOST'S ♡ ON THEIR OWN EVENT — for each BOOKED row (by `event_vendors.vendor_id`) of a shop on Setnayan: the
 * service it names and whether this person already keeps it. NULL = not offered here at all — not a host (a
 * coordinator never is), the day not behind us, or a read refused (a heart we cannot vouch for is not drawn).
 */
export async function offerHostFavorites(
  admin: Admin,
  userId: string,
  eventId: string,
  now?: number,
): Promise<Map<string, HostFavoriteOffer> | null> {
  const [hosted, rows] = await Promise.all([
    readHostedEvents(admin, userId, [eventId]),
    admin
      .from('event_vendors')
      .select('vendor_id, marketplace_vendor_id, service_id')
      .eq('event_id', eventId)
      .in('status', [...FAVORITE_BOOKED_STATUSES])
      .not('marketplace_vendor_id', 'is', null),
  ]);
  if (!hosted || !hosted.has(eventId)) return null;
  const day = (hosted.get(eventId) ?? '').slice(0, 10);
  if (!day || !(day < manilaToday(now))) return null;
  if (rows.error) return (logErr('from:event_vendors.select(offer)', rows.error), null);
  const list = (rows.data ?? []) as { vendor_id: string; marketplace_vendor_id: string; service_id: string | null }[];
  const kept = await readOwnFavoriteKeys(admin, userId, list.map((r) => r.marketplace_vendor_id));
  if (!kept) return null;
  return new Map(
    list.map((r) => [
      r.vendor_id,
      { shopId: r.marketplace_vendor_id, serviceId: r.service_id ?? null, on: keeps(kept, r.marketplace_vendor_id, r.service_id ?? null) },
    ]),
  );
}

/** Which of these shop+service pairs this person already keeps (`favoriteKey`). A shop-level favorite covers the shop. */
export async function readOwnFavoriteKeys(admin: Admin, userId: string, shopIds: readonly string[]): Promise<Set<string> | null> {
  if (shopIds.length === 0) return new Set();
  const { data, error } = await admin
    .from('guest_saved_vendors')
    .select('vendor_profile_id, vendor_service_id')
    .eq('user_id', userId)
    .in('vendor_profile_id', [...new Set(shopIds)]);
  if (error) return (logErr('from:guest_saved_vendors.select', error), null);
  return new Set(
    ((data ?? []) as { vendor_profile_id: string; vendor_service_id: string | null }[]).map((r) =>
      favoriteKey(r.vendor_profile_id, r.vendor_service_id ?? null),
    ),
  );
}

/** Is this pair kept? A shop-level row keeps every service of the shop. */
export function keeps(keys: ReadonlySet<string>, shopId: string, serviceId: string | null): boolean {
  return keys.has(favoriteKey(shopId, serviceId)) || keys.has(favoriteKey(shopId, null));
}

/**
 * WRITE one favorite. Idempotent: the first event is kept (a second press from another event changes nothing).
 * A shop-level row (no service) is checked before it is inserted — the unique key does not fold NULLs (see the
 * migration's ⚖ note).
 */
export async function writeFavorite(
  admin: Admin,
  f: { userId: string; eventId: string; shopId: string; serviceId: string | null },
): Promise<{ ok: true } | { ok: false }> {
  const row = { user_id: f.userId, vendor_profile_id: f.shopId, vendor_service_id: f.serviceId, source_event_id: f.eventId };
  if (f.serviceId) {
    const { error } = await admin
      .from('guest_saved_vendors')
      .upsert(row, { onConflict: 'user_id,vendor_profile_id,vendor_service_id', ignoreDuplicates: true });
    if (error) return (logErr('from:guest_saved_vendors.upsert', error), { ok: false });
    return { ok: true };
  }
  const have = await admin
    .from('guest_saved_vendors')
    .select('id')
    .eq('user_id', f.userId)
    .eq('vendor_profile_id', f.shopId)
    .is('vendor_service_id', null)
    .limit(1);
  if (have.error) return (logErr('from:guest_saved_vendors.select(shop)', have.error), { ok: false });
  if ((have.data ?? []).length > 0) return { ok: true };
  const { error } = await admin.from('guest_saved_vendors').insert(row);
  if (error) return (logErr('from:guest_saved_vendors.insert', error), { ok: false });
  return { ok: true };
}

/** REMOVE one favorite (every stored row for that shop + service). Through the person's own session — RLS owner-only. */
export async function removeFavorite(
  supabase: SupabaseClient,
  f: { userId: string; shopId: string; serviceId: string | null },
): Promise<{ ok: true } | { ok: false }> {
  let q = supabase.from('guest_saved_vendors').delete().eq('user_id', f.userId).eq('vendor_profile_id', f.shopId);
  q = f.serviceId ? q.eq('vendor_service_id', f.serviceId) : q.is('vendor_service_id', null);
  const { error } = await q;
  if (error) return (logErr('from:guest_saved_vendors.delete', error), { ok: false });
  return { ok: true };
}

/** The services' names and public ids (the shop page's `?service=` door), by id. */
export async function readServiceNames(
  admin: Admin,
  serviceIds: readonly string[],
  labels: Readonly<Record<string, string>>,
  labelOf: (labels: Readonly<Record<string, string>>, key: string) => string,
): Promise<Map<string, { label: string; publicId: string | null }>> {
  const out = new Map<string, { label: string; publicId: string | null }>();
  const ids = [...new Set(serviceIds)].filter(Boolean);
  if (ids.length === 0) return out;
  const { data, error } = await admin.from('vendor_services').select('vendor_service_id, public_id, title, category').in('vendor_service_id', ids);
  if (error) {
    logErr('from:vendor_services.select', error);
    return out;
  }
  for (const r of (data ?? []) as { vendor_service_id: string; public_id: string | null; title: string | null; category: string | null }[]) {
    const label = (r.title ?? '').trim() || (r.category ? labelOf(labels, r.category) : '');
    out.set(r.vendor_service_id, { label, publicId: r.public_id ?? null });
  }
  return out;
}
