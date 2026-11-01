import 'server-only';

/**
 * lib/planning-progress.server.ts — "HOW FAR ALONG IS THE PLAN" for a surface that only COUNTS (owner 2026-11-01,
 * "Checklist merges into Planning Stage": *"Home keeps its progress count, now read from the one list"*).
 *
 * The events board's "% planned · N overdue", the coordinator's "Events you run" and the Overview's "N% done" chip
 * used to count `event_checklist_items` on their own. They now read the ONE list (`fetchPreparationAgenda`, its To do
 * filter) and count it with the ONE rule (`planningProgress`) — the same answer Planning Stage and Home's To do tile
 * give. Held by `lib/the-plan-is-one-list.test.ts`.
 *
 * Answers:
 *   · `null`  — a read was refused (say "couldn't load", never 0).
 *   · `{ total: 0 }` — genuinely nothing to tick yet (no percentage exists to state; callers show none).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPreparationAgenda, planningProgress, type PlanningProgress, type PlanningTaskEvent } from './preparation';
import { resolveProfile } from './event-type-profile';
import { logQueryError } from './supabase/error-detect';

/** The event columns the To do filter's dates are counted back from — this reader's own narrow read, not a canonical list. */
const DATE_FIELDS_READ = 'event_type, event_date, date_candidates, date_window_start, created_at';

export async function readPlanningProgress(
  supabase: SupabaseClient,
  eventId: string,
  /** The event's date fields when the caller already holds the row; read here otherwise (one more query). */
  known?: PlanningTaskEvent | null,
  now: Date = new Date(),
): Promise<PlanningProgress | null> {
  try {
    let event = known ?? null;
    if (!event) {
      const { data, error } = await supabase.from('events').select(DATE_FIELDS_READ).eq('event_id', eventId).maybeSingle();
      if (error) {
        logQueryError('readPlanningProgress.event', error, { event_id: eventId }, 'graceful_degrade');
        return null;
      }
      if (!data) return null;
      event = data as unknown as PlanningTaskEvent;
    }
    const profile = await resolveProfile(event.event_type ?? 'wedding');
    const agenda = await fetchPreparationAgenda({
      supabase,
      eventId,
      eventDate: event.event_date,
      ceremonyType: null,
      now,
      event,
      profile,
      only: 'todo',
    });
    if (agenda.unread.length > 0) return null;
    return planningProgress(agenda.items);
  } catch {
    return null;
  }
}
