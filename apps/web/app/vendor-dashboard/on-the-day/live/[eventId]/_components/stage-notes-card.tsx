import { MessageSquare } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { Badge } from '@/app/_components/badge';
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
    <section className="border-l-2 border-gild pl-3">
      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        <MessageSquare aria-hidden className="h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={1.75} />
        From your coordinator
        {unread > 0 ? (
          <span className="normal-case tracking-normal">
            <Badge tone="wait">{unread} new</Badge>
          </span>
        ) : null}
      </h4>

      <ul className="mt-1 divide-y divide-[color:var(--m-line)]">
        {notes.map((n) => (
          <li key={n.noteId} className="py-2.5">
            <p className={`text-sm leading-relaxed ${n.readAt ? 'text-[color:var(--m-slate-2)]' : 'text-ink'}`}>{n.body}</p>
            {n.readAt === null ? (
              <form action={markStageNoteSeen} className="mt-1">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="note_id" value={n.noteId} />
                <SubmitButton
                  pendingLabel="…"
                  className="ab ab-neutral quiet inline-flex min-h-11 items-center justify-center"
                >
                  Got it
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-0.5 text-sm text-[color:var(--m-slate-2)]">Seen</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
