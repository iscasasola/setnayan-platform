import { MessageSquare } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { unreadCount, type StageNote } from '@/lib/stage-notes';
import { markStageNoteSeen } from './stage-notes-actions';

/**
 * "From your coordinator" — on the emcee's own desk, above their script.
 *
 * ── ABOVE THE SCRIPT, ON PURPOSE ────────────────────────────────────────────
 * A note from the coordinator is almost always a change to what happens next —
 * "skip the toast, the father is still parking". Below the script it is
 * something you find afterwards.
 *
 * The card renders only when there is something to read. An always-present
 * empty inbox on a live console is furniture, and furniture gets ignored.
 */
export function StageNotesCard({
  eventId,
  notes,
}: {
  eventId: string;
  notes: StageNote[];
}) {
  const unread = unreadCount(notes);
  return (
    <section className="border border-gild/40 bg-paper p-4">
      <h4 className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
        <MessageSquare aria-hidden className="h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={1.75} />
        From your coordinator
        {unread > 0 ? (
          <span className="rounded-full bg-gild/20 px-2 py-0.5 text-[0.6rem] tracking-normal text-ink">
            {unread} new
          </span>
        ) : null}
      </h4>

      <ul className="mt-3 space-y-3">
        {notes.map((n) => (
          <li key={n.noteId} className={n.readAt ? 'opacity-60' : ''}>
            <p className="text-sm leading-relaxed text-ink">{n.body}</p>
            {n.readAt === null ? (
              <form action={markStageNoteSeen} className="mt-1">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="note_id" value={n.noteId} />
                <SubmitButton
                  pendingLabel="…"
                  className="text-xs font-medium text-ink/55 underline underline-offset-2 hover:text-ink"
                >
                  Got it
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-0.5 text-[0.7rem] text-ink/45">Seen</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
