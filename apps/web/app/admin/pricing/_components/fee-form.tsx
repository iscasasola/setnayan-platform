'use client';

import { useActionState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';

/**
 * The Setnayan Pay convenience-fee singleton — the one price on this screen
 * that isn't a catalog row. Kept as its own tiny form so it never has to
 * share a save action (or a save button) with the catalog browser above it.
 */
export function FeeForm({
  action,
  feePct,
  feeIsFromDb,
}: {
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  feePct: number;
  feeIsFromDb: boolean;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });

  return (
    <form action={formAction} className="rounded-2xl border border-ink/10 p-4">
      <label className="block max-w-xs">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Setnayan Pay fee (%)
        </span>
        <input
          name="setnayan_pay_fee_pct"
          type="number"
          step="0.01"
          min="0"
          max="100"
          defaultValue={feePct}
          className="input-field mt-1 w-full tabular-nums"
        />
        <span className="mt-1 block text-[11px] text-ink/45">
          {feeIsFromDb ? 'Set in platform_settings.' : 'Falling back to the code constant — save once to persist it.'}
        </span>
      </label>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save fee
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
