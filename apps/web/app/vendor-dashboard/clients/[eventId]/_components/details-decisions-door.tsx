'use client';

import { ChevronRight } from 'lucide-react';
import { usePickedNav } from './picked-client-nav';

/**
 * 🤝 "Decisions" on Details (v113 `dec`; Build 1 = a door) — one line from the quote Details already reads
 * (`decisionsLine`), then the client's Chat page, in place, where every decision is. No read of its own.
 */
export function DetailsDecisionsDoor({ line }: { line: string }) {
  const nav = usePickedNav();
  if (!nav) return null;
  return (
    <section data-details-decisions="" aria-label="Decisions">
      <p className="home-k2 pb-1">Decisions</p>
      <button type="button" onClick={() => nav.select('chat')} className="sn-press flex min-h-12 w-full items-center gap-3 py-2 text-left" data-details-decisions-open="">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] text-ink">{line}</span>
          <span className="block text-[12px] text-ink/60">Meetings, changes and payments are in Chat</span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 text-ink/60" />
      </button>
    </section>
  );
}
