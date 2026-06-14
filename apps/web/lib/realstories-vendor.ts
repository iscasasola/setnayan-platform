import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

// ============================================================================
// Vendor "Featured in Real Stories" — the booked weddings a vendor helped
// create that the couple has published to the public showcase.
// ============================================================================
// Strategy: the editorial credits the vendor; giving the vendor a one-click
// "Share to your Facebook Page" turns every published Real Story into free
// reach back to Setnayan. This loader returns ONLY the signed-in vendor's OWN
// booked events that ALSO pass the public-showcase gate — the SAME RA 10173
// gate as lib/showcase-db.ts (couple opted in via users.public_summary_consent_at,
// it's a wedding with a public slug, past the T+30d grace window), scoped to
// the vendor's booked event ids so it never leaks another vendor's clients.
//
// Read via the admin client (the consent + editorial rows sit behind RLS, same
// as showcase-db). Best-effort: any failure returns [] so the vendor surface
// degrades to its empty state and never crashes. Today this returns [] for
// everyone (no consented past weddings exist yet — first real editorials land
// ~Dec 2026), so the surface is ready-but-empty.

const GRACE_DAYS = 30;

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

export type VendorFeaturedStory = {
  eventId: string;
  /** Public slug → the couple's canonical editorial at /[slug]. */
  slug: string;
  coupleNames: string;
  city: string | null;
  dateLabel: string | null;
};

/**
 * The subset of the vendor's booked events that are published Real Stories.
 * `bookedEventIds` comes from the vendor's own bookings (fetchVendorPoolBookings),
 * so the ownership scope is already enforced by the caller; this only adds the
 * public-showcase gate.
 */
export async function loadVendorFeaturedStories(
  bookedEventIds: ReadonlyArray<string>,
): Promise<VendorFeaturedStory[]> {
  const ids = Array.from(new Set(bookedEventIds)).filter(Boolean);
  if (ids.length === 0) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  try {
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD

    // 1 · the vendor's booked weddings with a public slug, past the grace window.
    const { data: evRows } = await admin
      .from('events')
      .select('event_id, slug, display_name, event_date, venue_name, venue_address')
      .in('event_id', ids)
      .eq('event_type', 'wedding')
      .not('slug', 'is', null)
      .lte('event_date', cutoff);
    const events = evRows ?? [];
    if (events.length === 0) return [];

    // 2 · couple consent (RA 10173) — a couple member opted in to public showcase.
    const eventIds = events.map((e) => e.event_id as string);
    const { data: members } = await admin
      .from('event_members')
      .select('event_id, user_id')
      .eq('member_type', 'couple')
      .in('event_id', eventIds);
    const memberRows = members ?? [];
    const userIds = Array.from(new Set(memberRows.map((m) => m.user_id as string)));
    if (userIds.length === 0) return [];

    const { data: consenters } = await admin
      .from('users')
      .select('user_id')
      .in('user_id', userIds)
      .not('public_summary_consent_at', 'is', null)
      .is('deleted_at', null);
    const consentedUsers = new Set((consenters ?? []).map((u) => u.user_id as string));
    const consentedEvents = new Set(
      memberRows
        .filter((m) => consentedUsers.has(m.user_id as string))
        .map((m) => m.event_id as string),
    );

    return events
      .filter((e) => consentedEvents.has(e.event_id as string))
      .map((e) => ({
        eventId: e.event_id as string,
        slug: e.slug as string,
        coupleNames: (e.display_name as string | null) ?? 'A Setnayan wedding',
        city: deriveCity(
          e.venue_name as string | null,
          e.venue_address as string | null,
        ),
        dateLabel: monthYear(e.event_date as string | null),
      }));
  } catch {
    return [];
  }
}
