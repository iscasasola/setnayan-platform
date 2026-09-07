'use client';

import { useActionState, useEffect, useRef } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  buyVendorPapicPortfolioPack,
  type BuyVendorPapicPortfolioPackState,
} from '../papic/portfolio-pack-actions';

const IDLE: BuyVendorPapicPortfolioPackState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

/**
 * "Papic credits" readout + the pack upsell — beside the shutter's own
 * pointsCap/pointsSpent bar (papic-capture-controller.tsx), which reads the
 * on-the-day CAMERA allowance only. This card reads the wider ONE-METER total
 * (`fetchVendorPapicPortfolioCredits`), which is also spent by the portfolio
 * album below it — so a supplier who has been importing photos sees the same
 * "left" the shutter would show them, not two numbers quietly disagreeing.
 *
 * The buy CTA only renders when `offerPack` is true (owner + Fable, 2026-09-05:
 * the pack is the call-to-action beside a grant UNDER a pack's worth) — a
 * supplier who already holds a pack's worth is not sold to.
 */
export function PortfolioCreditsCard({
  eventId,
  credits,
  left,
  offerPack,
  packPricePhp,
  packCredits,
}: {
  eventId: string;
  /** Total credits granted so far (booking fee + packs + admin/comp). `null` = unreadable. */
  credits: number | null;
  /** What's left to spend, across both doors (capture + portfolio import). `null` = unlimited. */
  left: number | null;
  offerPack: boolean;
  /** `null` = the pack SKU is missing/inactive — render "unavailable", not a stale number. */
  packPricePhp: number | null;
  packCredits: number;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState(buyVendorPapicPortfolioPack, IDLE);
  const handled = useRef<BuyVendorPapicPortfolioPackState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
  }, [state, toast]);

  return (
    <div
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Papic credits
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--m-slate-1)' }}>
          {credits == null
            ? 'Couldn’t load your balance right now.'
            : left == null
              ? `${credits} earned · unlimited to spend`
              : `${left} left to spend`}
        </p>
      </div>

      {offerPack ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <select
            name="channel"
            defaultValue="bdo"
            className="rounded-lg border px-2 py-1.5 text-xs"
            style={{ borderColor: 'var(--m-line)' }}
            aria-label="Pay with"
          >
            <option value="bdo">BDO</option>
            <option value="gcash">GCash</option>
          </select>
          <SubmitButton
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-3 py-2 text-xs font-medium text-cream hover:bg-terracotta-800"
            pendingLabel="Starting…"
            disabled={packPricePhp == null}
          >
            <ShoppingBag aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {packPricePhp == null
              ? 'Pack unavailable'
              : `Buy ${packCredits} credits · ${peso(packPricePhp)}`}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
