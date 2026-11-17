import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import type { CheckDateEvent } from '@/lib/check-a-date';


/**
 * Who is looking at Check a date — only to offer their own events at the event step. Moved whole from
 * `app/v/[slug]/dates/page.tsx` (SHOP-02 v7: the sheet now opens over the shop, so the shop page reads it too).
 * A refused read is "signed out", never an error.
 */
export async function readCheckADateViewer(today: string): Promise<{ signedIn: boolean; events: CheckDateEvent[] }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return { signedIn: false, events: [] };
    const [mine, types] = await Promise.all([fetchUserEvents(supabase, user.id, 'couple'), getCreatableEventTypes().catch(() => [])]);
    const typeLabel = new Map(types.map((t) => [t.key, t.label]));
    return {
      signedIn: true,
      events: mine
        .filter((e) => !e.archived && (!e.event_date || (e.event_end_date ?? e.event_date) >= today))
        .map((e) => ({
          eventId: e.event_id,
          name: e.display_name,
          typeLabel: typeLabel.get(e.event_type) ?? null,
          eventType: e.event_type,
          date: e.event_date,
          endDate: e.event_end_date ?? null,
        })),
    };
  } catch {
    return { signedIn: false, events: [] };
  }
}
