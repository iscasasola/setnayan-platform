import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { manilaToday } from '@/lib/std-views';
import { COORDINATOR_SEAT_ROLE, eventsYouRun, type CoordinatorSeatRow, type EventYouRun } from './events-you-run';

/**
 * events-you-run.server.ts — the ONE read behind the coordinator's door (owner "approved", 2026-10-28).
 *
 * The signed-in person's own coordinator seats, as THEMSELVES (the user client, their RLS — the same row
 * `app/dashboard/[eventId]/layout.tsx` reads to admit them), with the event's name, date and place embedded. The rule
 * that turns a row into a door is pure and lives in `events-you-run.ts`.
 *
 * `cache()` per request: the supplier layout (the Events tab), Today ("Events you run"), the Events page and the
 * customer card ("Open their event") all ask, and pay one trip between them.
 *
 * ⛔ FAILS CLOSED. A refused read is `{ events: [], measured: false }` — no tab, no row, no button. A door drawn from
 * a read that did not happen is a dead tab, which the owner ruled out; and none of these is the coordinator's only way
 * in (the events board's helper cards — `fetchUserEvents(…, 'coordinator')` — still list the event).
 */
export const readEventsYouRun = cache(
  async (supabase: SupabaseClient, userId: string): Promise<{ events: EventYouRun[]; measured: boolean }> => {
    const { data, error } = await supabase
      .from('event_moderators')
      .select(
        `event_id, role_subtype, permissions_json, accepted_at, removed_at,
         events:event_id ( event_id, display_name, event_type, event_date, event_end_date, event_date_precision, venue_name )`,
      )
      .eq('user_id', userId)
      .eq('role_subtype', COORDINATOR_SEAT_ROLE)
      .not('accepted_at', 'is', null)
      .is('removed_at', null);
    if (error) {
      logQueryError('readEventsYouRun', error, { user_id: userId }, 'graceful_degrade');
      return { events: [], measured: false };
    }
    return {
      events: eventsYouRun((data ?? []) as unknown as CoordinatorSeatRow[], new Date(), manilaToday()),
      measured: true,
    };
  },
);
