'use client';

/**
 * Card 06 Prenup · Phase 2 final piece of iteration 0016 Concierge
 * Active Wizard.
 *
 * EXTERNAL_PROCESS card · different shape from the vendor-pick cards
 * (02 · 03 · 04 · 05 · 07). Prenup is a process the host TRACKS through
 * the wizard rather than a vendor they LOCK via marketplace. The actual
 * prenup photographer was locked in Card 05 (Photography); this card
 * tracks scheduling + done.
 *
 * Photo upload is INTENTIONALLY NOT part of this card — the prenup
 * photos flow into Card 17 Save-the-Date Video as input. Card 06's
 * complete state is the host's confirmation that "we shot it" — the
 * wizard advances on that single signal.
 *
 * UX shape: one [Mark prenup done] CTA + an optional native HTML date
 * input for the scheduled shoot date. Host can:
 *   (a) Type the planned date + click [Mark prenup done] — wizard
 *       advances + the date is preserved in wizard_state.prenup as audit
 *       context.
 *   (b) Skip the date entirely + click [Mark prenup done] — wizard
 *       advances + no date stored (couples who shot before discovering
 *       Setnayan, or who don't care about the audit context).
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] — the
 * timing copy explains the T-7m → T-6m window naturally rather than
 * surfacing engineering jargon about wizard_state.
 */

import { useState, useTransition } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { completePrenupTask } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** events.event_date · used to compute the suggested shoot date
   *  (~T-6m to T-7m) below the input. NULL when the host hasn't set a
   *  wedding date yet — the suggestion line just hides. */
  eventDate: string | null;
};

/** Compute the recommended prenup window (T-7m → T-6m) given a wedding
 *  date. Returns a short brand-voice line · empty when no wedding date. */
function recommendedWindowCopy(weddingDateIso: string | null): string | null {
  if (!weddingDateIso) return null;
  const wedding = new Date(weddingDateIso);
  if (Number.isNaN(wedding.getTime())) return null;
  const earliest = new Date(wedding);
  earliest.setMonth(earliest.getMonth() - 7);
  const latest = new Date(wedding);
  latest.setMonth(latest.getMonth() - 6);
  const fmt = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
  });
  return `Aim between ${fmt.format(earliest)} and ${fmt.format(latest)} so the photos are ready for your save-the-date video.`;
}

export function PrenupCard({ eventId, eventDate }: Props) {
  const [scheduledDate, setScheduledDate] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const windowCopy = recommendedWindowCopy(eventDate);

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    if (scheduledDate) formData.set('scheduled_date', scheduledDate);

    startTransition(async () => {
      try {
        await completePrenupTask(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your prenup. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Optional scheduled date · native HTML date input · mobile keyboards
          show their date picker, desktop browsers show their calendar
          dropdown. No react-mobile-picker overhead here · the prenup
          date is a simple ISO date pick. */}
      <div className="space-y-2">
        <label
          htmlFor="prenup-scheduled-date"
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
        >
          <Calendar aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          When&apos;s the shoot? <span className="normal-case tracking-normal text-ink/45">(optional)</span>
        </label>
        <input
          id="prenup-scheduled-date"
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 sm:max-w-xs"
        />
        {windowCopy ? (
          <p className="text-xs leading-relaxed text-ink/55">{windowCopy}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* [Mark prenup done] · advances the wizard past Card 06 regardless
          of whether host typed a date. The wizard is a planning surface,
          not an event tracker — host can mark done any time. */}
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Mark prenup done
            </>
          )}
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink/55">
        Photo upload comes later — when your save-the-date video is up
        next, we&apos;ll ask for your favourite prenup shots.
      </p>
    </form>
  );
}
