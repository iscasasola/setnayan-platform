'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { creditNeed, needWords, rungFor, type CreditNeedInputs } from '@/lib/papic-credits-need';

/**
 * 🧮 "HOW MANY DO I NEED?" — one quiet button above the − / + stepper (owner 2026-10-23: *"make it easier to
 * purchase more. with the choice to compute how many to add and a button to purchase"*). The SAME helper in the web
 * sheet (`papic-buy-form.tsx`) and the app's (`iap-papic-sheet.tsx`); the sum is `lib/papic-credits-need.ts`.
 *
 * Pressed: guests coming × the per-guest numbers that exist − credits left → "You need about N more", and the
 * stepper lands on the smallest size that covers it (above the largest: lands on the largest and says so). When the
 * rest of the guests have no number it asks "How many photos each?" right here — no invented default (owner rule on
 * money, "don't guess"). How it was worked out sits behind the ⓘ. A failed read says "couldn't load", never 0.
 */
export function CreditNeedHelper({
  need,
  left,
  rungs,
  onLand,
}: {
  /** The helper's reads (`papicBuySizes`), or null when they never arrived. */
  need: CreditNeedInputs | null;
  left: number | null;
  rungs: readonly { points: number }[];
  /** Move the stepper to this rung. */
  onLand: (index: number) => void;
}) {
  const [asked, setAsked] = useState(false);
  const [typed, setTyped] = useState('');
  const inputId = useId();
  const perGuest = /^\d+$/.test(typed.trim()) ? Number(typed.trim()) : null;
  const result = useMemo(
    () => (need ? creditNeed(need, left, perGuest) : ({ kind: 'unread' } as const)),
    [need, left, perGuest],
  );
  const landing = result.kind === 'need' ? rungFor(rungs, result.more) : null;

  useEffect(() => {
    if (asked && landing) onLand(landing.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- land when the answer changes, not on every render
  }, [asked, landing?.index, result.kind === 'need' ? result.more : -1]);

  if (!asked) {
    return (
      <div className="mb-3" data-papic-need="">
        <ActionButton
          tone="neutral"
          quiet
          icon={<Calculator aria-hidden="true" strokeWidth={1.9} />}
          label="How many do I need?"
          onClick={() => setAsked(true)}
          data-papic-need-ask=""
        />
      </div>
    );
  }

  return (
    <div className="mb-3 space-y-2 text-sm" data-papic-need="" data-papic-need-state={result.kind} aria-live="polite">
      {result.kind === 'unread' ? (
        <p className="text-ink/65" data-papic-need-unread="">
          couldn’t load — your guest count or your credits did not read. Try again in a moment.
        </p>
      ) : result.kind === 'ask' ? (
        <div className="space-y-1.5">
          <label htmlFor={inputId} className="block font-medium text-ink">
            How many photos each?
          </label>
          <input
            id={inputId}
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="Photos each"
            className="sn-input w-full"
            data-papic-need-each=""
          />
          <p className="text-xs text-ink/60">For the {result.rest.toLocaleString('en-PH')} guests without a number of their own.</p>
        </div>
      ) : (
        <>
          <InfoTip label={needWords(result)} labelClassName="font-medium text-ink" align="start">
            {result.guests.toLocaleString('en-PH')} guests coming, each with the number set for them
            {need && need.everyoneElse === null && perGuest !== null ? ` (${perGuest.toLocaleString('en-PH')} each for the rest)` : ''}{' '}
            — {result.total.toLocaleString('en-PH')} credits in all, less the {(left ?? 0).toLocaleString('en-PH')} you
            have.
          </InfoTip>
          {landing?.above ? (
            <p className="text-xs text-ink/60" data-papic-need-above="">
              That is more than the largest size — this is the largest; add again after it lands.
            </p>
          ) : null}
          {need && need.everyoneElse === null && perGuest !== null ? (
            <button type="button" className="text-xs font-medium text-mulberry" onClick={() => setTyped('')}>
              Change photos each
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
