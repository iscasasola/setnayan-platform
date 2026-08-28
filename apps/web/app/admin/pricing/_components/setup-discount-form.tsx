'use client';

import { useActionState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { MAX_ONBOARDING_DISCOUNT_PCT } from '@/lib/onboarding-discount';

/**
 * The house set-up discount — how much off anything bought while a customer is
 * still setting up their celebration.
 *
 * ⚖ Owner, 2026-08-28: *"I want to be able to change 10% anytime. so I can set
 * discount on onboarding today and change it tomorrow. or anytime i want."*
 *
 * 🔑 THE BOX SHOWS THE CURRENT VALUE, and that is half the feature. The first
 * attempt was a blank "apply N%" box: it could set a discount but never tell him
 * what one was, so the only way to find out was to read sixteen rows.
 *
 * Its own form and its own save, like the fee beside it — a singleton must never
 * share a save button with the catalog browser.
 */
export function SetupDiscountForm({
  action,
  discountPct,
  isFromDb,
}: {
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  discountPct: number;
  isFromDb: boolean;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });

  return (
    <form action={formAction} className="rounded-2xl border border-ink/10 p-4">
      <label className="block max-w-xs">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Set-up discount (%)
        </span>
        <input
          name="onboarding_discount_pct"
          type="number"
          step="0.01"
          min="0"
          max={MAX_ONBOARDING_DISCOUNT_PCT}
          defaultValue={discountPct}
          className="input-field mt-1 w-full tabular-nums"
        />
        <span className="mt-1 block text-[11px] text-ink/45">
          {isFromDb
            ? 'Off anything bought while a customer is still setting up. Change it any time — every set-up price follows immediately.'
            : 'Falling back to the default — save once to persist it.'}
        </span>
      </label>
      <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-ink/45">
        A product with its own sign-up price keeps it when that price is the
        cheaper of the two, so raising this can never make anything cost more.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save discount
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
