'use client';

/**
 * ➡ THE NEXT STEP ROW, PINNED ON TOP OF CHAT — ONE part for both sides (supplier: owner 18 Nov 2026, drawing Q37bc7Bf
 * v12 §2/§3; host: owner 19 Nov 2026). One line naming the one thing that needs the reader; tapping it opens that tab —
 * on a phone the tab switches, on a computer the work column beside the chat does, and the chat never moves or reloads.
 * The line is decided on the server from reads the page already made (`lib/client-next-step.ts`); with nothing to say
 * (or an unread stage) the page draws no row at all.
 */
import { useContext } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ClientNextStep } from '@/lib/client-next-step';
import { PickedNavContext } from './picked-nav';

export function NextStepRow({ step }: { step: ClientNextStep }) {
  const nav = useContext(PickedNavContext);
  if (!nav) return null;
  // A part of a page is a door id of its own (`payments` → Book & Budget at the payments); the shell maps it.
  const door = step.anchor === 'payments' ? 'payments' : step.page;
  return (
    <div className="px-3 pb-1 pt-2" data-next-step={step.page}>
      <button
        type="button"
        onClick={() => nav.select(door)}
        className="sn-press flex min-h-12 w-full items-center gap-3 rounded-xl bg-frame px-3 py-2 text-left shadow-sn-frame"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-ink/70">Next step</span>
          <span className="block truncate text-sm font-semibold text-ink">{step.line}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-sn-accent">
          Open
          <ChevronRight aria-hidden className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
