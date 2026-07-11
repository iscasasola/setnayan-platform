/**
 * KpiStatCard — the canonical admin KPI-stat tile (label + big number).
 *
 * WHY (#2965 deferred polish · 2026-07-10): the same numeric stat tile was
 * hand-rewritten on the Overview stats grid and on the Taxonomy + AI-brain
 * pages (identical `.m-card`/`bg-cream` box + mono eyebrow + display number).
 * This is the ONE admin-local source for it. Admin-scoped on purpose — it is
 * NOT a repo-wide shared component the couple/vendor doorways import.
 *
 * Chrome = the canonical `.m-card` (the .m-card unification pass), a `.m-mono`
 * uppercase eyebrow, and the Saira display face for the tabular number. `null`
 * value renders an em-dash so a degraded count never shows a misleading 0.
 *
 * Server-renderable (no client JS).
 */

import type { ReactNode } from 'react';

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
    <div className={`m-card p-4${className ? ` ${className}` : ''}`}>
      <p className="m-mono text-[10px] uppercase tracking-[0.15em] text-[color:var(--m-slate-3)]">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--m-ink)]"
        style={{ fontFamily: "var(--font-condensed), 'Saira Condensed', sans-serif", fontVariantNumeric: 'tabular-nums' }}
      >
        {value === null ? '—' : value}
      </p>
      {hint != null ? (
        <p className="mt-0.5 text-xs text-[color:var(--m-slate)]">{hint}</p>
      ) : null}
    </div>
  );
}
