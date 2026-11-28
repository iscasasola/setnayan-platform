import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * QuietStart — an empty screen that reads as DELIBERATE, not unfinished.
 *
 * 🔑 THIS IS A PORT, NOT A DESIGN. Every mark here is lifted from
 * `app/dashboard/(account)/samahan/page.tsx`, which an outside comparison called
 * the best-designed screen it saw: a `sn-tile` card, one muted `ink/35` glyph, a
 * short headline stating the fact, one sentence teaching what will land here,
 * and — only when the person can actually start it — a single mulberry action.
 * Nothing was redrawn; the samahan page now renders through this instead of
 * inline, so the pattern has ONE home rather than a copy per screen.
 *
 * ⚠ IT IS NOT `<EmptyState>` AND MUST NOT BE MERGED INTO IT. That component
 * exists, ships, and is CORRECT — for the ADMIN register. It draws a terracotta
 * ring, demands `readPermitted: true`, and prints an audit line ("Verified: read
 * permitted · 0 rows") which is engineering language on a screen a couple reads.
 * Two registers, two components, on purpose.
 *
 * ⚖ WHEN NOT TO USE IT. Production is pre-launch and most of these screens are
 * empty BECAUSE THAT IS THE PLAN. This changes how emptiness READS; it never
 * removes an empty state and it is never a defect report. And it is for a
 * PAGE-LEVEL emptiness only: inside a search sheet, a filter or a drawer, "No
 * one matches that name" belongs as a plain line, and a centred card there is
 * worse than what it replaces.
 */
export function QuietStart({
  Icon,
  title,
  blurb,
  action,
  className = '',
}: {
  Icon: LucideIcon;
  /** States the fact in the person's own words. Never apologises. */
  title: string;
  /** One sentence: what lands here, and what puts it there. */
  blurb: string;
  /** The single thing that fills the screen. Omit when it fills on its own —
   *  an action nobody can take is worse than no action. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sn-tile p-8 text-center ${className}`}>
      <Icon aria-hidden className="mx-auto h-8 w-8 text-ink/35" strokeWidth={1.75} />
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/60">{blurb}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
