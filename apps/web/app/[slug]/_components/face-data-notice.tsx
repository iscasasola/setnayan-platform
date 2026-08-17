import { eventWordsForEvent } from '../_lib/event-words';
import { SubmitButton } from '@/app/_components/submit-button';
import { withdrawFaceConsent } from '../actions';

// Guest-facing face-data withdrawal (RA 10173). Shown under the RSVP once the
// guest has a stored selfie; a separate form so it never nests in the RSVP form.
export async function FaceDataNotice({
  eventId,
  guestId,
}: {
  eventId: string;
  guestId: string;
}) {
  const action = withdrawFaceConsent.bind(null, eventId, guestId);
  const w = await eventWordsForEvent(eventId);
  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-xs text-ink/60"
    >
      <span className="min-w-0">
        Your photo is set up for face recognition at this {w.eventWord}, so
        {' '}{w.theOrganizerPossessive} photographers can find your candid shots.
      </span>
      <SubmitButton
        className="shrink-0 font-medium text-terracotta underline-offset-2 hover:underline"
        pendingLabel="Removing…"
      >
        Remove my photo &amp; face data
      </SubmitButton>
    </form>
  );
}
