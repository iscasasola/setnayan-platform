import { redirect } from 'next/navigation';
import EventDetailsPage from '../../page';
import { RecordFieldSlot } from '../../_components/record-field-slot';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { eventMemberTypeOnce } from '@/lib/event-membership-once';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { COUPLE_RECORD_FIELD_FORWARD, coupleRecordFieldForward } from '@/lib/record-field-couple-forward';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event Details' };

/**
 * A row's field, loaded ON ITS OWN (a refresh, a shared link): the record, with
 * that row's field open over it — the same two parts the record and its
 * intercepted field draw (`../../page.tsx` + `RecordFieldSlot`), never a copy.
 *
 * 🚪 For the COUPLE, a row whose fact left the record (`COUPLE_RECORD_FIELD_FORWARD`) lands on the real switch
 * instead — the record would send them to Event Settings, which has no row for it (the "Switch Papic on" door).
 * Asked only for those rows, so every other field address reads nothing extra.
 */
export default async function RecordFieldPage({ params }: { params: Promise<{ eventId: string; row: string }> }) {
  const { eventId, row } = await params;
  if (Object.prototype.hasOwnProperty.call(COUPLE_RECORD_FIELD_FORWARD, row)) {
    const user = await getCurrentUser();
    if (user) {
      const member = await eventMemberTypeOnce(await createClient(), eventId, user.id);
      if ((member.data as { member_type?: string } | null)?.member_type === 'couple') {
        const to = coupleRecordFieldForward(eventId, row, surfaceEnabled(await resolveProfileByEvent(eventId), 'website'));
        if (to) redirect(to);
      }
    }
  }
  return (
    <>
      <EventDetailsPage params={Promise.resolve({ eventId })} />
      <RecordFieldSlot eventId={eventId} row={row} />
    </>
  );
}
