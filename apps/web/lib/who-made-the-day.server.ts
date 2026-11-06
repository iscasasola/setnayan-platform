import type { SupabaseClient } from '@supabase/supabase-js';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';

import type { WhoMadeTheDaySupplier } from '@/lib/who-made-the-day';

/**
 * 🚪 DOOR 2 — "WHO MADE THE DAY?" on the guest's own Event Hub after the day (prototype 6 Nov § 8).
 *
 * Shown ONLY when the guest was checked in at the door AND at least one supplier on this event is delivered —
 * otherwise ABSENT, "not greyed, not 'coming soon'" (the prototype's words). The list is this event's delivered
 * suppliers with a public page, each "Not yet rated" / "Rated" for THIS guest. Every pick opens the one guest-review
 * screen for that supplier alone (`/v/<slug>/guest-review?event=`), where the ONE writer re-checks everything.
 *
 * Returns `null` for "draw nothing". A refused read is logged and also draws nothing: this row is an offer, not a
 * record, and an offer with a half-read list would hand the guest the wrong suppliers. Service role (the page's own
 * `admin`); the guest id is the page's verified seat or pass, never a parameter from the browser.
 */
export async function readWhoMadeTheDay(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<WhoMadeTheDaySupplier[] | null> {
  const [checkin, booked, rated] = await Promise.all([
    admin.from('guest_checkins').select('guest_id').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
    admin
      .from('event_vendors')
      .select('marketplace_vendor_id, linked_vendor_profile_id, category')
      .eq('event_id', eventId)
      .in('status', ['delivered', 'complete']),
    admin.from('vendor_guest_reviews').select('vendor_profile_id').eq('event_id', eventId).eq('guest_id', guestId),
  ]);
  if (checkin.error) console.error('[supabase-error] lib/who-made-the-day.server.ts · from:guest_checkins.select', checkin.error);
  if (booked.error) console.error('[supabase-error] lib/who-made-the-day.server.ts · from:event_vendors.select', booked.error);
  if (rated.error) console.error('[supabase-error] lib/who-made-the-day.server.ts · from:vendor_guest_reviews.select', rated.error);
  if (checkin.error || booked.error || rated.error || !checkin.data) return null;

  const tradeOf = new Map<string, string | null>();
  for (const r of (booked.data ?? []) as Array<{ marketplace_vendor_id: string | null; linked_vendor_profile_id: string | null; category: string | null }>) {
    const id = r.marketplace_vendor_id ?? r.linked_vendor_profile_id;
    if (!id || tradeOf.has(id)) continue;
    const label = r.category ? ((VENDOR_CATEGORY_LABEL as Record<string, string>)[r.category] ?? null) : null;
    tradeOf.set(id, label ? label.toLowerCase() : null);
  }
  if (tradeOf.size === 0) return null;

  const { data: shops, error: shopsErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug')
    .in('vendor_profile_id', [...tradeOf.keys()]);
  if (shopsErr) {
    console.error('[supabase-error] lib/who-made-the-day.server.ts · from:vendor_profiles.select', shopsErr);
    return null;
  }
  const ratedIds = new Set(((rated.data ?? []) as Array<{ vendor_profile_id: string }>).map((r) => r.vendor_profile_id));
  const list = ((shops ?? []) as Array<{ vendor_profile_id: string; business_name: string | null; business_slug: string | null }>)
    .filter((s) => s.business_slug && s.business_name?.trim())
    .map((s) => ({
      slug: s.business_slug as string,
      name: (s.business_name as string).trim(),
      trade: tradeOf.get(s.vendor_profile_id) ?? null,
      rated: ratedIds.has(s.vendor_profile_id),
    }))
    .sort((a, b) => Number(a.rated) - Number(b.rated) || a.name.localeCompare(b.name));
  return list.length > 0 ? list : null;
}
