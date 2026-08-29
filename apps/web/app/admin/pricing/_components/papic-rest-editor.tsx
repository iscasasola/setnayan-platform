'use client';

import { useActionState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';

export type PapicProductRow = {
  serviceCode: string;
  title: string;
  regularPhp: number;
  isActive: boolean;
};

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/**
 * WHAT EVERY CELEBRATION IS GIVEN, AND THE THANK YOU VIDEO.
 *
 * ⚖ Owner 2026-08-29: *"free credits should be here. with the rest of papic
 * services and the thank you video."* Then, narrowing it: *"papic is only the
 * papic shot prices and the thankyou. so the rest should be removed."* An
 * earlier build also drew the four switched-off camera rates here; those are
 * a different product line and stay on the main Pricing tab, where every other
 * switched-off price lives.
 */
export function PapicRestEditor({
  freeCreditsPerEvent,
  products,
  savePriceAction,
}: {
  /** `papic_event_pool_config.free_grant_points`; null when it could not be read. */
  freeCreditsPerEvent: number | null;
  products: PapicProductRow[];
  savePriceAction: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-base font-semibold tracking-tight">
        Free credits, and the Thank You video
      </h2>
      <p className="mb-4 max-w-prose text-sm leading-relaxed text-ink/60">
        What every celebration starts with, and Papic&apos;s one product that is not a rung of
        the ladder above.
      </p>

      {/*
        ⚠ THE FREE ALLOWANCE IS SHOWN, NOT EDITABLE — and the difference is
        stated rather than left for somebody to discover by clicking.
        `papic_event_pool_config.free_grant_points` had NO reader under `app/`
        at all until this; giving it a save is its own change, with its own
        audit row and its own guard.
      */}
      <div className="mb-4 rounded-2xl border border-success-800/25 bg-success-800/[0.05] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Free credits on every event</p>
            <p className="mt-0.5 max-w-prose text-[13px] leading-relaxed text-ink/60">
              Given to every celebration before anybody buys anything. The ladder above tops
              this up; it never replaces it.
            </p>
          </div>
          <div className="text-right">
            <p
              className={`font-mono text-xl font-bold tabular-nums ${
                freeCreditsPerEvent == null ? 'text-ink/45' : 'text-success-800'
              }`}
            >
              {freeCreditsPerEvent == null ? '—' : freeCreditsPerEvent.toLocaleString('en-PH')}
            </p>
            <p className="text-[11px] text-ink/55">
              {freeCreditsPerEvent == null ? "couldn't be read" : 'credits per event'}
            </p>
          </div>
        </div>
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink/45">
          Not editable here yet — changing it still needs a migration
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10">
        {products.map((p) => (
          <ProductRow key={p.serviceCode} row={p} action={savePriceAction} />
        ))}
      </div>
    </section>
  );
}

function ProductRow({
  row,
  action,
}: {
  row: PapicProductRow;
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-3 border-b border-ink/5 p-4 last:border-b-0"
    >
      <input type="hidden" name="service_code" value={row.serviceCode} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{row.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <code className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink/50">
            {row.serviceCode}
          </code>
          {row.isActive ? (
            <span className="rounded-full border border-success-800/25 bg-success-800/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.13em] text-success-800">
              On sale
            </span>
          ) : (
            <span className="rounded-full border border-ink/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.13em] text-ink/55">
              Switched off
            </span>
          )}
        </p>
        {state.message && (
          <p className={`mt-1 text-[11.5px] font-semibold ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[12px] text-ink/45">
            ₱
          </span>
          <input
            name="regular_price_php"
            type="number"
            min="0"
            step="1"
            defaultValue={String(row.regularPhp)}
            aria-label={`Price for ${row.title}`}
            className="input-field h-9 w-32 pl-5 text-right font-mono text-[14px] tabular-nums"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-ink/15 px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-ink/[0.05]"
        >
          Save
        </button>
      </div>
      <span className="sr-only">Currently {peso(row.regularPhp)}</span>
    </form>
  );
}
