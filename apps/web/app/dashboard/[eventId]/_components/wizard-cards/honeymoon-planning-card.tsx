'use client';

/**
 * Card 32 Honeymoon Planning · WAVE 2 · iteration 0016 Concierge Active
 * Wizard.
 *
 * DATA_INPUT card · the host sketches a rough honeymoon shape inline ·
 * destination text · departure date · return date · budget range. NO
 * vendor pick · NO link out to a honeymoon-planning subroute · NO
 * marketplace navigation. Everything completes inside the focus card.
 *
 * Why a brand-voice nudge to lock this now (per WIZARD_TASKS task 32):
 * the week immediately after the wedding is the worst time to plan a
 * honeymoon · the couple is exhausted · vendors are chasing final
 * payments · pictures are coming in. Locking a destination + dates
 * before the wedding means the trip is already booked when the
 * adrenaline crashes.
 *
 * Submission shape: composes formData with meta_* prefixed fields and
 * fires the generic markTaskDone server action. No card-specific
 * server action is needed because the destination + dates + budget all
 * live in events.wizard_state.honeymoon_planning.meta — there's no
 * separate honeymoon table in V1, and a future iteration can promote
 * this metadata to a dedicated table without changing the card.
 *
 * Budget select is "open dropdown" — the curated PHP ranges cover the
 * modal cases (₱100K-₱1M+ in 4 buckets · plus "Not yet" for hosts who
 * haven't budgeted yet). The "Not yet" variant still stamps
 * completed_at so the wizard advances; the budget meta just stays
 * unset.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: copy
 * reads as a calm, friendly nudge · not a sales pitch · not
 * engineering jargon · no "TODO: implement budget picker" text.
 */

import { useState, useTransition } from 'react';
import { Plane, CheckCircle2 } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type Props = {
  eventId: string;
  /** events.event_date · used to set sensible default departure
   *  (~3 days after the wedding) + return (~10 days after the wedding)
   *  so the date inputs aren't blank. Host can override either; the
   *  defaults just remove the "what date should I even pick?" friction. */
  eventDate: string | null;
};

/** Curated PHP budget ranges for the dropdown. Stored as plain string
 *  meta values (e.g., "100k_250k") because the budget is informational ·
 *  not used for any downstream math in V1. A future iteration can
 *  promote these to centavos ranges if budget rollups need them. */
const BUDGET_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Not yet · we will figure it out' },
  { value: 'under_100k', label: 'Under ₱100,000' },
  { value: '100k_250k', label: '₱100,000 – ₱250,000' },
  { value: '250k_500k', label: '₱250,000 – ₱500,000' },
  { value: '500k_1m', label: '₱500,000 – ₱1,000,000' },
  { value: '1m_plus', label: '₱1,000,000+' },
];

/** Compute a sensible default departure date · ~3 days after the
 *  wedding so the couple has a buffer for thank-yous, packing, and
 *  recovery. Returns YYYY-MM-DD or empty string when wedding date
 *  isn't set. */
function defaultDepartureDate(weddingDateIso: string | null): string {
  if (!weddingDateIso) return '';
  const wedding = new Date(`${weddingDateIso}T00:00:00`);
  if (Number.isNaN(wedding.getTime())) return '';
  wedding.setDate(wedding.getDate() + 3);
  return wedding.toISOString().slice(0, 10);
}

/** Compute a sensible default return date · ~10 days after the
 *  wedding so the honeymoon defaults to a one-week trip. Returns
 *  YYYY-MM-DD or empty string when wedding date isn't set. */
function defaultReturnDate(weddingDateIso: string | null): string {
  if (!weddingDateIso) return '';
  const wedding = new Date(`${weddingDateIso}T00:00:00`);
  if (Number.isNaN(wedding.getTime())) return '';
  wedding.setDate(wedding.getDate() + 10);
  return wedding.toISOString().slice(0, 10);
}

export function HoneymoonPlanningCard({ eventId, eventDate }: Props) {
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(() =>
    defaultDepartureDate(eventDate),
  );
  const [returnDate, setReturnDate] = useState(() =>
    defaultReturnDate(eventDate),
  );
  const [budget, setBudget] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);

    // Client-side validation · keep it light · everything is optional
    // EXCEPT a return date that comes before the departure date.
    if (departureDate && returnDate && returnDate < departureDate) {
      setErrorMessage('Return date should come after your departure date.');
      return;
    }

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'honeymoon_planning');
    // Only stamp meta fields that were actually filled in · empty
    // values get skipped by the server action's meta_* picker so the
    // wizard_state entry stays clean.
    if (destination.trim().length > 0) {
      formData.set('meta_destination', destination.trim());
    }
    if (departureDate) {
      formData.set('meta_depart', departureDate);
    }
    if (returnDate) {
      formData.set('meta_return', returnDate);
    }
    if (budget) {
      formData.set('meta_budget', budget);
    }

    startTransition(async () => {
      try {
        await markTaskDone(formData);
        // WizardHero re-renders via revalidatePath · next focus
        // card transitions in-place.
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your honeymoon plan. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Destination · text input · accepts anything (city · country ·
          "still thinking · maybe Palawan"). Optional. */}
      <div className="space-y-2">
        <label
          htmlFor="honeymoon-destination"
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
        >
          <Plane aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Where to?
          <span className="normal-case tracking-normal text-ink/45">
            (optional · just a sketch is fine)
          </span>
        </label>
        <input
          id="honeymoon-destination"
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          maxLength={120}
          placeholder="e.g. Palawan · Bali · Tokyo · still deciding"
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
      </div>

      {/* Departure + return dates · default to T+3 / T+10 from the
          wedding · host can override either. Side-by-side on tablet+. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="honeymoon-depart"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
          >
            Departure date
            <span className="ml-2 normal-case tracking-normal text-ink/45">
              (optional)
            </span>
          </label>
          <input
            id="honeymoon-depart"
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="honeymoon-return"
            className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
          >
            Return date
            <span className="ml-2 normal-case tracking-normal text-ink/45">
              (optional)
            </span>
          </label>
          <input
            id="honeymoon-return"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
      </div>

      {/* Rough budget · open dropdown · "Not yet" is the default. */}
      <div className="space-y-2">
        <label
          htmlFor="honeymoon-budget"
          className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink/60"
        >
          Rough budget
          <span className="ml-2 normal-case tracking-normal text-ink/45">
            (optional · ballpark is fine)
          </span>
        </label>
        <select
          id="honeymoon-budget"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        >
          {BUDGET_OPTIONS.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Save action · everything is optional · the wizard advances
          regardless · the host can refine later. Brand-voice copy under
          the button reinforces the "even a rough plan helps" framing. */}
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            'Saving…'
          ) : (
            <>
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Save honeymoon plan
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-ink/55">
          A breather after the wedding. Even a rough plan helps — refine the
          details later when the rest of the week settles.
        </p>
      </div>
    </form>
  );
}
