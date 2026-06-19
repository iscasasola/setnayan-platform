'use client';

/**
 * Phase 0 Date Selection — calendar picker (client component).
 *
 * Wraps a native HTML date input with calm brand styling + a Preview step
 * that swaps the calendar for the AuspiciousCard once a date is chosen.
 * The host can refine the date or proceed to lock.
 *
 * Per CLAUDE.md 2026-05-22 Phase 0 lock — direct-pick path (the "I have a
 * date in mind" entry). The 4-question guided flow is a separate component.
 *
 * Brand voice: terracotta accent, calm transitions, no error-shouting if
 * the host picks a past date (the server action's defense-in-depth check
 * surfaces the rare case where someone bypasses the `min` attribute).
 */

import { useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { lockEventDate } from '../actions';
import {
  computeAuspiciousReasons,
  formatAuspiciousDate,
  dayOfWeekLabel,
  type CeremonyType,
  type MeaningfulDate,
} from '@/lib/auspicious-date';

type Props = {
  eventId: string;
  /** Host's ceremony type, drives ceremony-specific positive overlays. */
  ceremonyType: CeremonyType | null;
  /** Meaningful dates flagged by host — surfaces personal resonance. */
  meaningfulDates: MeaningfulDate[];
  /** YYYY-MM-DD existing event_date when reopening the picker. */
  initialDate?: string | null;
  /** Optional "back" affordance label override. */
  backLabel?: string;
  /** Where the back button routes. */
  backHref: string;
};

const TODAY_ISO = (() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
})();

export function DatePicker({
  eventId,
  ceremonyType,
  meaningfulDates,
  initialDate,
  backLabel = 'Back',
  backHref,
}: Props) {
  const [selected, setSelected] = useState<string>(initialDate ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Parse selected for the preview pass; null when blank or invalid.
  let previewReasons: string[] = [];
  let prettyDate = '';
  let dow = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(selected)) {
    const [y, m, d] = selected.split('-').map(Number);
    if (y && m && d) {
      const dateObj = new Date(y, m - 1, d);
      previewReasons = computeAuspiciousReasons(dateObj, ceremonyType, meaningfulDates);
      prettyDate = formatAuspiciousDate(selected);
      dow = dayOfWeekLabel(dateObj);
    }
  }

  const isInPast = (() => {
    if (!selected) return false;
    return selected < TODAY_ISO;
  })();

  function handleLock() {
    if (!selected || isInPast) return;
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('event_date', selected);
    form.set('precision', 'day');
    setError(null);
    startTransition(async () => {
      try {
        await lockEventDate(form);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong — please try again';
        // NEXT_REDIRECT errors are thrown by the server action's redirect()
        // call and ARE the success path; the navigation will fire as the
        // transition resolves. Don't surface them as a banner.
        if (
          typeof message === 'string' &&
          (message.includes('NEXT_REDIRECT') || message.includes('NEXT_NOT_FOUND'))
        ) {
          return;
        }
        setError(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <a
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {backLabel}
      </a>

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Setnayan · Pick a date
        </p>
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          What date are you thinking of?
        </h1>
        <p className="text-base text-ink/70">
          You can change your mind — we&apos;ll show you what makes the date you pick beautiful.
        </p>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        <label
          htmlFor="phase0-date"
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
        >
          <CalendarDays aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Wedding date
        </label>
        <input
          id="phase0-date"
          type="date"
          value={selected}
          min={TODAY_ISO}
          onChange={(e) => {
            setError(null);
            setSelected(e.target.value);
          }}
          className="mt-2 w-full max-w-sm rounded-lg border border-ink/20 bg-white px-4 py-3 text-lg text-ink shadow-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          aria-describedby="phase0-date-hint"
        />
        <p id="phase0-date-hint" className="mt-2 text-xs text-ink/55">
          Today or later. You can refine after seeing what makes this date special.
        </p>
      </div>

      {selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) && !isInPast ? (
        <article
          className="rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-6 shadow-sm ring-1 ring-terracotta/10 sm:p-8"
          aria-labelledby="picker-auspicious-headline"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Why this date works
          </p>
          <h2
            id="picker-auspicious-headline"
            className="mt-1 font-display text-2xl italic leading-tight text-ink sm:text-3xl"
          >
            {prettyDate}
          </h2>
          <p className="text-sm text-ink/55">{dow} · a beautiful day to be wed</p>

          {previewReasons.length > 0 ? (
            <ul className="mt-5 space-y-2.5">
              {previewReasons.map((r, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[15px] leading-relaxed text-ink/80"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-terracotta/70"
                  />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      ) : null}

      {isInPast ? (
        <p className="text-sm text-ink/65">
          Pick today or a future day — wedding dates live ahead of us.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-md bg-danger-50 px-4 py-3 text-sm text-danger-800 ring-1 ring-inset ring-danger-200"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={backHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink/15 px-4 py-2.5 text-sm text-ink/75 hover:bg-ink/[0.03]"
        >
          Pick another path
        </a>
        <button
          type="button"
          onClick={handleLock}
          disabled={!selected || isInPast || pending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-2.5 text-base font-medium text-cream shadow-sm hover:bg-mulberry-600 focus:outline-none focus:ring-2 focus:ring-terracotta/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Locking the date...
            </>
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Lock this date and start planning
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
