'use client';

import { useActionState, useState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * 🎁 GIFT LIMIT · % OF THE BOOKING FEE (owner v112 answer, 8 Nov 2026; THE ONE BUILD).
 *
 * One number, saved by `saveGiftLimitPct` (audited). Same shape as the booking-fee form on Admin › Pricing
 * (`BookingFeeForm`): a typed value, one Save, the result beside it — a save never resets the screen.
 */
export function GiftLimitForm({
  action,
  giftLimitPct,
}: {
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
  giftLimitPct: number;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, { ok: false, message: null });
  const [pct, setPct] = useState(String(giftLimitPct));

  return (
    <form action={formAction} className="mb-4 rounded-2xl border border-ink/10 p-4" data-admin-gift-limit="">
      <InfoTip
        label="Gift limit · % of the booking fee"
        labelClassName="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gold-text"
        align="start"
      >
        Applies to the Setnayan gift and to shop gifts on new quotes. Badge rewards are outside it. Gifts already locked
        on a booking do not move.
      </InfoTip>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="relative block w-28">
          <span className="sr-only">Gift limit, percent of the booking fee</span>
          <input
            name="gift_limit_pct"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="input-field w-full pr-7 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
            %
          </span>
        </label>
        <button
          type="submit"
          className="min-h-[44px] rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save gift limit
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
