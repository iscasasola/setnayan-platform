'use client';

import { formatCount } from '@/lib/format-number';
import type { SourceRow } from './growth-view';
import { HeldCount, HeldFill } from './growth-motion';
import { sourceHueColor } from '@/lib/chart-source-hues';

/** Rows that fit the card's fixed 144-px picture (label · count, a 6-px track under it, 10 between). */
const CARD_ROWS = 4;

/**
 * §1 "Are couples finding me?" — the bar form of `SourceBreakdown` (Shop › Analytics, owner-approved 6 Nov 2026): each
 * source a bar that grows (`Fill`) with its count ticking (`Count`), 90 ms apart. A source under the min-N floor is a
 * dashed outline, "under 5 · hidden" — never a fake bar. Unread → "Couldn’t load".
 * One shape (owner 21 Nov 2026): the label and count on one line, a 6-px track under them, at most four rows in the
 * 144-px box. One fixed hue per source, the same everywhere (owner 22 Nov 2026, `lib/chart-source-hues.ts`).
 */
export function SourceBars({ rows }: { rows: SourceRow[] | null }) {
  if (rows === null) return <p className="ag-one">Couldn’t load where couples came from.</p>;
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count ?? 0), 1);
  return (
    <div className="ag-sb" data-source-bars="">
      {rows.slice(0, CARD_ROWS).map((r, i) =>
        r.count === null ? (
          <div key={r.key} className="ag-src-r ag-ghostrow">
            <span className="ag-sbl">{r.label}</span>
            <span className="ag-sbn">under 5 · hidden</span>
            <div className="ag-track ag-dashed" aria-hidden />
          </div>
        ) : (
          <div key={r.key} className="ag-src-r" data-source-hue={r.key}>
            <span className="ag-sbl">{r.label}</span>
            <HeldCount value={r.count} id={`ag:srcn:${r.key}`} delay={i * 90} className="ag-sbn" format={(n) => formatCount(n)} />
            <div className="ag-track">
              <HeldFill value={(r.count / max) * 100} id={`ag:src:${r.key}`} delay={i * 90} style={{ background: sourceHueColor(r.key) }} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}
