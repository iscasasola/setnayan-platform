import { ShieldCheck, AlertTriangle, Eye } from 'lucide-react';
import type { BuildGuard } from '@/lib/merkado-guard';

/**
 * MerkadoGuardBanner — the Setnayan AI "watch guard" over the couple's BUILD
 * (PR-4 · S4). Warn-only: it flags feasibility conflicts (budget · shared date ·
 * venue reach) and demand contention (another event inquiring about a picked
 * vendor on the couple's date), it never blocks. Server-rendered above the Build
 * engine; only mounted when Setnayan AI is active + the team has picks.
 */
export function MerkadoGuardBanner({
  guard,
  demand,
}: {
  guard: BuildGuard;
  demand: ReadonlyArray<{ name: string; count: number }>;
}) {
  const hasIssues = guard.issues.length > 0;

  return (
    <section
      aria-label="Setnayan AI watch guard"
      // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 11 · 13): read-only, so no card — a coloured edge says how it stands
      // (amber: something to review · green: all fits), the lines under it are plain rows on a hairline.
      className={`border-l-2 py-1 pl-3 ${hasIssues ? 'border-[rgb(var(--color-warn))]' : 'border-[rgb(var(--color-ok))]'}`}
    >
      <div className="flex items-start gap-2.5">
        {hasIssues ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" strokeWidth={2} aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={2} aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-semibold ${hasIssues ? 'text-warn-900' : 'text-success-800'}`}>
            {hasIssues
              ? `${guard.issues.length} thing${guard.issues.length > 1 ? 's' : ''} to review`
              : 'Sai’s watching — your suppliers fit'}
          </p>
          {hasIssues ? (
            <ul className="mt-1 divide-y divide-ink/10">
              {guard.issues.map((i, idx) => (
                <li key={`${i.kind}-${i.vendorId ?? idx}`} className="py-2 text-[14px] text-ink">
                  {i.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-[13px] text-ink/70">
              Shares a date, stays in budget, and reaches your venue.
            </p>
          )}
        </div>
      </div>

      {demand.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
          {demand.map((d) => (
            <li key={d.name} className="flex items-start gap-2 text-[14px] text-ink">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} aria-hidden />
              <span>
                Another couple is also considering{' '}
                <span className="font-medium text-ink">{d.name}</span> for your date — book it soon
                if it’s the one.
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
