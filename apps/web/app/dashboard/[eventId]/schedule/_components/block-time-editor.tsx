'use client';

import { useState, useTransition } from 'react';
import { Clock, Check, X, Pencil } from 'lucide-react';
import { updateScheduleBlock } from '../actions';

/**
 * BlockTimeEditor — inline time-range edit affordance on BlockCard
 * (CLAUDE.md 2026-05-30 owner directive: "Customer Schedule can be
 * edited on the time."). Replaces the static `formatBlockTime` text
 * line at /dashboard/[eventId]/schedule with a click-to-edit affordance:
 *
 *   VIEW mode (default):
 *     {block_type} · {start_at} → {end_at}   [Pencil-icon Edit time]
 *
 *   EDIT mode (after Edit click):
 *     [Start datetime-local input]
 *     [End datetime-local input]
 *     [Save] [Cancel]
 *
 * Server action: existing `updateScheduleBlock` from ../actions.ts
 * already accepts start_at + end_at fields per Card 15 wizard usage
 * (the inline editor in create-schedule-editor.tsx debounces against
 * the same action). This client component is a thin contained surface —
 * the action handles all validation + revalidation. Empty end_at submits
 * as empty string → action clears end_at to null. Empty start_at is
 * blocked at the input level (required attribute).
 *
 * Layout intent: the View mode preserves the existing time-text mono
 * eyebrow at `font-mono text-[11px] uppercase tracking-[0.15em]
 * text-ink/55`. The Edit-time pencil button sits inline at the right
 * edge. Click → swap to a 2-column form (Start / End) + Save/Cancel
 * button row. Save triggers updateScheduleBlock + closes the form on
 * success.
 *
 * No optimistic UI — server revalidates the path on success + the
 * page re-renders with the new times. Pending state on Save button
 * during the transition (`isPending`).
 */

type Props = {
  eventId: string;
  blockId: string;
  blockTypeLabel: string;
  startAt: string;
  endAt: string | null;
  /** Pre-formatted display copy from the existing
   *  `formatBlockTime` + `formatBlockTimeRange` helpers — kept as a
   *  prop so the View mode renders the exact same string as the
   *  surrounding page. */
  viewLabel: string;
};

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function BlockTimeEditor({
  eventId,
  blockId,
  blockTypeLabel,
  startAt,
  endAt,
  viewLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <p className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        <span className="inline-flex items-center gap-1.5">
          {blockTypeLabel} · {viewLabel}
        </span>
        {/* HEIGHT · `min-h-[44px]` per CLAUDE.md 2026-05-30 button parity
         *  · pencil-icon affordance + small label fit comfortably at the
         *  44pt floor and the row sits adjacent to the public/hidden
         *  status pill which is a non-button display badge. */}
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setEditing(true);
          }}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-ink/15 bg-cream px-2.5 text-[10px] font-medium tracking-[0.15em] text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
        >
          <Pencil aria-hidden className="h-3 w-3" strokeWidth={2} />
          Edit time
        </button>
      </p>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await updateScheduleBlock(fd);
            setEditing(false);
            setErrorMessage(null);
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : 'Could not save changes';
            setErrorMessage(msg);
          }
        });
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="block_id" value={blockId} />
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        <Clock aria-hidden className="-mt-0.5 inline h-3 w-3" strokeWidth={2} />{' '}
        Edit time · {blockTypeLabel}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-[10px] font-mono uppercase tracking-[0.15em] text-ink/55">
            Start
          </span>
          <input
            type="datetime-local"
            name="start_at"
            required
            defaultValue={isoToDatetimeLocal(startAt)}
            className="input-field h-11 text-sm"
            disabled={isPending}
          />
        </label>
        <label className="space-y-1">
          <span className="block text-[10px] font-mono uppercase tracking-[0.15em] text-ink/55">
            End <span className="text-ink/40">(optional)</span>
          </span>
          <input
            type="datetime-local"
            name="end_at"
            defaultValue={endAt ? isoToDatetimeLocal(endAt) : ''}
            className="input-field h-11 text-sm"
            disabled={isPending}
          />
        </label>
      </div>
      {/* HEIGHT · `h-11` Save + Cancel match the sibling form controls
       *  for visual rhythm in the inline editor surface. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center gap-1.5 rounded-md bg-mulberry px-3 text-xs font-medium text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-mulberry/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setErrorMessage(null);
          }}
          disabled={isPending}
          className="inline-flex h-11 items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/70 transition-colors hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Cancel
        </button>
        {errorMessage ? (
          <span className="text-xs text-danger-700">{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}
