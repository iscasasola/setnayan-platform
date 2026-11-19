'use client';

/**
 * ➡ THE NEXT STEP ROW, PINNED ON TOP OF CHAT (owner 18 Nov 2026 — *"Yes, keep it"*; drawing Q37bc7Bf v12 §2/§3). One
 * line naming the one thing that needs the supplier; tapping it opens that tab — on a phone the tab switches, on a
 * computer the work column beside the chat does, and the chat never moves or reloads. The line itself is decided on the
 * server from reads the page already made (`lib/client-next-step.ts`); with nothing to say (or an unread stage) the page
 * draws no row at all.
 */
import { ChevronRight } from 'lucide-react';
import type { ClientNextStep } from '@/lib/client-next-step';
import { usePickedNav } from './picked-client-nav';

export function ClientNextStepRow({ step }: { step: ClientNextStep }) {
  const nav = usePickedNav();
  if (!nav) return null;
  // A folded door id lands on its part: `payments` → Book & Budget at the payments.
  const door = step.anchor === 'payments' ? 'payments' : step.page;
  return (
    <div className="px-3 pb-1 pt-2" data-client-next-step={step.page}>
      <button
        type="button"
        onClick={() => nav.select(door as Parameters<typeof nav.select>[0])}
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
