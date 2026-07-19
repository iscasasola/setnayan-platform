import { Check, Clock3, Lock, RotateCcw, Trash2 } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { createClientNote, toggleClientNoteDone, deleteClientNote } from '../actions';

/**
 * Private, team-shared CRM notes on the Customer Card's Activity tab.
 *
 * Backed by vendor_client_notes (vendor-org-only RLS — off-limits to couples
 * and to Setnayan HQ admins). Plain <form> + server actions so the whole card
 * stays a server component. Every note carries a lock affordance ("Only your
 * team sees this"); an optional remind date drives a follow-up chip.
 */

export type ClientNote = {
  note_id: string;
  body: string;
  remind_at: string | null;
  done_at: string | null;
  author_user_id: string;
  author_label: string | null;
  created_at: string;
};

function fmtNoteDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtRemind(iso: string): string {
  // remind_at is a bare DATE — render without TZ drift.
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ClientNotes({ eventId, notes }: { eventId: string; notes: ClientNote[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      {notes.map((n) => {
        const overdue = !n.done_at && n.remind_at != null && n.remind_at <= today;
        return (
          <div
            key={n.note_id}
            className={`rounded-xl border p-3 sm:p-4 ${
              n.done_at
                ? 'border-ink/10 bg-white/60'
                : overdue
                  ? 'border-warn-300 bg-warn-50'
                  : 'border-terracotta/30 bg-terracotta/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/50">
              <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
              {n.remind_at && !n.done_at ? (
                <span className={overdue ? 'text-warn-900' : 'text-ink/55'}>
                  Follow-up · {fmtRemind(n.remind_at)}
                </span>
              ) : (
                <span>Only your team sees this</span>
              )}
            </div>
            <p
              className={`mt-1.5 whitespace-pre-wrap text-sm ${
                n.done_at ? 'text-ink/45 line-through' : 'text-ink'
              }`}
            >
              {n.body}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/50">
              <span>
                {n.author_label ?? 'Your team'} · {fmtNoteDate(n.created_at)}
              </span>
              <form action={toggleClientNoteDone}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="note_id" value={n.note_id} />
                <input type="hidden" name="done" value={n.done_at ? '0' : '1'} />
                <SubmitButton
                  pendingLabel="Saving…"
                  className="inline-flex items-center gap-1 font-medium text-ink/55 hover:text-ink"
                >
                  {n.done_at ? (
                    <>
                      <RotateCcw aria-hidden className="h-3 w-3" /> Reopen
                    </>
                  ) : (
                    <>
                      <Check aria-hidden className="h-3 w-3" /> Mark done
                    </>
                  )}
                </SubmitButton>
              </form>
              <form action={deleteClientNote}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="note_id" value={n.note_id} />
                <SubmitButton
                  pendingLabel="Removing…"
                  className="inline-flex items-center gap-1 font-medium text-ink/45 hover:text-danger-700"
                >
                  <Trash2 aria-hidden className="h-3 w-3" /> Delete
                </SubmitButton>
              </form>
            </div>
          </div>
        );
      })}

      {/* Composer — textarea + optional remind date, plain form + server action. */}
      <form
        action={createClientNote}
        className="rounded-xl border border-ink/10 bg-white p-3 sm:p-4"
      >
        <input type="hidden" name="event_id" value={eventId} />
        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-ink/50">
          <Lock aria-hidden className="h-3 w-3 text-terracotta" strokeWidth={2} /> Private note —
          only your team sees this.
        </div>
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={2}
          placeholder="Add a note about this couple…"
          className="w-full resize-y rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-ink/60">
            <Clock3 aria-hidden className="h-3.5 w-3.5 text-ink/45" /> Remind me
            <input
              type="date"
              name="remind_at"
              className="rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs text-ink focus:border-terracotta focus:outline-none"
            />
          </label>
          <SubmitButton
            pendingLabel="Saving…"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-cream"
          >
            <Check aria-hidden className="h-3.5 w-3.5" /> Save note
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
