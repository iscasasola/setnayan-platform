import { Megaphone } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchEmceeRecipients } from '@/lib/stage-notes-recipients';
import { STAGE_NOTE_MAX } from '@/lib/stage-notes';
import { sendStageNote } from './stage-notes-actions';

/**
 * "Tell the host" — on the coordinator's floor console.
 *
 * Renders nothing when the event has no host booked. An always-present send box
 * addressed to nobody is a promise the product cannot keep, and on a live floor
 * a control that silently does nothing is worse than an absent one.
 *
 * One recipient per form. If a wedding somehow has two hosts, each gets their
 * own box rather than a picker — on a dark floor mid-service, a dropdown you
 * can mis-set is a way to send the wrong person an instruction.
 */
export async function StageNoteCompose({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  // The service-category half is read with the service-role client: this
  // console is already gated to the booked coordinator, and `vendor_services`
  // is only readable under RLS for PUBLISHED shops — which would drop a booked
  // supplier from the answer with no error at all. See fetchEmceeRecipients.
  const hosts = await fetchEmceeRecipients(supabase, eventId, createAdminClient());
  if (hosts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        <Megaphone aria-hidden className="h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={1.75} />
        Tell the host
      </h4>
      <p className="text-sm text-[color:var(--m-slate-2)]">
        Goes straight to their script screen. They see it and nothing else of yours.
      </p>

      {hosts.map((h) => (
        <form key={h.vendorProfileId} action={sendStageNote} className="space-y-2">
          <input type="hidden" name="event_id" value={eventId} />
          <input
            type="hidden"
            name="recipient_vendor_profile_id"
            value={h.vendorProfileId}
          />
          <label className="sr-only" htmlFor={`note-${h.vendorProfileId}`}>
            Note to {h.name}
          </label>
          <textarea
            id={`note-${h.vendorProfileId}`}
            name="body"
            rows={2}
            maxLength={STAGE_NOTE_MAX}
            placeholder={`e.g. Hold the toast — the father is still parking.`}
            className="w-full rounded-lg border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-sm text-ink"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[color:var(--m-slate-2)]">To {h.name}</span>
            <SubmitButton
              pendingLabel="Sending…"
              className="ab ab-brand inline-flex min-h-11 items-center justify-center"
            >
              Send
            </SubmitButton>
          </div>
        </form>
      ))}
    </section>
  );
}
