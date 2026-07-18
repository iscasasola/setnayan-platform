/**
 * Vendor public-profile "past events" gallery — SAFE LAYER (owner-locked
 * 2026-07-18). Surfaces the vendor's own professional track record as venue-aware
 * event cards, sorted so the events at the VIEWING couple's venue come first,
 * falling back to the most recent when there's no match.
 *
 * SAFE-LAYER SCOPE (no couple PI): a card shows only venue name · month/year ·
 * event type — never the couple's names or photos. Events a couple set to
 * private are excluded. The couple-identified, photo-bearing "rich layer" is a
 * separate, consent-gated follow-up (a new per-event "let booked vendors feature
 * my wedding" opt-in + DPO sign-off) and is NOT built here.
 *
 * "Similar venue" = EXACT same venue (owner 2026-07-18): the structured venue-
 * directory id when both sides have one, broadened to a normalized venue-name
 * match (the directory link is sparsely populated, so name-match keeps it hitting).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VendorCompletedEventRow } from '@/lib/reviews';

/** The viewing couple's own venue, used to sort the vendor's past events. */
export type ViewerVenue = {
  venueName: string | null;
  venueDirectoryId: string | null;
};

export type VendorVenueEvent = {
  eventId: string;
  eventType: string | null;
  eventDate: string | null;
  completedAt: string | null;
  venueName: string | null;
  venueSetting: string | null;
  venueDirectoryId: string | null;
  /** True when this past event is at the viewing couple's own venue. */
  atViewerVenue: boolean;
};

/** Normalize a free-text venue name for exact-ish comparison (case/spacing/punct). */
export function normalizeVenue(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Does a past event sit at the viewer's venue? Strong signal = same structured
 * venue-directory id; broadened = same normalized venue name (the directory link
 * is sparse, so the name match is what usually fires). PURE.
 */
export function matchesViewerVenue(
  ev: { venueName: string | null; venueDirectoryId: string | null },
  viewer: ViewerVenue | null,
): boolean {
  if (!viewer) return false;
  if (
    viewer.venueDirectoryId &&
    ev.venueDirectoryId &&
    viewer.venueDirectoryId === ev.venueDirectoryId
  ) {
    return true;
  }
  const a = normalizeVenue(viewer.venueName);
  const b = normalizeVenue(ev.venueName);
  return a.length > 0 && a === b;
}

/** Venue-matched events first, then most-recent-first. PURE + stable. */
export function orderVenueMatchedFirst<
  T extends { atViewerVenue: boolean; completedAt: string | null; eventDate: string | null },
>(events: readonly T[]): T[] {
  const dateKey = (e: T) => e.completedAt ?? e.eventDate ?? '';
  return [...events].sort((x, y) => {
    if (x.atViewerVenue !== y.atViewerVenue) return x.atViewerVenue ? -1 : 1;
    return dateKey(y).localeCompare(dateKey(x));
  });
}

/**
 * Read the viewing couple's own venue (name + any directory link). Service-role
 * read; fail-soft to nulls so the vendor page never breaks on a hiccup.
 */
export async function fetchViewerVenue(
  admin: SupabaseClient,
  coupleEventId: string,
): Promise<ViewerVenue> {
  try {
    const [{ data: ev }, { data: vd }] = await Promise.all([
      admin.from('events').select('venue_name').eq('event_id', coupleEventId).maybeSingle(),
      admin
        .from('event_vendors')
        .select('source_venue_directory_id')
        .eq('event_id', coupleEventId)
        .not('source_venue_directory_id', 'is', null)
        .limit(1),
    ]);
    const dirRow = ((vd ?? []) as { source_venue_directory_id: string | null }[])[0];
    return {
      venueName: (ev as { venue_name?: string | null } | null)?.venue_name ?? null,
      venueDirectoryId: dirRow?.source_venue_directory_id ?? null,
    };
  } catch {
    return { venueName: null, venueDirectoryId: null };
  }
}

/**
 * Enrich the vendor's (anti-fraud-clean) completed events with venue facts,
 * drop private events, mark the ones at the viewer's venue, and order
 * venue-matched-first then most-recent. Takes the already-fetched clean list
 * (from fetchVendorCompletedEvents) so it adds no duplicate round-trip for it.
 * Fail-soft to [] on any read error.
 */
export async function buildVendorVenueEvents(
  admin: SupabaseClient,
  completed: readonly VendorCompletedEventRow[],
  viewer: ViewerVenue | null,
  opts: { limit?: number } = {},
): Promise<VendorVenueEvent[]> {
  const limit = opts.limit ?? 12;
  if (completed.length === 0) return [];
  const eventIds = completed.map((e) => e.event_id);
  try {
    const [{ data: evRows }, { data: vRows }] = await Promise.all([
      admin
        .from('events')
        .select('event_id, venue_name, venue_setting, landing_page_visibility')
        .in('event_id', eventIds),
      admin
        .from('event_vendors')
        .select('event_id, source_venue_directory_id')
        .in('event_id', eventIds)
        .not('source_venue_directory_id', 'is', null),
    ]);

    type EvRow = {
      event_id: string;
      venue_name: string | null;
      venue_setting: string | null;
      landing_page_visibility: string | null;
    };
    const evMap = new Map<string, EvRow>();
    for (const r of (evRows ?? []) as EvRow[]) evMap.set(r.event_id, r);

    const dirMap = new Map<string, string>();
    for (const r of (vRows ?? []) as { event_id: string; source_venue_directory_id: string | null }[]) {
      if (r.source_venue_directory_id && !dirMap.has(r.event_id)) {
        dirMap.set(r.event_id, r.source_venue_directory_id);
      }
    }

    const out: VendorVenueEvent[] = [];
    for (const c of completed) {
      const ev = evMap.get(c.event_id);
      if (!ev) continue;
      // Respect the couple's private-by-default choice — never surface a private
      // event on a vendor's public page.
      if (ev.landing_page_visibility === 'private') continue;
      const venueDirectoryId = dirMap.get(c.event_id) ?? null;
      out.push({
        eventId: c.event_id,
        eventType: c.event_type,
        eventDate: c.event_date,
        completedAt: c.completed_at,
        venueName: ev.venue_name ?? null,
        venueSetting: ev.venue_setting ?? null,
        venueDirectoryId,
        atViewerVenue: matchesViewerVenue(
          { venueName: ev.venue_name ?? null, venueDirectoryId },
          viewer,
        ),
      });
    }
    return orderVenueMatchedFirst(out).slice(0, limit);
  } catch {
    return [];
  }
}
