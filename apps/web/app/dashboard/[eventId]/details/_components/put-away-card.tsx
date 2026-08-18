'use client';

import { useState, useTransition } from 'react';
import { Archive, RotateCcw } from 'lucide-react';

import { setEventArchived } from '../../archive-actions';

/**
 * put-away-card.tsx — the button that never existed.
 *
 * `events.archived` shipped with the first migration and a dozen screens
 * already read it. In two years **nothing could ever set it**, while five
 * separate screens told people to "archive it first". This is that control.
 *
 * ─── WHY IT IS NOT CALLED "ARCHIVE" ON SCREEN ──────────────────────────────
 * "Archive" is the word the refusal messages use and the word an engineer
 * reaches for, but to a couple it sits uncomfortably close to "delete" — and
 * next to a real Delete button, two cold words are how somebody destroys a
 * wedding they meant to tidy. The screen says **Put this away** and states, in
 * the same breath, the two things people actually worry about: the guests' page
 * keeps working, and nothing is deleted.
 *
 * ─── THE TWO-STEP IS DELIBERATE AND SO IS ITS ABSENCE ON THE WAY BACK ──────
 * Putting away asks for a confirm; bringing it back does not. The gentle
 * direction should not be gated — an undo behind a dialog is an undo people do
 * not trust — and the whole promise of this control is that it is reversible.
 */
export function PutAwayCard({
  eventId,
  archived,
  eventName,
}: {
  eventId: string;
  archived: boolean;
  eventName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(next: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('archived', next ? '1' : '0');
    startTransition(async () => {
      /*
        🪤 THE AWAIT IS INSIDE A TRY. A rejected server action escapes an async
        handler unhandled, and the pending flag then never clears — the exact
        defect that left "Creating…" on screen forever in the onboarding wizard
        (owner report 2026-06-03, fixed across every event type 2026-08-15).
        Not repeating it here.
      */
      try {
        const res = await setEventArchived(fd);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setConfirming(false);
      } catch (err) {
        console.error('[put-away] action rejected', err);
        setError('We couldn’t save that just now. Please try again.');
      }
    });
  }

  if (archived) {
    return (
      <div className="rounded-2xl border border-ink/12 bg-white/60 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Archive aria-hidden className="h-[18px] w-[18px] text-[color:var(--sn-ink-400)]" />
          Put away
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink/70">
          {eventName} is off your active list. Everything is still here — the
          photos, the guest list, the page your guests use. Bring it back any
          time.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--sn-danger)]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={pending}
          className="sn-press mt-4 inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-terracotta disabled:opacity-60"
        >
          <RotateCcw aria-hidden className="h-4 w-4" />
          {pending ? 'Bringing it back…' : 'Bring it back'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink/12 bg-white/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <Archive aria-hidden className="h-[18px] w-[18px] text-[color:var(--sn-ink-400)]" />
        Put this away
      </h2>
      <p className="mt-2 max-w-prose text-sm text-ink/70">
        Tidies {eventName} off your active list and stops its reminders.{' '}
        <strong className="font-semibold text-ink">Nothing is deleted</strong> — the
        photos, the guest list and the page your guests use all keep working
        exactly as they do now, and you can bring it back any time.
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-[color:var(--sn-danger)]">
          {error}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={pending}
            /* CTA slot → mulberry. The 2026-08-01 palette lock: terracotta
               ACTS, gold HIGHLIGHTS, and gold is never a button. `text-cream`
               is the pairing the contrast guard measures (4.61:1 AA). */
            className="sn-press inline-flex items-center gap-2 rounded-full bg-mulberry px-4 py-2 text-sm font-bold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
          >
            {pending ? 'Putting it away…' : `Yes, put ${eventName} away`}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="sn-press rounded-full px-4 py-2 text-sm font-bold text-ink/70 hover:text-ink disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="sn-press mt-4 inline-flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-terracotta"
        >
          <Archive aria-hidden className="h-4 w-4" />
          Put this away
        </button>
      )}
    </div>
  );
}
