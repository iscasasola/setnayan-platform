'use client';

import { useEffect, useState } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { creditsNeeded, rungForNeed } from '@/lib/papic-credit-need';
import { formatCount } from '@/lib/format-number';

/**
 * credit-need.tsx — "HOW MANY DO I NEED?" above the shipped stepper (owner 2026-10-23: *"make it easier to purchase
 * more. with the choice to compute how many to add and a button to purchase"*). Guests coming × credits per guest −
 * credits left; the answer lands the stepper on the smallest rung that covers it (`rungForNeed`). The guests are the
 * event's own head count (a refused read is said); the per-guest number is the couple's own Credits-per-guest number
 * when set — otherwise the helper asks for one here and invents none. How it is worked out lives in the ⓘ.
 */
export function CreditNeed({
  need,
  left,
  rungs,
  onJump,
}: {
  need: { coming: number | null; perGuest: number | null };
  left: number | null;
  rungs: readonly { points: number }[];
  onJump: (index: number) => void;
}) {
  const [typed, setTyped] = useState<string>(need.perGuest !== null ? String(need.perGuest) : '');
  const perGuest = typed.trim() === '' ? null : Number(typed);
  const n = creditsNeeded({ coming: need.coming, perGuest: Number.isFinite(perGuest) ? perGuest : null, left });
  const at = n === null ? null : rungForNeed(rungs, n);
  useEffect(() => {
    if (at) onJump(at.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jumps when the answer changes
  }, [n]);

  return (
    <section className="mb-3 flex flex-col gap-1.5" data-credit-need="">
      <InfoTip label="How many do I need?" labelClassName="text-[14px] font-semibold text-ink" align="start">
        Your guests coming × the credits each may use, less the credits you have now. The stepper lands on the smallest
        pack that covers it — you can still go up or down. One credit is one photo; a short clip uses a little more.
      </InfoTip>
      <div className="flex items-center justify-between gap-3 text-[13.5px]">
        <span className="text-ink/70">Guests coming</span>
        <span className="font-medium text-ink" data-credit-need-guests="">
          {need.coming === null ? 'Couldn’t read your guests' : formatCount(need.coming)}
        </span>
      </div>
      <label className="flex items-center justify-between gap-3 text-[13.5px]">
        <span className="text-ink/70">Credits per guest</span>
        <input
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/[^\d.]/g, ''))}
          placeholder="How many?"
          aria-label="Credits per guest"
          className="h-9 w-24 rounded-full border border-ink/15 bg-paper px-3 text-right text-ink placeholder:text-ink/45"
          data-credit-need-per-guest=""
        />
      </label>
      <p className="text-[13.5px] font-medium text-ink" aria-live="polite" data-credit-need-answer="">
        {need.coming === null
          ? 'Add what you like below.'
          : perGuest === null
            ? 'Type how many each guest may use.'
            : n === null
              ? 'Add what you like below.'
              : at?.enough
                ? 'You have enough for now.'
                : at?.top
                  ? `You need about ${formatCount(n)} more — the biggest pack; add again after.`
                  : `You need about ${formatCount(n)} more.`}
      </p>
    </section>
  );
}
