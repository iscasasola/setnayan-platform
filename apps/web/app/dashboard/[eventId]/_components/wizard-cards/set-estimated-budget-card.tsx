'use client';

/**
 * Card 03 (DIY tier) · Set Estimated Budget.
 *
 * Inline PHP peso input · persists to existing
 * events.estimated_budget_centavos column (centavos = pesos × 100, no
 * new schema needed · column already drives the BudgetCountdownHeader
 * + ShortlistBudgetCard surfaces).
 *
 * Owner directive 2026-05-30: "Set Estimated Budget". DIY-tier-only.
 *
 * Pattern matches set-estimated-pax-card.tsx · simple input + Save CTA
 * + brand-voice hint. Persists in PESOS via setEstimatedBudget server
 * action which converts to centavos.
 *
 * Min ₱1,000 floor (anything below is almost certainly a typo or
 * misunderstanding of the unit) · max ₱99,999,999 ceiling. Most PH
 * weddings land between ₱200,000 (court-only / civil) and ₱2,500,000
 * (full luxury reception). The cap is forgiving for couples thinking
 * in luxury / destination ranges.
 */

import { useState, useTransition } from 'react';
import { PiggyBank } from 'lucide-react';
import { setEstimatedBudget } from '../../wizard-actions';

type Props = {
  eventId: string;
  initialBudgetCentavos?: number | null;
};

export function SetEstimatedBudgetCard({
  eventId,
  initialBudgetCentavos,
}: Props) {
  const initialPesos =
    initialBudgetCentavos != null && initialBudgetCentavos > 0
      ? Math.round(initialBudgetCentavos / 100)
      : null;
  const [value, setValue] = useState<string>(
    initialPesos != null ? String(initialPesos) : '',
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsed = Number.parseFloat(value);
  const isValid =
    Number.isFinite(parsed) && parsed >= 1000 && parsed <= 99_999_999;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    if (!isValid) {
      setErrorMessage('Pick a budget between ₱1,000 and ₱99,999,999');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('pesos', String(parsed));
    startTransition(async () => {
      try {
        await setEstimatedBudget(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save budget. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <PiggyBank
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Working budget
          </p>
        </div>
        <p>
          Your total wedding spend target in Philippine Pesos. Pick a
          comfortable range — your vendor recommendations + shortlist
          math respect this ceiling, and you can adjust as quotes land.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="estimated-budget-input"
          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55"
        >
          Working budget (₱)
        </label>
        <div className="relative inline-flex w-full max-w-[280px] items-center">
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 text-lg font-medium text-ink/55"
          >
            ₱
          </span>
          <input
            id="estimated-budget-input"
            type="number"
            inputMode="decimal"
            min={1000}
            max={99_999_999}
            step={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="500000"
            className="w-full rounded-lg border border-ink/15 bg-white py-3 pl-10 pr-4 text-lg font-medium text-ink focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            autoComplete="off"
          />
        </div>
        {isValid ? (
          <p className="text-xs text-ink/55">
            That&apos;s ₱{parsed.toLocaleString('en-PH')} working budget.
          </p>
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

      <button
        type="submit"
        disabled={isPending || !isValid}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save budget'}
      </button>
    </form>
  );
}
