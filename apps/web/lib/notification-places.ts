import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { EventPlaceFact } from '@/lib/notification-place';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-columns';
import type { NotificationRow } from '@/lib/notifications';

// Its own module ON PURPOSE: `lib/notifications.ts` is imported by the client notification list for its pure helpers,
// and HERO_MONOGRAM_COLUMNS drags a server-only chain (entitlements -> supabase admin) into that client bundle.

/**
 * WHICH EVENT EACH ROW IS FROM, AND WHICH SIDE OF IT YOU ARE ON — one batch beside `fetchOwnNotifications`, never a
 * read per row (owner 2026-11-13, the notification place; `lib/notification-place.ts`).
 *
 * Two reads, side by side, for the DISTINCT `event_id`s of the rows: `events` (the name + the EventMonogram columns)
 * and this login's own `event_members` seats. RLS scopes both. 🔒 HONEST: either read refused → `null`, and the list
 * then says "Place didn't load" on every event row — never an empty map, which would read as "these events are gone".
 * An event the read does not return (removed, or not this login's to see) is simply absent: that row says it too.
 */
export async function fetchNotificationEventPlaces(
  supabase: SupabaseClient,
  userId: string,
  rows: ReadonlyArray<Pick<NotificationRow, 'event_id'>>,
): Promise<Map<string, EventPlaceFact> | null> {
  const ids = [...new Set(rows.map((r) => r.event_id).filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const out = new Map<string, EventPlaceFact>();
  if (ids.length === 0) return out;
  try {
    const [eventsRes, seatsRes] = await Promise.all([
      supabase
        .from('events')
        .select(`event_id, ${HERO_MONOGRAM_COLUMNS}`)
        .in('event_id', ids),
      supabase.from('event_members').select('event_id, member_type').eq('user_id', userId).in('event_id', ids),
    ]);
    if (eventsRes.error || seatsRes.error) {
      logQueryError(
        'fetchNotificationEventPlaces',
        eventsRes.error ?? seatsRes.error,
        { user_id: userId, events: ids.length },
        'graceful_degrade',
      );
      return null;
    }
    const seat = new Map<string, string>();
    for (const m of (seatsRes.data ?? []) as Array<{ event_id: string; member_type: string }>) {
      // A couple seat outranks any other seat this login holds on the same event.
      if (!seat.has(m.event_id) || m.member_type === 'couple') seat.set(m.event_id, m.member_type);
    }
    for (const e of (eventsRes.data ?? []) as Array<Omit<EventPlaceFact, 'member_type'>>) {
      out.set(e.event_id, { ...e, member_type: seat.get(e.event_id) ?? null });
    }
    return out;
  } catch (caught) {
    logQueryError(
      'fetchNotificationEventPlaces (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { user_id: userId },
      'graceful_degrade',
    );
    return null;
  }
}
