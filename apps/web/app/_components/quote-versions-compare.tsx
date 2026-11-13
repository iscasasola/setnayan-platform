'use client';

import { useId, useState } from 'react';
import { Columns2 } from 'lucide-react';
import { Sheet } from './sheet';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCentavos } from '@/lib/vendor-proposals';
import { versionDay, versionsSideBySide, type QuoteVersion, type SideBySideRow } from '@/lib/quote-versions';

/**
 * "SEE EVERY VERSION · SIDE BY SIDE" (Quote + negotiation · PR-4, owner 2026-11-12; approved design
 * quote-maker-polish.html `openDiff` — two version pickers, one table, changed rows marked, "What was paid is the
 * floor" under it).
 *
 * Extends the shipped "Every version" sheet (`quote-versions-sheet.tsx`, one version at a time) with the pair view.
 * Draws only `versionsSideBySide` (lib/quote-versions.ts), which is built on the SAME pairing as `quoteChanges` — the
 * marked rows are exactly what `<QuoteWhatChanged>` lists for the same two versions. Never a second comparison.
 */
function cell(row: SideBySideRow, v: SideBySideRow['a']): string {
  if (row.kind === 'plan') return typeof v === 'string' && v ? v : 'No plan';
  if (v === undefined) return '—';
  if (v === null) return 'Complimentary';
  if (typeof v !== 'number') return String(v);
  return v < 0 ? `−${formatCentavos(-v)}` : formatCentavos(v);
}

export function QuoteVersionsCompare({
  versions,
  open,
  onClose,
  paidFloor = false,
}: {
  /** One quote's versions, oldest → newest (`versionsOldestFirst`). */
  versions: readonly QuoteVersion[];
  open: boolean;
  onClose: () => void;
  /** A payment is confirmed on this quote — say the floor rule under the table. */
  paidFloor?: boolean;
}) {
  const headingId = useId();
  const last = versions.length - 1;
  const [ai, setAi] = useState(Math.max(0, last - 1));
  const [bi, setBi] = useState(Math.max(0, last));
  const a = versions[Math.min(ai, last)];
  const b = versions[Math.min(bi, last)];
  if (!a || !b) return null;
  const rows = versionsSideBySide(a, b);
  const options = versions.map((v, i) => ({ key: String(i), label: `v${v.version} · ${versionDay(v.at)}` }));
  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId} title="See every version · side by side">
      <div className="px-4 pb-6 pt-3" data-quote-compare="">
        <h2 id={headingId} className="sr-only">
          See every version · side by side
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <PickMenu label="Compare from" value={String(ai)} options={options} onPick={(k) => setAi(Number(k))} dataAttr="data-quote-compare-a" />
          <PickMenu label="Compare to" value={String(bi)} options={options} onPick={(k) => setBi(Number(k))} dataAttr="data-quote-compare-b" />
        </div>
        <table className="mt-3 w-full table-fixed text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-ink/60">
              <th className="w-[40%] py-1 font-normal">
                <span className="sr-only">Line</span>
              </th>
              <th className="py-1 text-right font-semibold">v{a.version}</th>
              <th className="py-1 text-right font-semibold">v{b.version}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                data-compare-row={r.kind}
                data-compare-changed={r.changed ? '' : undefined}
                className={`border-t border-ink/10 align-top ${r.changed ? 'bg-warn-50' : ''} ${r.kind === 'total' ? 'font-semibold' : ''}`}
              >
                <th scope="row" className="py-2 pr-2 text-left font-normal text-ink">
                  <span aria-hidden className={`mr-1 inline-block w-3 font-semibold text-warn-800 ${r.changed ? '' : 'invisible'}`}>
                    ~
                  </span>
                  {r.changed ? <span className="sr-only">Changed: </span> : null}
                  {r.label}
                </th>
                <td className={`py-2 text-right tabular-nums ${r.kind === 'plan' ? 'text-[12px]' : ''} ${r.changed ? 'text-ink/55' : 'text-ink'}`}>{cell(r, r.a)}</td>
                <td className={`py-2 text-right tabular-nums ${r.kind === 'plan' ? 'text-[12px]' : ''} text-ink`}>{cell(r, r.b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[13px] text-ink/60">
          Changed rows are marked. {paidFloor ? 'What was paid is the floor — a version never drops below it.' : 'Nothing paid yet.'}
        </p>
      </div>
    </Sheet>
  );
}

/** The door: "Side by side" beside the version line. Drawn only when there are two versions to compare. */
export function QuoteVersionsCompareDoor({ versions, paidFloor = false }: { versions: readonly QuoteVersion[]; paidFloor?: boolean }) {
  const [open, setOpen] = useState(false);
  if (versions.length < 2) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
        data-quote-compare-door=""
      >
        <Columns2 aria-hidden className="h-4 w-4" />
        Side by side
      </button>
      {open ? <QuoteVersionsCompare versions={versions} open={open} onClose={() => setOpen(false)} paidFloor={paidFloor} /> : null}
    </>
  );
}
