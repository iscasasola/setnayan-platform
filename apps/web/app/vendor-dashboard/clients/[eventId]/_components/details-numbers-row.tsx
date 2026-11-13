'use client';

import type { DetailsNumber } from './details-numbers';
import { usePickedNav } from './picked-client-nav';

/**
 * Each number's dot (v113 `.tot .k`): money paid · money still owed · a date. Colours from the app's own status tokens —
 * the same ones the Clients month marks with — never a colour of its own.
 */
const DOT: Record<DetailsNumber['key'], string> = {
  paid: 'bg-sn-accent',
  quote: 'bg-success-600',
  balance: 'bg-warn-600',
  schedules: 'bg-info-600',
  event: 'bg-success-600',
};

/**
 * The three numbers drawn INLINE, never boxed (Build 2 row #43f, v113 `.tot.t3`): a dot and the word over the figure, its
 * small line under it, centred in three equal columns. A tap still opens the page the number is about (v113 `data-go`) —
 * the press darkens it (`sn-press`); there is no tile around it (frames only on what you press, and v113 draws none here).
 */
export function DetailsNumbersRow({ cells }: { cells: DetailsNumber[] }) {
  const nav = usePickedNav();
  return (
    <div className="grid grid-cols-3 gap-1" data-details-numbers="" data-details-numbers-inline="">
      {cells.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => nav?.select(c.page)}
          className="sn-press flex min-h-11 flex-col items-center rounded-xl px-1 py-1.5 text-center"
          data-details-number={c.key}
        >
          <span className="whitespace-nowrap text-xs font-medium text-ink/70">
            <i aria-hidden className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${DOT[c.key]}`} />
            {c.label}
          </span>
          <b className="whitespace-nowrap text-base font-bold tabular-nums text-ink">{c.value}</b>
          <small className="whitespace-nowrap text-xs text-ink/70">{c.sub}</small>
        </button>
      ))}
    </div>
  );
}
