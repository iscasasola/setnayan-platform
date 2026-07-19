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
      className={`rounded-2xl border p-4 ${
        hasIssues ? 'border-warn-300/60 bg-warn-50' : 'border-success-200 bg-success-50'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {hasIssues ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-600" strokeWidth={2} aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success-600" strokeWidth={2} aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${hasIssues ? 'text-warn-900' : 'text-success-800'}`}>
            {hasIssues
              ? `${guard.issues.length} thing${guard.issues.length > 1 ? 's' : ''} to review`
              : 'Suri’s watching — your team fits'}
          </p>
          {hasIssues ? (
            <ul className="mt-2 space-y-1.5">
              {guard.issues.map((i, idx) => (
                <li
                  key={`${i.kind}-${i.vendorId ?? idx}`}
                  className="rounded-lg border border-warn-300/50 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/80"
                >
                  {i.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-xs text-ink/55">
              Shares a date, stays in budget, and reaches your venue.
            </p>
          )}
        </div>
      </div>

      {demand.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3">
          {demand.map((d) => (
            <li key={d.name} className="flex items-start gap-2 text-xs text-ink/75">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-terracotta" strokeWidth={1.75} aria-hidden />
              <span>
                Another couple is also considering{' '}
                <span className="font-medium text-ink">{d.name}</span> for your date — lock it in soon
                if it’s the one.
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
