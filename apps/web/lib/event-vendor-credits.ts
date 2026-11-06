import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { hydrateVendorCards, type VendorCard } from '@/lib/vendor-cards';
import { readServiceLabels, serviceLabelOf } from '@/lib/service-labels';
import { readServiceNames } from '@/lib/favorites.server';
import { FAVORITE_BOOKED_STATUSES, favoriteKey } from '@/lib/favorites';

/**
 * One line of "Suppliers who made this day": a booked SERVICE of a shop (owner 2026-11-06 — "a favorite is the
 * SERVICE, not the shop"). `serviceId` is the booking's own `event_vendors.service_id`; null when the booking names no
 * service (older rows, a package line) — then the line stands for the whole shop, as it always did.
 */
export type EventVendorCredit = VendorCard & {
  serviceId: string | null;
  /** "Mobile bar" — the service's own title, else the admin's label for its category. Null = the shop line. */
  serviceLabel: string | null;
};

/**
 * The marketplace services the couple BOOKED for this event, hydrated as guest-facing cards. Read server-side
 * (admin) — a guest isn't a couple member, so RLS on event_vendors wouldn't let them read it directly. Shown to
 * guests as "Suppliers who made this day"; a guest checked in at the door may keep each one as a favorite.
 */
export async function fetchEventVendorCredits(eventId: string): Promise<EventVendorCredit[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, category, status, service_id')
    .eq('event_id', eventId)
    .in('status', [...FAVORITE_BOOKED_STATUSES])
    .not('marketplace_vendor_id', 'is', null);

  if (!rows || rows.length === 0) return [];

  const categoryByVendor = new Map<string, string | null>();
  const ids: string[] = [];
  const pairs: { shopId: string; serviceId: string | null }[] = [];
  const seen = new Set<string>();
  for (const r of rows as { marketplace_vendor_id: string | null; category: string | null; service_id: string | null }[]) {
    const vid = r.marketplace_vendor_id;
    if (!vid) continue;
    if (!categoryByVendor.has(vid)) {
      categoryByVendor.set(vid, r.category ?? null);
      ids.push(vid);
    }
    const k = favoriteKey(vid, r.service_id ?? null);
    if (seen.has(k)) continue;
    seen.add(k);
    pairs.push({ shopId: vid, serviceId: r.service_id ?? null });
  }
  // A shop with a named service needs no second, shop-only line beside it.
  const named = new Set(pairs.filter((p) => p.serviceId).map((p) => p.shopId));
  const lines = pairs.filter((p) => p.serviceId || !named.has(p.shopId));

  const serviceIds = lines.map((p) => p.serviceId).filter((s): s is string => Boolean(s));
  const [cards, labels] = await Promise.all([
    hydrateVendorCards(ids, categoryByVendor),
    serviceIds.length ? readServiceLabels() : Promise.resolve({} as Record<string, string>),
  ]);
  const names = await readServiceNames(admin, serviceIds, labels, serviceLabelOf);
  return lines.flatMap((p) => {
    const card = cards.get(p.shopId);
    if (!card) return [];
    const label = p.serviceId ? names.get(p.serviceId)?.label || null : null;
    return [{ ...card, serviceId: p.serviceId, serviceLabel: label }];
  });
}
