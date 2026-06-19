/**
 * BuildSummary — the Services takeover's "Summary" cover tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * A read-only progress cover derived from the same `PlanBudgetModel` the accordion
 * uses: the chosen total vs budget (a meter), what's locked vs still open, and the
 * "what to lock next" list. The ONE control on this cover is the inline Setnayan
 * AI toggle (owner 2026-06-09) — flips planning_mode in place, no navigation. The
 * Flag/Compute control moved to the Build tab where it belongs.
 *
 * Server component (pure render) — passed as the takeover's `summarySlot`.
 */
import { Clock, Wallet } from 'lucide-react';
import type { PlanBudgetModel } from '@/lib/vendors-plan-budget';
import { SummaryAiToggle } from './summary-ai-toggle';

const peso = (centavos: number) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;

const STATUS_COPY: Record<PlanBudgetModel['budgetStatus'], { label: string; tone: string }> = {
  no_target: { label: 'No budget set yet', tone: 'text-ink/55' },
  within: { label: 'Within your budget', tone: 'text-success-700' },
  near: { label: 'Close to your budget', tone: 'text-warn-700' },
  over: { label: 'Over your budget', tone: 'text-danger-700' },
};

export function BuildSummary({
  model,
  eventId,
  buildsCount = 0,
}: {
  model: PlanBudgetModel;
  eventId: string;
  /** Number of saved builds (budget_builds rows) — drives the "Builds" tile. */
  buildsCount?: number;
}) {
  const status = STATUS_COPY[model.budgetStatus];
  const pct = Math.round(Math.min(1, Math.max(0, model.meterFill)) * 100);
  const meterTone =
    model.budgetStatus === 'over'
      ? 'bg-danger-500'
      : model.budgetStatus === 'near'
        ? 'bg-warn-500'
        : 'bg-success-500';

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-1 py-2">
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            <Wallet className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden /> Where your day stands
          </span>
          <span className={`text-xs font-medium ${status.tone}`}>{status.label}</span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl italic text-ink">{peso(model.chosenCentavos)}</span>
          <span className="text-sm text-ink/55">chosen so far</span>
        </div>
        <p className="mt-1 text-sm text-ink/60">
          Shortlist spans {peso(model.rangeLoCentavos)}–{peso(model.rangeHiCentavos)}
          {model.targetCentavos != null ? ` · budget ${peso(model.targetCentavos)}` : ''}
        </p>
        {model.targetCentavos != null && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div className={`h-full rounded-full ${meterTone}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </section>

      {/* Prototype's 4-tile recap: Viewed · Shortlisted · Builds · Locked.
          Viewed = the marketplace pool the couple has seen (recap.searched);
          Builds = saved compare-builds (budget_builds). (Hours-saved is still
          modeled; the approved prototype surfaces these four instead.) */}
      <section className="grid grid-cols-4 gap-2">
        <Stat label="Viewed" value={model.recap.searched} />
        <Stat label="Shortlisted" value={model.recap.shortlisted} tone="mulberry" />
        <Stat label="Builds" value={buildsCount} />
        <Stat label="Locked" value={model.recap.finalized} tone="gold" />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl italic text-ink/85">What to lock next</h2>
        {model.dueList.length === 0 ? (
          <p className="rounded-xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink/60">
            Nothing urgent — you are on track.
          </p>
        ) : (
          <ul className="space-y-2">
            {model.dueList.slice(0, 5).map((d) => (
              <li
                key={d.groupId}
                className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Clock className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden /> {d.label}
                </span>
                <span
                  className={`text-xs ${d.timelineStatus === 'overdue' ? 'text-danger-700' : 'text-ink/55'}`}
                >
                  {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* The Summary's single control — flips Setnayan AI in place (no nav). */}
      <SummaryAiToggle eventId={eventId} enabled={model.personalizationEnabled} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'ink',
}: {
  label: string;
  value: number;
  tone?: 'ink' | 'gold' | 'mulberry';
}) {
  const numTone = tone === 'gold' ? 'text-terracotta' : tone === 'mulberry' ? 'text-mulberry' : 'text-ink';
  return (
    <div className="rounded-xl border border-ink/10 bg-cream px-2 py-3 text-center">
      <div className={`font-display text-2xl italic ${numTone}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/50">{label}</div>
    </div>
  );
}
