'use client';

/**
 * ₱ YOUR RANGE — the one line "Budget fit" adds to an open category (owner 2026-10-30: *"should we ask what is their
 * budget range for this search? so they give us lowest and highest budget range"* · *"our budget range will depend on
 * the lowest and highest service cards for that category"*).
 *
 *     YOUR RANGE   [ ₱8,000 ] – [ ₱45,000 ]   ⓘ
 *
 * The two boxes start at the cheapest and the priciest card shown in THIS category (`priceSpan`) — a photographer and
 * a venue cannot share a range. Typing reorders the category at once (in range first, then the nearest prices); a
 * blank box leaves that end open. Held by the bench for this search only: nothing is written, and the budget plan is
 * never changed (`lib/find-sort-choices.ts` says why).
 *
 * 🔒 app/dashboard/[eventId]/vendors/find-sort-is-one-row.test.ts
 */
import { useState } from 'react';
import { Explain } from '@/app/_components/explain';
import { formatPhp } from '@/lib/php';
import { parsePeso, type BudgetRange, type PriceSpan } from '@/lib/find-sort-choices';

const BOX =
  'h-10 w-[7.5rem] min-w-0 rounded-full border border-ink/15 bg-white px-3.5 text-[14px] text-ink tabular-nums placeholder:text-ink/45 dark:bg-raised';

export function FindBudgetRange({
  label,
  span,
  typed,
  onChange,
}: {
  /** The category's name — the ⓘ's words. */
  label: string;
  /** The cheapest and priciest card shown here; null when nothing here has a price yet. */
  span: PriceSpan | null;
  typed: BudgetRange | undefined;
  onChange: (next: BudgetRange) => void;
}) {
  // The box keeps the couple's own keystrokes ("8,0" mid-typing); the bench hears the parsed amount.
  const [low, setLow] = useState(typed?.low != null ? String(typed.low) : '');
  const [high, setHigh] = useState(typed?.high != null ? String(typed.high) : '');
  const box = (which: 'low' | 'high') => {
    const value = which === 'low' ? low : high;
    const set = which === 'low' ? setLow : setHigh;
    const shown = span ? formatPhp(which === 'low' ? span.low : span.high) : which === 'low' ? 'Lowest' : 'Highest';
    return (
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={shown}
        aria-label={which === 'low' ? 'Lowest price' : 'Highest price'}
        data-budget-range-box={which}
        className={BOX}
        onChange={(e) => {
          set(e.target.value);
          const n = parsePeso(e.target.value);
          onChange({ low: which === 'low' ? n : parsePeso(low), high: which === 'high' ? n : parsePeso(high) });
        }}
      />
    );
  };
  return (
    <div className="mrange" data-budget-range="">
      <span className="mt">Your range</span>
      {box('low')}
      <span aria-hidden className="text-ink/50">
        –
      </span>
      {box('high')}
      <Explain title="Your range" data="budget-range" className="cat-info">
        {span
          ? `Suppliers priced inside your range come first, then the closest prices. The boxes start at the cheapest and the priciest ${label} card here.`
          : `No ${label} card here has a price yet, so there is nothing to order by price.`}{' '}
        It is for this search only — your budget plan does not change.
      </Explain>
    </div>
  );
}
