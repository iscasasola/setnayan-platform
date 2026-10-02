'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import type { EverythingElseRow } from '../_lib/everything-else-rows';

/**
 * EverythingElseSheet — board 6 ("Phone — everything else"). A trigger row
 * plus the overflow sheet it opens: every guest-facing door
 * `resolveEverythingElseRows` decided this viewer may be shown, grouped ON
 * THE DAY / ANYTIME, one line each.
 *
 * The row list is computed by the caller (a pure function of data
 * `site-body.tsx` already resolved) — this component draws what it is
 * handed and decides nothing about availability. Empty list → render
 * nothing at all: there is no point offering a door to an empty room.
 *
 * ⛔ Not a `fixed bottom-0` bar (ARRIVAL-COMMON §6 — `GuestHubBar` was
 * retired for exactly that, covering the menu whole). This renders in the
 * document flow, same as `GuestDoorwayStrip` beside it.
 */
export function EverythingElseSheet({
  rows,
  tabAttrs = {},
}: {
  rows: EverythingElseRow[];
  /** 📱 Which tab of a tabbed page the row is on (`site-body.tsx`
   *  `pageTabs.attrs`). Empty on a page that is one scroll. */
  tabAttrs?: { 'data-hub-tab'?: string; hidden?: boolean };
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const onTheDay = rows.filter((r) => r.group === 'on-the-day');
  const anytime = rows.filter((r) => r.group === 'anytime');

  return (
    <div {...tabAttrs} className="mx-auto mt-3 w-full max-w-3xl px-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-cream px-4 py-3.5 text-sm text-ink transition-colors hover:border-terracotta"
      >
        Everything else
        <ChevronDown aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        labelledById="everything-else-heading"
        title="Everything else"
        rise
      >
        <h2 id="everything-else-heading" className="sr-only">
          Everything else on this invitation
        </h2>
        <div className="px-5 py-2">
          {onTheDay.length > 0 ? <RowGroup heading="On the day" rows={onTheDay} /> : null}
          {anytime.length > 0 ? <RowGroup heading="Anytime" rows={anytime} /> : null}
        </div>
      </Sheet>
    </div>
  );
}

function RowGroup({ heading, rows }: { heading: string; rows: EverythingElseRow[] }) {
  return (
    <div className="py-3">
      <p className="mb-1 font-mono text-xs font-bold uppercase tracking-[0.24em] text-terracotta">
        {heading}
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className="border-b border-ink/10 last:border-none">
            <Row row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ row }: { row: EverythingElseRow }) {
  // Every row is a live link — a row that would open nothing is never returned
  // (`resolveEverythingElseRows`, owner 2026-10-03: no greyed rows, no second
  // Share beside the footer's).
  return (
    <Link href={row.href} className="flex items-center gap-3">
      <span className="min-h-[44px] flex-1 py-3 text-[15px] text-ink">{row.label}</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
    </Link>
  );
}
