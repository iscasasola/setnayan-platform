'use client';

import { useActionState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';
import { Save } from 'lucide-react';

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
    <TemplateSection
      label="Free credits, and the Thank You video"
      tip={
        <>
          What every event starts with, and Papic&apos;s one product that is not a rung of
          the ladder above.
        </>
      }
    >

      {/*
        ⚠ THE FREE ALLOWANCE IS SHOWN, NOT EDITABLE — and the difference is
        stated rather than left for somebody to discover by clicking.
        `papic_event_pool_config.free_grant_points` had NO reader under `app/`
        at all until this; giving it a save is its own change, with its own
        audit row and its own guard.
      */}
      <div className={`${ADMIN_FRAME} mb-4 p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Free credits on a first event</p>
            <p className={`mt-0.5 max-w-prose ${TEMPLATE_SUBLINE}`}>
              Given to every event before anybody buys anything. The ladder above tops
              this up; it never replaces it.
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-xl font-bold tabular-nums ${
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
        <p className={`mt-2 ${TEMPLATE_SUBLINE}`}>
          Not editable here yet — changing it still needs a migration
        </p>
      </div>

      <div className={`${ADMIN_FRAME} overflow-hidden`}>
        {products.map((p) => (
          <ProductRow key={p.serviceCode} row={p} action={savePriceAction} />
        ))}
      </div>
    </TemplateSection>
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
      className="flex flex-wrap items-center gap-3 border-b border-[color:var(--sn-divider)] p-4 last:border-b-0"
    >
      <input type="hidden" name="service_code" value={row.serviceCode} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{row.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <code className={TEMPLATE_SUBLINE}>{row.serviceCode}</code>
          {row.isActive ? <Badge tone="ok">On sale</Badge> : <Badge tone="quiet">Switched off</Badge>}
        </p>
        {state.message && (
          <p className={`mt-1 text-[11.5px] font-semibold ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-ink/45">
            ₱
          </span>
          <input
            name="regular_price_php"
            type="number"
            min="0"
            step="1"
            defaultValue={String(row.regularPhp)}
            aria-label={`Price for ${row.title}`}
            className="input-field h-9 w-32 pl-5 text-right text-[14px] tabular-nums"
          />
        </div>
        <ActionButton tone="neutral" type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save" />
      </div>
      <span className="sr-only">Currently {peso(row.regularPhp)}</span>
    </form>
  );
}
