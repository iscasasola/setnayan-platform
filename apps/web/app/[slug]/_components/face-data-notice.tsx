import { eventWordsForEvent } from '../_lib/event-words';
import { SubmitButton } from '@/app/_components/submit-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { withdrawFaceConsent, setGuestFaceBlock } from '../actions';

/**
 * This guest's CURRENT FaceBlock setting, read here rather than threaded down.
 *
 * Either side may have moved it (owner ruling 3, 2026-08-17), so the value must
 * be read at render — a prop carried from a page that loaded before the couple
 * flipped it would show the guest a switch in the wrong position, which on a
 * privacy control is worse than no switch at all.
 *
 * ⚠ FAILS TOWARD "NOT BLURRED". A read error returns false, so the control
 * offers to turn blurring ON. That is the honest direction: the alternative
 * tells a guest they are already blurred on the strength of a failed read.
 * The GATE itself is in the database and is unaffected by this — this value
 * only decides which sentence and which button the guest sees.
 */
async function readFaceBlock(eventId: string, guestId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient()
      .from('guests')
      .select('faceblock_enabled')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (error) return false;
    return (data as { faceblock_enabled?: boolean } | null)?.faceblock_enabled === true;
  } catch {
    return false;
  }
}

// Guest-facing face controls (RA 10173). Shown under the RSVP once the guest has
// a stored selfie; separate forms so neither ever nests in the RSVP form.
//
// TWO DIFFERENT THINGS, DELIBERATELY NOT ONE TOGGLE:
//   • FaceBlock  — "keep finding my photos, just blur my face on the venue
//     screens." Reversible, and what the live /privacy notice has always told
//     guests they can do for themselves.
//   • Remove my face data — "forget me": deletes the face data and pulls every
//     auto-tag. Not reversible.
// Collapsing them would make the gentler choice cost the guest their photos.
export async function FaceDataNotice({
  eventId,
  guestId,
}: {
  eventId: string;
  guestId: string;
}) {
  const [w, faceblockEnabled] = await Promise.all([
    eventWordsForEvent(eventId),
    readFaceBlock(eventId, guestId),
  ]);
  const withdraw = withdrawFaceConsent.bind(null, eventId, guestId);
  const toggleBlur = setGuestFaceBlock.bind(null, eventId, guestId, !faceblockEnabled);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3 text-xs text-ink/60">
        <p className="min-w-0">
          Your photo is set up for face recognition at this {w.eventWord}, so
          {' '}{w.theOrganizerPossessive} photographers can find your candid shots.
        </p>

        {/* The gentle option first — it is the one most people want, and putting
            the irreversible one first invites using it by mistake. */}
        <form action={toggleBlur} className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0">
            {faceblockEnabled
              ? 'Your face is blurred on the screens at the venue.'
              : 'Your face can appear on the screens at the venue.'}
          </span>
          <SubmitButton
            className="shrink-0 font-medium text-mulberry underline-offset-2 hover:underline"
            pendingLabel={faceblockEnabled ? 'Turning off…' : 'Blurring…'}
          >
            {faceblockEnabled ? 'Show my face again' : 'Blur my face on the screens'}
          </SubmitButton>
        </form>
      </div>

      <form
        action={withdraw}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-cream px-4 py-3 text-xs text-ink/60"
      >
        <span className="min-w-0">
          Or remove your photo and face data from this {w.eventWord} altogether.
          {' '}You will stop being found in candid shots.
        </span>
        <SubmitButton
          className="shrink-0 font-medium text-mulberry underline-offset-2 hover:underline"
          pendingLabel="Removing…"
        >
          Remove my photo &amp; face data
        </SubmitButton>
      </form>
    </div>
  );
}
