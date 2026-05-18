import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EventRow = {
  event_id: string;
  public_id: string;
  event_type:
    | 'wedding'
    | 'birthday'
    | 'celebration'
    | 'travel'
    | 'corporate'
    | 'tournament'
    | 'christening';
  display_name: string;
  event_date: string | null;
  is_primary: boolean;
  archived: boolean;
  venue_name: string | null;
  venue_address: string | null;
  /**
   * Per-event monogram from iteration 0002 § Branding (locked 2026-05-13).
   * Both columns may be null — the dashboard chrome falls back to the
   * derived `M & J`-style monogram from `display_name` when text is null.
   */
  monogram_text: string | null;
  monogram_color: string | null;
};

export type EventWithRole = EventRow & {
  member_type: 'couple' | 'guest' | 'vendor' | 'coordinator';
};

type MembershipQueryRow = {
  member_type: EventWithRole['member_type'];
  events: EventRow | EventRow[] | null;
};

/**
 * Fetches every event the signed-in user is a member of. Returns the rows
 * sorted with primary events first, then by event date ascending.
 *
 * RLS already filters to the current user via Pattern B + Pattern A overlap;
 * the `.eq('user_id', userId)` is a defense-in-depth narrowing.
 *
 * Wrapped in React `cache()` so the outer dashboard layout and the per-event
 * layout (which both need the switcher list) share a single round-trip per
 * request. Cache key is (supabase, userId, memberType); the cached Supabase
 * client (lib/supabase/server.ts) keeps the first arg identity-stable so
 * the dedupe actually fires.
 */
export const fetchUserEvents = cache(async (
  supabase: SupabaseClient,
  userId: string,
  memberType?: EventWithRole['member_type'],
): Promise<EventWithRole[]> => {
  let query = supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id,
         public_id,
         event_type,
         display_name,
         event_date,
         is_primary,
         archived,
         venue_name,
         venue_address,
         monogram_text,
         monogram_color
       )`,
    )
    .eq('user_id', userId);

  if (memberType) {
    query = query.eq('member_type', memberType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as MembershipQueryRow[];

  const events: EventWithRole[] = rows
    .flatMap((row) => {
      const eventArray = Array.isArray(row.events)
        ? row.events
        : row.events
          ? [row.events]
          : [];
      return eventArray.map((e) => ({ ...e, member_type: row.member_type }));
    })
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
      if (a.event_date) return -1;
      if (b.event_date) return 1;
      return 0;
    });

  return events;
});

// Post-wedding grace window before an event flips to "expired" on the
// event-switcher carousel and on per-feature App Store-detail surfaces.
// Mirrors EXPIRATION_GRACE_DAYS in lib/add-on-state.ts — keep both in sync.
const EVENT_EXPIRATION_GRACE_DAYS = 90;

/**
 * Returns TRUE when the event has passed its post-wedding grace cutoff,
 * matching the App Store-detail page's "expired" state (lib/add-on-state.ts).
 * Archived events are NOT classified as expired here — the dashboard layout
 * filters archived events out of the switcher upstream.
 */
export function isEventExpiredForSwitcher(
  event: Pick<EventRow, 'event_date'>,
): boolean {
  if (!event.event_date) return false;
  const eventDate = new Date(event.event_date);
  if (Number.isNaN(eventDate.getTime())) return false;
  const cutoff = new Date(eventDate);
  cutoff.setDate(cutoff.getDate() + EVENT_EXPIRATION_GRACE_DAYS);
  return cutoff.getTime() < Date.now();
}

/**
 * Sort the events feed for the chrome event-switcher carousel:
 *   1. Active events first — primary first, then event_date ascending.
 *   2. Expired events pushed to the end — newest-expired first,
 *      oldest-expired last (i.e. event_date descending), so the oldest
 *      expired event lands at the rightmost / final slot.
 *
 * Owner directive 2026-05-17 — "Expired Events will be at the right most
 * of the lists. (oldest expired is the farthest)."
 */
export function sortEventsForSwitcher<T extends EventRow>(events: T[]): T[] {
  const active: T[] = [];
  const expired: T[] = [];
  for (const e of events) {
    if (isEventExpiredForSwitcher(e)) expired.push(e);
    else active.push(e);
  }
  active.sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    if (a.event_date && b.event_date) return a.event_date.localeCompare(b.event_date);
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return 0;
  });
  expired.sort((a, b) => {
    if (a.event_date && b.event_date) return b.event_date.localeCompare(a.event_date);
    if (a.event_date) return -1;
    if (b.event_date) return 1;
    return 0;
  });
  return [...active, ...expired];
}

export function formatEventDate(iso: string | null, locale = 'en-US'): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
