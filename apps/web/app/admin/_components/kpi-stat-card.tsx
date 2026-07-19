/**
 * KpiStatCard — the canonical admin KPI-stat tile (label + big number).
 *
 * WHY (#2965 deferred polish · 2026-07-10): the same numeric stat tile was
 * hand-rewritten on the Overview stats grid and on the Taxonomy + AI-brain
 * pages (identical `.m-card`/`bg-cream` box + mono eyebrow + display number).
 * This is the ONE admin-local source for it. Admin-scoped on purpose — it is
 * NOT a repo-wide shared component the couple/vendor doorways import.
 *
 * Chrome (Glass PR-8, 2026-07-15 · rollout plan § 3.4): an opaque `.sn-row`
 * card (these render in an 8-up grid, so they stay OFF the blur budget — flat
 * tint, no backdrop-filter), a `.sn-eye` gold eyebrow, and the **Space Mono**
 * data face for the numeral (the Saira-Condensed KPI numerals are retired
 * app-wide — every numeral/count is Space Mono via `font-mono`). A finite
 * numeric value counts up on mount via the shared CountUp island; a `null`
 * value renders an em-dash so a degraded count never shows a misleading 0.
 */

import type { ReactNode } from 'react';
import { CountUp } from '@/app/_components/count-up';

export function KpiStatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  /** Count/label. `null` = unavailable → em-dash (never a misleading 0). */
  value: number | string | null;
  /** Optional secondary line under the number (e.g. a unit or note). */
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`sn-row p-4${className ? ` ${className}` : ''}`}>
      <p className="sn-eye">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-[color:var(--sn-ink-900)]">
        {value === null ? (
          '—'
        ) : typeof value === 'number' ? (
          <CountUp value={value} />
        ) : (
          value
        )}
      </p>
      {hint != null ? (
        <p className="mt-0.5 text-xs text-[color:var(--sn-ink-400)]">{hint}</p>
      ) : null}
    </div>
  );
}
