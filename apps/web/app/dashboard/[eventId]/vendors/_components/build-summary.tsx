/**
 * BuildSummary — the Services takeover's "Summary" cover tab (Budget "Build").
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * A read-only progress cover derived from the same `PlanBudgetModel` the accordion
 * uses: the chosen total vs budget (a meter), what's locked vs still open, and the
 * "what to lock next" list. (The Setnayan AI Assisted/Manual *toggle* is a Phase-5
 * follow-on — this surfaces its current status + a pointer to Manage.)
 *
 * Server component (pure render) — passed as the takeover's `summarySlot`.
 */
import Link from 'next/link';
import { Clock, Sparkles, Wallet } from 'lucide-react';
import type { PlanBudgetModel } from '@/lib/vendors-plan-budget';
import { CategoryFlags } from './category-flags';

const peso = (centavos: number) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;

const STATUS_COPY: Record<PlanBudgetModel['budgetStatus'], { label: string; tone: string }> = {
  no_target: { label: 'No budget set yet', tone: 'text-ink/55' },
  within: { label: 'Within your budget', tone: 'text-emerald-700' },
  near: { label: 'Close to your budget', tone: 'text-amber-700' },
  over: { label: 'Over your budget', tone: 'text-rose-700' },
};

export function BuildSummary({
  model,
  eventId,
  flaggedGroups = [],
}: {
  model: PlanBudgetModel;
  eventId: string;
  flaggedGroups?: string[];
}) {
  const status = STATUS_COPY[model.budgetStatus];
  const pct = Math.round(Math.min(1, Math.max(0, model.meterFill)) * 100);
  const meterTone =
    model.budgetStatus === 'over'
      ? 'bg-rose-500'
      : model.budgetStatus === 'near'
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  // Lock vs Flag (plan §12): OPEN categories (budgeted, no vendor) can be flagged
  // to fill; LOCKED (finalized) picks stay untouched.
  const children = model.folders.flatMap((f) => f.children);
  const openCats = children
    .filter((c) => c.state === 'empty')
    .map((c) => ({ groupId: c.groupId, label: c.label }));
  const lockedCount = children.filter((c) => c.state === 'finalized').length;

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

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Locked" value={model.recap.finalized} />
        <Stat label="Shortlisted" value={model.recap.shortlisted} />
        <Stat label="Hours saved" value={model.recap.hoursSaved} />
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
                  className={`text-xs ${d.timelineStatus === 'overdue' ? 'text-rose-700' : 'text-ink/55'}`}
                >
                  {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CategoryFlags
        eventId={eventId}
        openCats={openCats}
        lockedCount={lockedCount}
        flaggedGroups={flaggedGroups}
        aiOn={model.personalizationEnabled}
      />

      <section className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3">
        <span className="flex items-center gap-2 text-sm text-ink/70">
          <Sparkles className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden />
          Setnayan AI {model.personalizationEnabled ? 'is on' : 'is off'}
        </span>
        <Link
          href={`/dashboard/${eventId}/details`}
          className="text-xs font-medium text-terracotta hover:underline"
        >
          {model.personalizationEnabled ? 'Manage' : 'Turn on'}
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream px-3 py-3 text-center">
      <div className="font-display text-2xl italic text-ink">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{label}</div>
    </div>
  );
}
