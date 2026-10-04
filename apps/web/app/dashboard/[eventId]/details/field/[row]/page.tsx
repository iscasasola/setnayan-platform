import EventDetailsPage from '../../page';
import { RecordFieldSlot } from '../../_components/record-field-slot';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event Details' };

/**
 * A row's field, loaded ON ITS OWN (a refresh, a shared link): the record, with
 * that row's field open over it — the same two parts the record and its
 * intercepted field draw (`../../page.tsx` + `RecordFieldSlot`), never a copy.
 */
export default async function RecordFieldPage({ params }: { params: Promise<{ eventId: string; row: string }> }) {
  const { eventId, row } = await params;
  return (
    <>
      <EventDetailsPage params={Promise.resolve({ eventId })} />
      <RecordFieldSlot eventId={eventId} row={row} />
    </>
  );
}
