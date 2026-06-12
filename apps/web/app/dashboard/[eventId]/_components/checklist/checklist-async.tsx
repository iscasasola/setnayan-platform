import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchChecklistItems, rankUrgentChecklistItems } from '@/lib/checklist';
import { ensureChecklistSeeded } from '../../checklist-actions';
import { ChecklistCard } from './checklist-card';

/**
 * ChecklistAsync — streams the home "Up next" checklist card in its own
 * <Suspense> boundary, mirroring UpcomingSchedulesAsync. Kept OUT of the
 * event-home Promise.all so it can't add latency to (or crash) the shell.
 *
 * Self-contained: seeds the template on first open, fetches the rows, ranks the
 * top-3 urgent open items for the couple's runway, and renders the card. Every
 * step graceful-degrades — a missing migration or a query error renders nothing
 * (the section just doesn't appear) instead of bubbling to the error boundary.
 */

type Props = {
  eventId: string;
  eventDate: string | null;
  /** Server clock so due tags are stable between render and hydration. */
  now: Date;
  /** Top-N urgent items to surface. The brief asks for 3. */
  limit?: number;
};

export async function ChecklistAsync({ eventId, eventDate, now, limit = 3 }: Props) {
  // Seed-on-first-open (idempotent · no-op once rows exist). Failure is silent
  // by contract inside the action — fall through to the fetch regardless.
  try {
    await ensureChecklistSeeded(eventId);
  } catch (caught) {
    logQueryError(
      'ChecklistAsync (ensureChecklistSeeded threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const supabase = await createClient();
  const rows = await fetchChecklistItems(supabase, eventId).catch((caught: unknown) => {
    logQueryError(
      'ChecklistAsync (fetchChecklistItems threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
    return [] as Awaited<ReturnType<typeof fetchChecklistItems>>;
  });

  if (rows.length === 0) return null;

  const top = rankUrgentChecklistItems(rows, eventDate, { limit, now });
  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <ChecklistCard
      eventId={eventId}
      items={top}
      totalCount={rows.length}
      doneCount={doneCount}
    />
  );
}

export function ChecklistSkeleton() {
  return (
    <section className="space-y-3" aria-hidden>
      <div className="h-3 w-20 rounded bg-ink/10" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl border border-ink/10 bg-white" />
        ))}
      </div>
    </section>
  );
}
