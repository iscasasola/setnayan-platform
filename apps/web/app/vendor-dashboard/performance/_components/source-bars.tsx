'use client';

import { formatCount } from '@/lib/format-number';
import type { SourceRow } from './growth-view';
import { HeldCount, HeldFill } from './growth-motion';

/**
 * §1 "Are couples finding me?" — the bar form of `SourceBreakdown` (Shop › Analytics, owner-approved 6 Nov 2026): each
 * source a bar that grows (`Fill`) with its count ticking (`Count`), 90 ms apart. A source under the min-N floor is a
 * dashed outline, "under 5 · hidden" — never a fake bar. Unread → "Couldn’t load".
 */
export function SourceBars({ rows }: { rows: SourceRow[] | null }) {
  if (rows === null) return <p className="ag-one">Couldn’t load where couples came from.</p>;
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count ?? 0), 1);
  return (
    <div className="ag-sb" data-source-bars="">
      {rows.map((r, i) =>
        r.count === null ? (
          <div key={r.key} className="ag-sbr ag-ghostrow">
            <span className="ag-sbl">{r.label}</span>
            <div className="ag-track ag-dashed" aria-hidden />
            <span className="ag-sbn">under 5 · hidden</span>
          </div>
        ) : (
          <div key={r.key} className="ag-sbr">
            <span className="ag-sbl">{r.label}</span>
            <div className="ag-track">
              <HeldFill value={(r.count / max) * 100} id={`ag:src:${r.key}`} delay={i * 90} />
            </div>
            <HeldCount value={r.count} id={`ag:srcn:${r.key}`} delay={i * 90} className="ag-sbn" format={(n) => formatCount(n)} />
          </div>
        ),
      )}
    </div>
  );
}
