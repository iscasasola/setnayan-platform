import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchChecklistItems, groupChecklistByPhase } from '@/lib/checklist';
import { ensureChecklistSeeded } from '../checklist-actions';
import { ChecklistFull } from '../_components/checklist/checklist-full';

export const metadata = { title: 'Wedding checklist · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/[eventId]/checklist — the full, browsable wedding checklist.
 *
 * The home card shows only the top-3 urgent items; this is the complete list,
 * grouped by countdown phase. Visiting also top-ups any tasks the event is
 * missing (idempotent) so couples seeded under an older template gain the rest.
 * Every step graceful-degrades — a missing migration renders the empty state
 * rather than crashing.
 */
export default async function EventChecklistPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Top-up missing template tasks on open (idempotent · ceremony-tailored).
  try {
    await ensureChecklistSeeded(eventId);
  } catch (caught) {
    logQueryError(
      'EventChecklistPage (ensureChecklistSeeded threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const { data: eventRow } = await supabase
    .from('events')
    .select('event_date')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventDate = (eventRow?.event_date as string | null) ?? null;

  const rows = await fetchChecklistItems(supabase, eventId);
  const now = new Date();
  const groups = groupChecklistByPhase(rows, eventDate, now);
  const doneCount = rows.filter((r) => r.status === 'done').length;

  return (
    <ChecklistFull
      eventId={eventId}
      groups={groups}
      totalCount={rows.length}
      doneCount={doneCount}
      eventDate={eventDate}
    />
  );
}
