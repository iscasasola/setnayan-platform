import { ScanFace } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { eventTypeForcesModeB } from '@/lib/papic-face-mode';
import { setCoupleFaceTaggingDeclined } from '../face-tagging-actions';

/**
 * "Finding people in photos" — the couple's own say over face tagging.
 *
 * ── WHY THIS CARD EXISTS ────────────────────────────────────────────────────
 * Face tagging was optional at every level except the one that matters most.
 * The guest chooses (the enrolment block is skippable and stores nothing
 * without two ticks). An admin chooses, per event. The couple — whose wedding
 * it is, and whose guests they are — had no lever at all.
 *
 * ── IT ONLY EVER SAYS NO ────────────────────────────────────────────────────
 * The card renders nothing when face tagging is not available for this event,
 * because "turn it on" is not a thing a couple can do. Offering a control that
 * silently cannot enable anything is the empty-promise shape this project keeps
 * getting caught by; an absent card is the honest version.
 */
export async function FaceTaggingChoice({ eventId }: { eventId: string }) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('events')
    .select('papic_face_mode, event_type, face_tagging_declined_by_couple')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    papic_face_mode: string | null;
    event_type: string | null;
    face_tagging_declined_by_couple: boolean | null;
  };

  // Nothing to decline if it was never available. Christening/debut are locked
  // off regardless, and an event an admin has not enabled has nothing to switch.
  if (eventTypeForcesModeB(row.event_type)) return null;
  if (row.papic_face_mode !== 'mode_a') return null;

  const declined = row.face_tagging_declined_by_couple === true;

  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ScanFace aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          Finding people in photos
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          {declined ? (
            <>
              Off for your event. Guests get their photos when someone scans their QR
              or tags them — nobody&rsquo;s face is measured.
            </>
          ) : (
            <>
              Guests who choose to add a selfie get their photos found for them
              automatically. It is always their choice — nothing is stored unless
              they agree — and you can switch it off for your whole event.
            </>
          )}
        </p>
      </div>

      <form action={setCoupleFaceTaggingDeclined}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="declined" value={declined ? '0' : '1'} />
        <SubmitButton
          pendingLabel="Saving…"
          className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10"
        >
          {declined ? 'Turn it back on' : 'Turn it off for my event'}
        </SubmitButton>
      </form>
    </section>
  );
}
