'use client';

import { useActionState, useRef } from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import { setShareBudgetBand, type SetShareBudgetBandResult } from '../actions';

// Share-budget-band toggle — the couple opt-IN (default OFF) that lets a vendor
// they talk to see a ROUNDED RANGE for that vendor's own category on the Customer
// Card. Never an exact number, never other categories. Framed as the couple's own
// win: more accurate quotes, faster.
//
// Customer Card respine PR-5 (owner-approved 2026-07-03). Low-friction switch:
// flipping it submits immediately (no separate Save step). Polite brand voice —
// no exclamation marks, benefit-first copy.

const INITIAL: SetShareBudgetBandResult | null = null;

export function ShareBudgetBandToggle({
  eventId,
  initialShare,
}: {
  eventId: string;
  initialShare: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    SetShareBudgetBandResult | null,
    FormData
  >(async (_prev, formData) => setShareBudgetBand(formData), INITIAL);

  // Optimistic checked state: last successful write wins, else the server value.
  const checked = state?.ok === true ? state.shareBudgetBand : initialShare;

  return (
    <section
      aria-labelledby="share-budget-band-heading"
      className="rounded-xl border border-terracotta/20 bg-terracotta/[0.04] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <h2
              id="share-budget-band-heading"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700"
            >
              Share budget ranges with vendors
            </h2>
          </div>
          <p className="mt-2 max-w-prose text-sm text-ink/75">
            Vendors you talk to see a <span className="font-medium text-ink">range</span>{' '}
            for their category only — never your exact numbers. It helps you get
            accurate quotes faster, since they can tailor a proposal to what you
            planned. Off by default; turn it on or off anytime.
          </p>
          {state?.ok === true ? (
            <p
              role="status"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1.5 text-xs font-medium text-success-800"
            >
              <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {state.shareBudgetBand ? 'Sharing ranges is on.' : 'Sharing ranges is off.'}
            </p>
          ) : null}
          {state?.ok === false ? (
            <p
              role="alert"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-800"
            >
              {state.error}
            </p>
          ) : null}
        </div>

        <form ref={formRef} action={formAction} className="shrink-0">
          <input type="hidden" name="event_id" value={eventId} />
          {/* The NEW value we're writing — the inverse of the current state. */}
          <input type="hidden" name="share" value={checked ? 'false' : 'true'} />
          <button
            type="submit"
            role="switch"
            aria-checked={checked}
            aria-label="Share budget ranges with vendors"
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              checked ? 'bg-terracotta' : 'bg-ink/20'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                checked ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </form>
      </div>
    </section>
  );
}
