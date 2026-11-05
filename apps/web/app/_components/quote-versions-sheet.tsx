'use client';

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from './sheet';
import { QuoteWhatChanged } from './quote-what-changed';
import { formatCentavos } from '@/lib/vendor-proposals';
import { formatCount } from '@/lib/format-number';
import {
  changesSincePrevious,
  versionDay,
  versionSummary,
  type QuoteVersion,
} from '@/lib/quote-versions';

/**
 * "SEE EVERY VERSION (N)" — the row on a quote card, and the sheet it opens (owner, 4 Nov 2026,
 * approved prototype "Chat · every version"). Both sides mount it.
 *
 * Newest first: "Version 2 · current" · "Nov 2 · 3 lines · 2 changes" · the total. A row opens
 * that version in place: its lines, its total, its plan and its own What changed — drawn by
 * `<QuoteWhatChanged>` from `changesSincePrevious`, the same function the card uses.
 */
export function QuoteVersionsRow({
  versions,
  counterpartyLabel,
}: {
  /** One quote's versions, newest first (`versionsNewestFirst`). */
  versions: readonly QuoteVersion[];
  counterpartyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<QuoteVersion | null>(null);
  const headingId = useId();
  if (versions.length < 2) return null;
  const current = versions[0];
  const close = () => {
    setOpen(false);
    setPicked(null);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-11 w-full items-center gap-2 text-left text-sm text-ink/60 hover:text-ink"
        data-quote-every-version=""
      >
        <span className="flex-1">See every version ({formatCount(versions.length)})</span>
        <ChevronRight aria-hidden className="h-4 w-4 opacity-60" />
      </button>
      <Sheet
        open={open}
        onClose={close}
        labelledById={headingId}
        title={picked ? `Version ${picked.version}` : 'Every version'}
        back={picked ? { label: 'Every version', onBack: () => setPicked(null) } : undefined}
      >
        {picked ? (
          <div className="px-4 pb-6 pt-3">
            <h2 id={headingId} className="text-lg font-medium text-ink">
              Version {picked.version} · {versionDay(picked.at)}
            </h2>
            <ul className="mt-1 text-sm">
              {picked.lines.map((li, i) => (
                <li key={i} className="flex min-h-[52px] items-center gap-3 border-b border-ink/10">
                  <span className="min-w-0 flex-1 text-ink">{li.label}</span>
                  <span className="tabular-nums text-ink/80">
                    {typeof li.amount_centavos === 'number' ? formatCentavos(li.amount_centavos) : 'Complimentary'}
                  </span>
                </li>
              ))}
              <li className="flex min-h-[52px] items-center gap-3 border-b border-ink/10">
                <span className="flex-1 font-semibold text-ink">Total</span>
                <b className="font-semibold tabular-nums text-ink">{formatCentavos(picked.totalCentavos)}</b>
              </li>
              {picked.plan ? (
                <li className="flex min-h-[52px] items-center border-b border-ink/10 text-xs text-ink/60">
                  {picked.plan}
                </li>
              ) : null}
            </ul>
            {(() => {
              const changes = changesSincePrevious(picked);
              return changes && picked.previous ? (
                <QuoteWhatChanged changes={changes} sinceVersion={picked.previous.version} />
              ) : null;
            })()}
          </div>
        ) : (
          <div className="px-4 pb-6 pt-3">
            <h2 id={headingId} className="text-[22px] font-medium text-ink">
              Every version
            </h2>
            <p className="text-sm text-ink/60">Quote with {counterpartyLabel} · newest first</p>
            <ul className="mt-2">
              {versions.map((v) => (
                <li key={v.proposalId}>
                  <button
                    type="button"
                    onClick={() => setPicked(v)}
                    className="flex min-h-[52px] w-full items-center gap-3 border-b border-ink/10 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink">
                        Version {v.version}
                        {v === current && v.status !== 'superseded' ? ' · current' : ''}
                      </span>
                      <small className="block text-[13px] text-ink/60">{versionSummary(v)}</small>
                    </span>
                    <span className="tabular-nums text-ink">{formatCentavos(v.totalCentavos)}</span>
                    <ChevronRight aria-hidden className="h-4 w-4 flex-none opacity-50" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  );
}
