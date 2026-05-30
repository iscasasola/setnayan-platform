'use client';

/**
 * Card 02 (DIY tier) · Set Estimated Pax.
 *
 * Inline numeric input · 1..9999 integer guest count · persists to
 * events.estimated_pax (added by Agent A PR #675 migration `2026-05-30
 * iteration 0016 DIY foundation 9 cards`). Owner directive 2026-05-30
 * verbatim: "Set Estimated Pax". DIY-tier-only · the PAID 65-card
 * sequence doesn't surface this card (PAID couples skip straight from
 * date → Reception Venue per the Concierge runway).
 *
 * Pattern: mirrors the EventMarkDoneRow / event-card.tsx pattern · NOT
 * the big custom calendar in set-wedding-date-card.tsx. Plain form +
 * useTransition + brand-voice copy. No marketing CTA copy beyond the
 * hint line + Save button.
 *
 * On success, `setEstimatedPax` stamps wizard_state.set_estimated_pax
 * .completed_at so the resolver advances to Card 03 (Set Estimated
 * Budget) on next render.
 */

import { useState, useTransition } from 'react';
import { Users } from 'lucide-react';
import { setEstimatedPax } from '../../wizard-actions';

type Props = {
  eventId: string;
  initialPax?: number | null;
};

export function SetEstimatedPaxCard({ eventId, initialPax }: Props) {
  const [value, setValue] = useState<string>(
    initialPax != null && initialPax > 0 ? String(initialPax) : '',
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = Number.parseInt(value, 10);
  const isValid =
    Number.isFinite(parsed) && parsed >= 1 && parsed <= 9999;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!isValid) {
      setErrorMessage('Pick a number between 1 and 9,999');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('pax', String(parsed));
    startTransition(async () => {
      try {
        await setEstimatedPax(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save guest count. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Users
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Headline number
          </p>
        </div>
        <p>
          Best estimate — you can refine this as RSVPs come in. Filipino
          weddings routinely grow from 80 to 200 between engagement and
          RSVP, so a rough anchor now keeps your venue / catering / print
          quotes from going sideways later.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="estimated-pax-input"
          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
        >
          About how many guests?
        </label>
        <input
          id="estimated-pax-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 150"
          className="w-full max-w-[200px] rounded-lg border border-ink/15 bg-white px-4 py-3 text-lg font-medium text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          autoComplete="off"
        />
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !isValid}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save guest count'}
      </button>
    </form>
  );
}
