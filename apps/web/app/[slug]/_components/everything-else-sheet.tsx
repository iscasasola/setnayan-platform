'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Share2 } from 'lucide-react';
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
export function EverythingElseSheet({ rows }: { rows: EverythingElseRow[] }) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  const onTheDay = rows.filter((r) => r.group === 'on-the-day');
  const anytime = rows.filter((r) => r.group === 'anytime');

  return (
    <div className="mx-auto mt-3 w-full max-w-3xl px-4">
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
      <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-terracotta">
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
  const content = (
    <>
      <span className="min-h-[44px] flex-1 py-3 text-[15px] text-ink">{row.label}</span>
      {row.badge ? (
        <span className="shrink-0 text-[12px] text-ink/55">{row.badge}</span>
      ) : row.action === 'share' ? (
        <Share2 aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
      ) : (
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
      )}
    </>
  );

  if (row.action === 'share') {
    return (
      <button
        type="button"
        onClick={() => void shareThisPage(row.label)}
        className="flex w-full items-center gap-3 text-left"
      >
        {content}
      </button>
    );
  }

  // A row with neither href nor a share action never reaches here —
  // `resolveEverythingElseRows` guarantees one of the three (pinned by
  // everything-else-rows.test.ts) — but a badge-only row (no href) still
  // renders as inert text, exactly the "say when, don't link" the resolver
  // promises.
  if (!row.href) {
    return <div className="flex items-center gap-3 opacity-60">{content}</div>;
  }

  return (
    <Link href={row.href} className="flex items-center gap-3">
      {content}
    </Link>
  );
}

/** Same shape as `PublicPageActions`' share handler (native share sheet,
 *  clipboard fallback) — kept local rather than imported because that
 *  component's version is tangled with its own floating-pill "Copied"
 *  toast state, which this row-in-a-sheet has no room to show. */
async function shareThisPage(title: string) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title, url });
      return;
    } catch {
      // Cancelled or failed — fall through to copy.
    }
  }
  try {
    await nav?.clipboard?.writeText(url);
  } catch {
    /* clipboard blocked — nothing else to do */
  }
}
