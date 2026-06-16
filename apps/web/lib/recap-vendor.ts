import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// Vendor "Recaps" — the booked weddings a vendor helped create whose couple has
// PUBLISHED their Auto-Recap. Publishing the recap is the couple's explicit
// public act (their own privacy decision), so the only gate here is ownership:
// the vendor's own booked event ids ∩ published recaps. Scoped to the caller's
// booked events so it never leaks another vendor's clients. Best-effort: any
// failure returns [] and the surface degrades to its empty state.
// ============================================================================

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return null;
  return `${MONTHS[m - 1]} ${y}`;
}

function deriveCity(venueName: string | null, venueAddress: string | null): string | null {
  const addr = venueAddress?.trim();
  if (addr) {
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      if (candidate && !/^\d+$/.test(candidate)) return candidate;
    }
  }
  return venueName?.trim() || null;
}

export type VendorRecap = {
  eventId: string;
  slug: string;
  coupleNames: string;
  city: string | null;
  dateLabel: string | null;
  publishedAt: string | null;
};

export async function loadVendorRecaps(
  bookedEventIds: ReadonlyArray<string>,
): Promise<VendorRecap[]> {
  const ids = Array.from(new Set(bookedEventIds)).filter(Boolean);
  if (ids.length === 0) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  try {
    // 1 · published recaps among the vendor's booked events.
    const { data: recapRows } = await admin
      .from('event_recaps')
      .select('event_id, published_at')
      .in('event_id', ids)
      .eq('status', 'published');
    const recaps = recapRows ?? [];
    if (recaps.length === 0) return [];

    const publishedAtByEvent = new Map(
      recaps.map((r) => [r.event_id as string, (r.published_at as string) ?? null]),
    );
    const recapEventIds = recaps.map((r) => r.event_id as string);

    // 2 · resolve event display fields (only published-recap, weddings, w/ slug).
    const { data: evRows } = await admin
      .from('events')
      .select('event_id, slug, display_name, event_date, venue_name, venue_address')
      .in('event_id', recapEventIds)
      .eq('event_type', 'wedding')
      .not('slug', 'is', null);

    return (evRows ?? [])
      .map((e) => ({
        eventId: e.event_id as string,
        slug: e.slug as string,
        coupleNames: (e.display_name as string | null) ?? 'A Setnayan wedding',
        city: deriveCity(e.venue_name as string | null, e.venue_address as string | null),
        dateLabel: monthYear(e.event_date as string | null),
        publishedAt: publishedAtByEvent.get(e.event_id as string) ?? null,
      }))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  } catch {
    return [];
  }
}
