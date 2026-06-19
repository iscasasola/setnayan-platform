'use client';

import { useActionState } from 'react';
import { notifyWhenEventTypeLaunches, type NotifyResult } from '../actions';

// Iteration 0041 — email-capture form for Coming-Soon event_type interest.
// Embedded inside the Coming-Soon empty-state banner on /vendors when the
// active event_type filter returns zero vendors. Submission lands in
// public.couple_event_type_notify_signups (migration 20260521100000).
//
// Stateful inline UX:
//   - Initial: email input + Notify-me submit button.
//   - Success: replace the form with a "Got it" confirmation; no page nav.
//   - Validation error: error text under the input; form stays editable.
//   - Network/server error: same shape, generic message.
//
// useActionState (React 19) keeps the success/error state per-submission
// without spilling into URL params or refreshing the whole page.

const INITIAL: NotifyResult | null = null;

export function EventTypeNotifyForm({
  eventType,
  label,
}: {
  eventType: string;
  label: string;
}) {
  const [state, formAction, isPending] = useActionState<NotifyResult | null, FormData>(
    async (_prev, formData) => notifyWhenEventTypeLaunches(formData),
    INITIAL,
  );

  if (state?.status === 'ok') {
    return (
      <p
        role="status"
        className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-success-50 px-4 py-2 text-sm font-medium text-success-800"
      >
        <span aria-hidden>✓</span>
        We&rsquo;ll email you when {label} vendors are live.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="mx-auto mt-5 flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row"
    >
      <input type="hidden" name="event_type" value={eventType} />
      <label htmlFor="event_type_notify_email" className="sr-only">
        Email address
      </label>
      <input
        type="email"
        id="event_type_notify_email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="input-field flex-1"
      />
      <button
        type="submit"
        disabled={isPending}
        className="button-primary h-11 px-4 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Submitting…' : 'Notify me'}
      </button>
      {state?.status === 'invalid_email' ? (
        <p className="basis-full text-xs text-terracotta-700" role="alert">
          Please enter a valid email address.
        </p>
      ) : null}
      {state?.status === 'error' ? (
        <p className="basis-full text-xs text-terracotta-700" role="alert">
          Something went wrong submitting that. Try again in a moment.
        </p>
      ) : null}
    </form>
  );
}
