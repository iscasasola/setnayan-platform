/**
 * Shared vendor-verification application-progress primitive.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A6).
 * The vendor submit surface (`app/vendor-dashboard/verify/page.tsx`) renders a
 * "{complete} of {total} items · {pct}%" progress card with an accessible
 * progress bar while a draft application is open. This is the step/progress
 * indicator the dedup brief calls out; it lives here so the bar markup +
 * percentage math have one home.
 *
 * The admin review surface shows the same completed-count as a plain inline
 * "Checklist: N/12 items complete" line inside its queue card (no progress
 * bar) — genuinely different DOM, so it is intentionally NOT routed through
 * this module.
 *
 * No DOM change: reproduces the vendor page's existing markup byte-for-byte.
 * Mirrors the role-parameterized pattern of
 * `app/_components/chat-message-stream.tsx`.
 */

import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from '@/lib/vendor-verification';

export function ApplicationProgress({
  completeCount,
  totalSlots,
  applicationType,
}: {
  completeCount: number;
  totalSlots: number;
  applicationType: ApplicationType;
}) {
  const pct = Math.round((completeCount / totalSlots) * 100);
  return (
    <article className="rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Application progress
          </p>
          <p className="text-base font-semibold">
            {completeCount} of {totalSlots} items · {pct}%
          </p>
        </div>
        <p className="font-mono text-xs text-ink/65">
          {APPLICATION_TYPE_LABEL[applicationType]}
        </p>
      </div>
      <div
        className="mt-3 h-2 w-full rounded-full bg-ink/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSlots}
        aria-valuenow={completeCount}
      >
        <div
          className="h-2 rounded-full bg-terracotta transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </article>
  );
}
