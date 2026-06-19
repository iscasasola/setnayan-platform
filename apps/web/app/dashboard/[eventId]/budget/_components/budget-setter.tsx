'use client';

import { useActionState, useState } from 'react';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { setEventBudget, type SetEventBudgetResult } from '../actions';

// Budget Setter — closes the BudgetCountdownHeader loop landed in
// PR #329 (2026-05-22). That header was already reading
// events.estimated_budget_centavos defensively but the column didn't
// exist + there was no place for the host to set it. This component
// is the missing setter form.
//
// Stateful inline UX:
//   - Initial: PHP-formatted input + Save submit button.
//   - Pending: button reads "Saving…", input disabled.
//   - Success: brief green confirmation chip above the input, form
//     stays editable so the host can adjust + save again.
//   - Validation error: error chip in terracotta, input stays.
//
// Polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]].
// No exclamation marks, no all-caps urgency. Helper text frames the
// budget as the host's stated target, not an external constraint.
//
// Live thousands-separator on the input (₱680,000) so the host sees
// the number they typed in the same shape as the BudgetCountdownHeader
// renders it back on event home — no surprise reformatting between
// surfaces.

const INITIAL: SetEventBudgetResult | null = null;

export function BudgetSetter({
  eventId,
  initialBudgetCentavos,
}: {
  eventId: string;
  /** Current value from events.estimated_budget_centavos. NULL when the
   *  host has never set a budget. */
  initialBudgetCentavos: number | null;
}) {
  const initialPhpString =
    initialBudgetCentavos !== null
      ? formatPhpInput(initialBudgetCentavos / 100)
      : '';

  const [displayValue, setDisplayValue] = useState<string>(initialPhpString);

  const [state, formAction, isPending] = useActionState<
    SetEventBudgetResult | null,
    FormData
  >(async (_prev, formData) => setEventBudget(formData), INITIAL);

  const hasInitialBudget = initialBudgetCentavos !== null && initialBudgetCentavos > 0;
  const buttonLabel = hasInitialBudget ? 'Update my budget' : 'Save my budget';

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6"
      aria-labelledby="budget-setter-heading"
    >
      <input type="hidden" name="event_id" value={eventId} />

      <header className="flex items-baseline gap-2">
        <Wallet aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Your target
        </p>
      </header>
      <h2
        id="budget-setter-heading"
        className="mt-1 font-display text-2xl italic text-ink/85 sm:text-3xl"
      >
        What&rsquo;s your total wedding budget?
      </h2>

      <div className="mt-5 max-w-md space-y-2">
        <label
          htmlFor="budget_php_input"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Budget (PHP)
        </label>
        <input
          id="budget_php_input"
          name="budget_php"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          // The hidden `event_id` is the real route param; this input
          // visibly carries the typed number with thousands separators
          // for readability.
          value={displayValue}
          onChange={(e) => setDisplayValue(reformatPhpInput(e.target.value))}
          placeholder="₱ 680,000"
          aria-describedby="budget_php_help"
          disabled={isPending}
          className="input-field h-12 text-xl tabular-nums disabled:opacity-60"
        />
        <p id="budget_php_help" className="text-xs text-ink/65">
          Helps Setnayan project your final cost as you book vendors. You can change
          this anytime.
        </p>
      </div>

      {/* Inline status chip — surfaces success/error from the last submit. */}
      {state?.ok === true ? (
        <p
          role="status"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success-800"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {state.budgetCentavos === null
            ? 'Target cleared.'
            : 'Your target is saved.'}
        </p>
      ) : null}
      {state?.ok === false ? (
        <p
          role="alert"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-800"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="button-primary px-5 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : buttonLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * Format an unformatted PHP number into a thousands-separated display
 * value. Used to seed the input from the existing value on the database.
 *
 * formatPhpInput(680000) === "680,000"
 * formatPhpInput(1500000.5) === "1,500,000.50"
 */
function formatPhpInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '';
  // Preserve up to 2 decimals so a host who saved "1,500,000.50"
  // sees the cents come back. Strip trailing zeros so "680000" doesn't
  // round-trip to "680,000.00".
  const fixed = value.toFixed(2).replace(/\.00$/, '');
  const parts = fixed.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1];
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

/**
 * Reformat the input value as the host types — adds thousands
 * separators in real time without breaking decimal entry.
 *
 * Accepts: digits, commas, one period, leading whitespace, peso symbol.
 * Strips: anything else (alpha, multiple periods, junk pasted in).
 */
function reformatPhpInput(raw: string): string {
  // Strip the peso symbol and whitespace; allow user to paste with formatting.
  let cleaned = raw.replace(/[₱\s]/g, '');
  // Strip commas (we'll re-add them based on the actual number).
  cleaned = cleaned.replace(/,/g, '');
  // Allow only digits + at most one period.
  cleaned = cleaned.replace(/[^0-9.]/g, '');
  // Collapse multiple periods to just the first one.
  const periodIdx = cleaned.indexOf('.');
  if (periodIdx >= 0) {
    cleaned =
      cleaned.slice(0, periodIdx + 1) +
      cleaned.slice(periodIdx + 1).replace(/\./g, '');
  }

  if (cleaned.length === 0) return '';
  if (cleaned === '.') return '0.';

  // Split into integer + decimal parts.
  const parts = cleaned.split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1];
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Cap decimal at 2 places (centavos resolution).
  const decClipped = decPart !== undefined ? decPart.slice(0, 2) : undefined;
  return decClipped !== undefined
    ? `${intWithCommas}.${decClipped}`
    : intWithCommas;
}
