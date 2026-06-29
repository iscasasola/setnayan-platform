'use client';

/**
 * setnayan-ai-subscribe.tsx — the per-USER Setnayan AI subscription buy UI.
 *
 * A cycle picker (₱499 per 28-day cycle) that drives the shared
 * InlineCheckoutDrawer in SUBSCRIPTION mode: eventless (eventId='') + a `cycles`
 * count. The charge is re-resolved server-side as catalog unit × cycles
 * (submitOrderAction), so the total shown here is display-only. Rendered only
 * when the per-user flag is on (the page gates it); dormant otherwise.
 */
import { useState } from 'react';

import {
  InlineCheckoutDrawer,
  type InlineCheckoutDrawerProps,
} from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';

const PRESETS: { cycles: number; label: string; hint: string }[] = [
  { cycles: 1, label: '1 cycle', hint: '28 days' },
  { cycles: 3, label: '3 cycles', hint: '~3 months' },
  { cycles: 6, label: '6 cycles', hint: '~6 months' },
  { cycles: 12, label: '12 cycles', hint: '~12 months' },
];

function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SetnayanAiSubscribe({
  unitCentavos,
  settings,
  alreadyActive,
}: {
  unitCentavos: number;
  settings: InlineCheckoutDrawerProps['settings'];
  alreadyActive: boolean;
}) {
  const [cycles, setCycles] = useState(6);
  const totalCentavos = unitCentavos * cycles;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium text-ink">How long would you like Setnayan AI?</p>
        <p className="mt-1 text-xs text-ink/60">
          {formatPeso(unitCentavos)} per 28-day cycle — pick the length that matches your timeline.
          You can always add more later; early renewals stack on top.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const selected = p.cycles === cycles;
          return (
            <button
              key={p.cycles}
              type="button"
              onClick={() => setCycles(p.cycles)}
              aria-pressed={selected}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                selected
                  ? 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry'
                  : 'border-ink/10 bg-white hover:border-ink/25'
              }`}
            >
              <span className="text-sm font-semibold text-ink">{p.label}</span>
              <span className="text-xs text-ink/55">{p.hint}</span>
              <span className="mt-1 text-xs font-medium text-mulberry">
                {formatPeso(unitCentavos * p.cycles)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-ink/10 bg-cream p-4">
        <span className="text-xs uppercase tracking-wide text-ink/50">Total today</span>
        <span className="text-2xl font-semibold text-ink">{formatPeso(totalCentavos)}</span>
        <span className="text-xs text-ink/55">
          {cycles} × 28-day {cycles === 1 ? 'cycle' : 'cycles'} · covers all your events ·
          VAT added at checkout
        </span>
      </div>

      <InlineCheckoutDrawer
        serviceKey="SETNAYAN_AI_SUB"
        displayName={`Setnayan AI — ${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`}
        originalPriceCentavos={String(totalCentavos)}
        eventId=""
        cycles={cycles}
        settings={settings}
        triggerLabel={alreadyActive ? 'Extend my subscription' : 'Subscribe'}
        triggerClassName="button-primary w-full sm:w-auto"
      />
    </div>
  );
}
