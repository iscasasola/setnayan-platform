import { AlertTriangle, Check, Megaphone } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SubmitButton } from '@/app/_components/submit-button';
import { STAGE_NOTE_MAX, fetchStageNotes, type StageNote } from '@/lib/stage-notes';
import { fetchEmceeRecipients } from '@/lib/stage-notes-recipients';
import { sendStageNoteFromEvent } from '../stage-note-actions';

/**
 * "TELL THE HOST" — the same send box the supplier floor console has, on the
 * surface the couple's own floor-runner actually works from.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * The coordinator → emcee channel shipped with its send box inside
 * `/vendor-dashboard/on-the-day/live/[eventId]`. That console belongs to a
 * BOOKED SUPPLIER. When the floor is run by the couple's aunt — the ordinary
 * Filipino-wedding case — she has no supplier account, so the one person the
 * channel was built for could not reach it. Same table, same policy, same
 * validation; a screen where she already is.
 *
 * ── WHAT DECIDES WHETHER IT APPEARS ─────────────────────────────────────────
 * Two things, and both must hold:
 *   1. This event has a host/MC booked. No host ⇒ no section. A send box
 *      addressed to nobody is a promise the product cannot keep.
 *   2. The viewer is admitted by the note's own INSERT policy — the couple, or
 *      a delegate the couple gave the running order to. `canSend` is the SAME
 *      value the page already computes for the run-of-show advance button,
 *      because the note policy and the advance gate admit the same people.
 *
 * ⚠ Hiding this is PRESENTATION, never the boundary. The gate is
 * `event_stage_notes_event_insert`; a viewer who slipped past this check would
 * still be refused by the database, and the action reports that refusal rather
 * than swallowing it.
 *
 * ── ONE FORM PER HOST, NOT A PICKER ─────────────────────────────────────────
 * Matching the supplier console deliberately. Mid-reception, a dropdown you can
 * mis-set is a way to send the wrong person an instruction.
 */
export async function TellTheHost({
  supabase,
  eventId,
  canSend,
  flash,
}: {
  supabase: SupabaseClient;
  eventId: string;
  canSend: boolean;
  /** `?note=sent|error` — set by the send action's redirect. */
  flash: 'sent' | 'error' | null;
}) {
  if (!canSend) return null;

  const hosts = await fetchEmceeRecipients(supabase, eventId);
  if (hosts.length === 0) return null;

  // What has already gone across, so "did he get it?" is answerable here rather
  // than by walking to the booth. The sender may read these by policy
  // (`event_stage_notes_sender_read`).
  //
  // ⚠ `fetchStageNotes` returns [] on a failed read as well as on a genuinely
  // empty channel — the two are indistinguishable to this component. So an
  // empty result renders NOTHING at all; it never says "you have sent nothing",
  // which is the version that would lie after an error.
  const sent = await Promise.all(
    hosts.map(async (h) => ({
      host: h,
      notes: await fetchStageNotes(supabase, eventId, h.vendorProfileId),
    })),
  );

  return (
    <section
      id="tell-the-host"
      className="sn-row space-y-4 p-4 sm:p-5"
      aria-labelledby="tell-the-host-heading"
    >
      <div className="space-y-1">
        <h3
          id="tell-the-host-heading"
          className="flex items-center gap-2 text-sm font-semibold text-ink"
        >
          <Megaphone aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
          Tell the host
        </h3>
        <p className="text-xs text-ink/60">
          Goes straight to the screen your host reads from. They see your note and nothing
          else of yours.
        </p>
      </div>

      {flash === 'sent' ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-terracotta/[0.06] px-3 py-2 text-xs text-ink/75"
        >
          <Check aria-hidden className="h-3.5 w-3.5 flex-none text-terracotta" strokeWidth={2.25} />
          Sent. It shows on their screen right away.
        </p>
      ) : null}
      {flash === 'error' ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-ink/[0.05] px-3 py-2 text-xs text-ink/80"
        >
          <AlertTriangle aria-hidden className="h-3.5 w-3.5 flex-none text-terracotta" strokeWidth={2.25} />
          That didn&rsquo;t send. Nothing reached your host — please try again.
        </p>
      ) : null}

      {sent.map(({ host, notes }) => (
        <div key={host.vendorProfileId} className="space-y-2">
          <form action={sendStageNoteFromEvent} className="space-y-2">
            <input type="hidden" name="event_id" value={eventId} />
            <input
              type="hidden"
              name="recipient_vendor_profile_id"
              value={host.vendorProfileId}
            />
            <label className="sr-only" htmlFor={`host-note-${host.vendorProfileId}`}>
              Note to {host.name}
            </label>
            <textarea
              id={`host-note-${host.vendorProfileId}`}
              name="body"
              rows={2}
              maxLength={STAGE_NOTE_MAX}
              placeholder="e.g. Hold the toast — Papa is still parking."
              className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta/50 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink/55">To {host.name}</span>
              <SubmitButton
                pendingLabel="Sending…"
                overlay={false}
                className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-3 py-2 text-sm font-medium text-cream transition-colors hover:bg-terracotta-800 disabled:opacity-50"
              >
                Send
              </SubmitButton>
            </div>
          </form>

          {notes.length > 0 ? <SentList notes={notes} /> : null}
        </div>
      ))}
    </section>
  );
}

/**
 * The last few notes, with an honest receipt.
 *
 * "Seen" is stamped by the HOST and only the host — the sender cannot mark
 * their own note read, by policy. That is what makes this line worth trusting
 * on a night when it matters.
 */
function SentList({ notes }: { notes: StageNote[] }) {
  return (
    <ul className="space-y-1.5 border-t border-ink/10 pt-2">
      {notes.slice(0, 5).map((n) => (
        <li key={n.noteId} className="flex items-start justify-between gap-3">
          <span className="text-xs leading-relaxed text-ink/70">{n.body}</span>
          <span
            className={`mt-0.5 flex-none font-mono text-[10px] uppercase tracking-[0.14em] ${
              n.readAt ? 'text-terracotta' : 'text-ink/40'
            }`}
          >
            {n.readAt ? 'Seen' : 'Sent'}
          </span>
        </li>
      ))}
    </ul>
  );
}
