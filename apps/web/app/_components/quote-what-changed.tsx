import { formatCentavos } from '@/lib/vendor-proposals';
import type { QuoteChanges } from '@/lib/quote-versions';

/**
 * "WHAT CHANGED SINCE VERSION N" — the one drawing of a quote's diff (owner, 4 Nov 2026,
 * approved prototype "Chat · an updated quote").
 *
 * ⛔ It draws only what `quoteChanges` (lib/quote-versions.ts) hands it. The couple's
 * card, the supplier's card, the "Every version" sheet and Admin › Disputes all mount
 * THIS component from THAT function — never a second comparison. Held by
 * `lib/quote-versions.test.ts`.
 */
function money(c: number | null): string {
  return typeof c === 'number' ? formatCentavos(c) : 'Complimentary';
}

export function QuoteWhatChanged({
  changes,
  sinceVersion,
}: {
  changes: QuoteChanges;
  sinceVersion: number;
}) {
  return (
    <div className="mt-2.5 border-t border-ink/10 pt-2.5 text-sm" data-quote-what-changed="">
      <p className="mb-1 text-xs text-ink/60">What changed since version {sinceVersion}</p>
      {changes.lines.length === 0 && !changes.plan ? (
        <p className="py-0.5 text-xs text-ink/60">Same lines and plan as version {sinceVersion}</p>
      ) : null}
      <ul>
        {changes.lines.map((c, i) => (
          <li key={i} className="flex items-baseline gap-2 py-0.5">
            <span
              aria-hidden
              className={`w-[18px] flex-none text-center font-semibold ${
                c.kind === 'added' ? 'text-success-700' : c.kind === 'removed' ? 'text-danger-700' : 'text-warn-800'
              }`}
            >
              {c.kind === 'added' ? '+' : c.kind === 'removed' ? '−' : '~'}
            </span>
            <span className="sr-only">{c.kind === 'added' ? 'Added' : c.kind === 'removed' ? 'Removed' : 'Changed'}</span>
            <span className={`min-w-0 flex-1 ${c.kind === 'removed' ? 'text-ink/55 line-through' : 'text-ink'}`}>
              {c.label}
            </span>
            <span className="whitespace-nowrap tabular-nums">
              {c.kind === 'changed' ? (
                <>
                  <span className="mr-1 text-ink/55 line-through">{money(c.from)}</span>
                  {money(c.to)}
                </>
              ) : c.kind === 'added' ? (
                money(c.to)
              ) : (
                <span className="text-ink/55 line-through">{money(c.from)}</span>
              )}
            </span>
          </li>
        ))}
        {changes.plan ? (
          <>
            <li className="flex items-baseline gap-2 py-0.5">
              <span aria-hidden className="w-[18px] flex-none text-center font-semibold text-warn-800">
                ~
              </span>
              <span className="min-w-0 flex-1 text-ink">Payment plan</span>
            </li>
            <li className="flex items-baseline gap-2 py-0.5">
              <span aria-hidden className="w-[18px] flex-none" />
              <span className="min-w-0 flex-1 text-xs text-ink/60">
                <span className="mr-1 line-through">{changes.plan.from ?? 'No plan'}</span>→{' '}
                {changes.plan.to ?? 'No plan'}
              </span>
            </li>
          </>
        ) : null}
        <li className="mt-1.5 flex items-baseline gap-2 border-t border-ink/10 pt-2">
          <span aria-hidden className="w-[18px] flex-none" />
          <span className="min-w-0 flex-1 font-semibold text-ink">Total</span>
          <span className="whitespace-nowrap tabular-nums">
            {changes.total.from !== changes.total.to ? (
              <span className="mr-1 text-ink/55 line-through">{formatCentavos(changes.total.from)}</span>
            ) : null}
            <b className="font-semibold text-ink">{formatCentavos(changes.total.to)}</b>
          </span>
        </li>
      </ul>
    </div>
  );
}
