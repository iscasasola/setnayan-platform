import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { detailsItemHref, makerHasWork } from '@/lib/maker-details-items';
import { logQueryError } from '@/lib/supabase/error-detect';
import { MoodBoardEditor } from './_components/mood-board-editor';

export const metadata = { title: 'Mood Board' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * /dashboard/<id>/studio/mood-board — the Mood Board's old address.
 *
 * 🧭 FOR THE COUPLE IT LANDS ON DETAILS (owner 2026-09-29, verbatim: *"schedule,
 * mood board and seat plan will be inside"*; DECISION_LOG "SCHEDULE, MOOD BOARD
 * AND SEAT PLAN MOVE INSIDE THE EVENT HUB (DETAILS) … Old routes land on the
 * Details item"): every door that still points here — the event menu's row,
 * the studio tile, a checklist link, a bookmark — opens the Event Hub Maker's
 * Details → Look → Mood Board, the same board.
 *
 * Everyone the Maker is not for keeps this page, drawn by the SAME component
 * (`MoodBoardEditor`): a coordinator or planner, and an event type with no
 * Event Hub (`makerHasWork`, the launch page's own rule). A membership read that
 * fails keeps this page too — it never sends anyone to a Maker on a guess.
 */
export default async function MoodBoardPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership, error } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) logQueryError('MoodBoardPage.membership', error, { event_id: eventId }, 'graceful_degrade');
  const memberType = (membership as { member_type?: string | null } | null)?.member_type ?? null;
  if (memberType === 'couple') {
    const websiteOn = surfaceEnabled(await resolveProfileByEvent(eventId), 'website');
    if (makerHasWork(memberType, websiteOn)) redirect(detailsItemHref(eventId, 'mood-board'));
  }

  return <MoodBoardEditor eventId={eventId} />;
}
