'use client';

/**
 * Inline wedding-date editor on the event home. If no date is set, shows
 * an empty input with a "Save date" CTA. Once set, the date renders as
 * read-only text with an "Edit" affordance that switches back to the
 * input. Submits the existing server action `updateEventDate`.
 *
 * Per the 2026-05-21 owner directive: hosts need a place to input the
 * wedding date. This is the V1 implementation — a focused inline form
 * on event home. A fuller "Event basics" settings page can layer on top
 * in V1.x.
 */

import { useState, useTransition } from 'react';
import { CalendarDays, Lock, Pencil } from 'lucide-react';
import { updateEventDate } from '../actions';

type Props = {
  eventId: string;
  /** YYYY-MM-DD or null when not yet set */
  initial: string | null;
  /**
   * Task #37 (2026-05-22) — count of vendors at-or-past `contracted`.
   * When ≥1, the Edit affordance is replaced with a locked tooltip
   * pointing the host at support (mirrors the 2026-05-17 § 10 date-edit
   * gate). Defaults to 0 to preserve the prior unlocked behavior for
   * any caller that hasn't passed the prop yet.
   */
  confirmedVendorCount?: number;
};

export function EventDateInput({ eventId, initial, confirmedVendorCount = 0 }: Props) {
  const dateLocked = confirmedVendorCount > 0 && Boolean(initial);
  const [editing, setEditing] = useState(!initial && !dateLocked);
  const [draft, setDraft] = useState(initial ?? '');
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateEventDate(fd);
        setEditing(false);
      } catch (err) {
        alert(`Save failed: ${(err as Error).message}`);
      }
    });
  }

  if (!editing && initial) {
    const pretty = formatPretty(initial);
    const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
    const lockTooltip = `Date is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to discuss changes.`;
    return (
      <div className="flex items-center gap-2 text-sm text-ink/70">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>
          Wedding date · <strong className="font-medium text-ink">{pretty}</strong>
        </span>
        {dateLocked ? (
          <>
            <Lock aria-hidden className="h-3.5 w-3.5 text-ink/50" strokeWidth={1.75} />
            <button
              type="button"
              disabled
              title={lockTooltip}
              aria-label={lockTooltip}
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-ink/10 px-2 py-0.5 text-xs text-ink/45"
            >
              <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Edit
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(initial);
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-0.5 text-xs text-ink/70 hover:border-ink/30 hover:text-ink"
            aria-label="Edit wedding date"
          >
            <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="event_id" value={eventId} />
      <label htmlFor={`event-date-${eventId}`} className="flex items-center gap-1.5 text-sm text-ink/70">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Wedding date</span>
      </label>
      <input
        id={`event-date-${eventId}`}
        type="date"
        name="event_date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm focus:border-terracotta focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-terracotta px-3 py-1 text-xs font-medium text-cream disabled:opacity-50"
      >
        {isPending ? 'Saving…' : initial ? 'Save' : 'Save date'}
      </button>
      {initial && (
        <button
          type="button"
          onClick={() => {
            setDraft(initial);
            setEditing(false);
          }}
          className="rounded-md border border-ink/15 px-3 py-1 text-xs text-ink/65 hover:border-ink/30"
        >
          Cancel
        </button>
      )}
    </form>
  );
}

function formatPretty(yyyyMmDd: string): string {
  // Avoid timezone drift on a DATE column — parse the parts manually.
  const [yearStr, monthStr, dayStr] = yyyyMmDd.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return yyyyMmDd;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
