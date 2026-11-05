'use client';

import { useActionState } from 'react';
import { saveFeeReviewMin, type ReviewMinState } from './actions';

/** One Form row: the count, a pill box, a terracotta main button (INTERACTION_RULES § 9). */
export function ReviewMinForm({ value }: { value: number | null }) {
  const [state, formAction] = useActionState<ReviewMinState, FormData>(saveFeeReviewMin, {
    ok: false,
    message: null,
  });
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="block" htmlFor="fee_review_unsettled_events_min">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          List a supplier at
        </span>
        <span className="mt-1 flex items-center gap-2">
          <input
            id="fee_review_unsettled_events_min"
            name="fee_review_unsettled_events_min"
            type="number"
            min="1"
            step="1"
            defaultValue={value ?? ''}
            className="input-field w-24 rounded-full text-right tabular-nums"
          />
          <span className="text-sm text-ink/70">events</span>
        </span>
      </label>
      <button
        type="submit"
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-mulberry px-5 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
      >
        Save
      </button>
      {state.message ? (
        <p role="status" className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
