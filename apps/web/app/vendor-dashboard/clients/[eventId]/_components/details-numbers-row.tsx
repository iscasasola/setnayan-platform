'use client';

import type { DetailsNumber } from './details-numbers';
import { usePickedNav } from './picked-client-nav';

/** The three numbers as one row of tiles; a tap opens the page the number is about (v113 `data-go`). */
export function DetailsNumbersRow({ cells }: { cells: DetailsNumber[] }) {
  const nav = usePickedNav();
  return (
    <div className="grid grid-cols-3 gap-2" data-details-numbers="">
      {cells.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => nav?.select(c.page)}
          className="sn-press flex min-h-[72px] flex-col items-start justify-between rounded-xl bg-ink/[0.04] px-3 py-2 text-left"
          data-details-number={c.key}
        >
          <span className="text-[11px] font-medium text-ink/60">{c.label}</span>
          <b className="font-mono text-[15px] font-semibold text-ink">{c.value}</b>
          <small className="text-[11px] text-ink/55">{c.sub}</small>
        </button>
      ))}
    </div>
  );
}
