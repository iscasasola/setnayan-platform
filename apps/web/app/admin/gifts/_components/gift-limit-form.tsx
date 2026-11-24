'use client';

import { useActionState, useState } from 'react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import { TemplateSection } from '@/app/_components/template-rows';
import { ActionButton } from '@/components/action-button';
import { Save } from 'lucide-react';

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
    // 📐 Admin clean port (19 Nov 2026): the label is a section label with its ⓘ — no mono capitals. Same field, same save.
    <TemplateSection
      label="Gift limit · % of the booking fee"
      tip={
        <>
          Applies to the Setnayan gift and to shop gifts on new quotes. Badge rewards are outside it. Gifts already locked
          on a booking do not move.
        </>
      }
      data="gift-limit"
    >
    <form action={formAction} className="pt-1" data-admin-gift-limit="">
      <div className="flex flex-wrap items-center gap-2">
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
        <ActionButton tone="brand" main type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save gift limit" />
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
    </TemplateSection>
  );
}
