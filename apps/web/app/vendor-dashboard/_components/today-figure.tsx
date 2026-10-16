'use client';

import { useCountTo } from '@/components/count';

/**
 * A WORDED FIGURE THAT COUNTS UP — "₱48K", "₱1.2M", "5+", "118" (the prototype's `countUp`: the digits inside the
 * word count from 0, the ends stay as they are). The word itself is decided on the server (`formatPesoCompact`,
 * `eventsThisWeek`); this only animates the number inside it, so the figure the supplier settles on is the word
 * the server wrote, letter for letter.
 *
 * Motion obeys the shared counter (`useCountTo`): no motion with reduced motion, none on a hidden page, and the true
 * value on the server render — a count never shows a figure that is not the real one once it stops.
 */
export function splitFigure(word: string): { pre: string; n: number; decimals: number; grouped: boolean; post: string } | null {
  const m = /^(\D*)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(word);
  if (!m) return null;
  const digits = m[2]!;
  const n = Number(digits.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const decimals = digits.includes('.') ? digits.split('.')[1]!.length : 0;
  return { pre: m[1]!, n, decimals, grouped: digits.includes(','), post: m[3]! };
}

export function TodayFigure({ word, id }: { word: string; id: string }) {
  const parts = splitFigure(word);
  const scale = parts ? 10 ** parts.decimals : 1;
  const shown = useCountTo(parts ? Math.round(parts.n * scale) : 0, { id });
  if (!parts) return <>{word}</>;
  const v = shown / scale;
  const body = parts.grouped
    ? v.toLocaleString('en-PH', { minimumFractionDigits: parts.decimals, maximumFractionDigits: parts.decimals })
    : v.toFixed(parts.decimals);
  return (
    <span data-count={id} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts.pre}
      {body}
      {parts.post}
    </span>
  );
}
