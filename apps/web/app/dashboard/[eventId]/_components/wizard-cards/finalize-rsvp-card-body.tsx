'use client';

/**
 * Card 29 Finalize RSVP · client body. Renders RSVP summary + single
 * [Mark RSVP finalized] CTA that fires the generic markTaskDone action
 * with the count snapshot as meta_* fields for audit.
 */

import { useState, useTransition } from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  total: number;
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
};

export function FinalizeRsvpCardBody({
  eventId,
  total,
  attending,
  declined,
  maybe,
  pending,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'finalize_rsvp');
    formData.set('meta_total_attending', String(attending));
    formData.set('meta_total_declined', String(declined));
    formData.set('meta_total_maybe', String(maybe));
    formData.set('meta_total_pending', String(pending));
    formData.set('meta_total_invited', String(total));
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark this done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-ink/75">
        Lock in your final headcount once the RSVPs are firm. Your
        caterer + booths + seatplan all key off this number.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat label="Attending" value={attending} tone="emerald" />
        <SummaryStat label="Declined" value={declined} tone="rose" />
        <SummaryStat label="Maybe" value={maybe} tone="amber" />
        <SummaryStat label="Pending" value={pending} tone="ink" />
      </div>

      {pending > 0 ? (
        <p className="rounded-md border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          You&apos;ve still got <strong>{pending}</strong> pending RSVP
          {pending === 1 ? '' : 's'} — a friendly nudge usually clears them
          before you finalize.
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleMarkDone}
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isPending ? 'Saving…' : 'Lock final headcount'}
      </button>

      <p className="text-xs text-ink/55">
        You can revisit the guest list any time — locking just stamps
        this as your committed count for the next steps.
      </p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'rose' | 'amber' | 'ink';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
      ? 'text-rose-700'
      : tone === 'amber'
      ? 'text-amber-700'
      : 'text-ink/70';
  return (
    <div className="rounded-lg border border-ink/10 bg-white px-3 py-2">
      <p className={`font-display text-2xl italic leading-tight ${toneClass}`}>
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </p>
    </div>
  );
}
