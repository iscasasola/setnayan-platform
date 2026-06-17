import Link from 'next/link';
import { Circle, CheckCircle2, ArrowRight, CalendarPlus } from 'lucide-react';
import {
  CHECKLIST_CATEGORY_LABELS,
  checklistItemHref,
  type ChecklistItemView,
  type ChecklistPhaseGroup,
} from '@/lib/checklist';
import { CATEGORY_STATE_LABELS, type CategoryDecisionState } from '@/lib/checklist-state';
import { toggleChecklistItem } from '../../checklist-actions';
import { CategoryDecisionPrompt } from '../CategoryDecisionPrompt';

/**
 * ChecklistFull — the browsable, full wedding checklist.
 *
 * Renders every task grouped under its countdown phase (18 months out → the day
 * of & after), each with a one-tap toggle and a computed due date. Pure server
 * component: toggles are plain <form action> submits (no client JS), mirroring
 * the home ChecklistCard. The list is deterministic and free — Setnayan AI only
 * tailors WHICH tasks appear (church steps are dropped for a civil ceremony).
 *
 * Also renders a "Vendor categories" section below the task list, with inline
 * CategoryDecisionPrompt nudges for each vendor plan group the couple is
 * tracking (Tier 1 + Tier 2 + their onboarding picks).
 */

export type CategoryStateEntry = {
  planGroupId: string;
  label: string;
  state: CategoryDecisionState;
};

type Props = {
  eventId: string;
  groups: ReadonlyArray<ChecklistPhaseGroup>;
  totalCount: number;
  doneCount: number;
  /** Couple's wedding date — null shows the "add a date" hint instead of due dates. */
  eventDate: string | null;
  /** Per-plan-group decision states for vendor categories. */
  categoryStates?: ReadonlyArray<CategoryStateEntry>;
};

/** Format a computed due date + soft urgency tint for the meta line. */
function dueLabel(item: ChecklistItemView): { label: string; tint: string } {
  if (!item.dueDate) return { label: 'No date yet', tint: 'text-ink/40' };
  const d = item.daysUntilDue;
  const pretty = new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  let tint = 'text-ink/55';
  if (d != null) {
    if (d < 0) tint = 'text-rose-700';
    else if (d <= 7) tint = 'text-amber-700';
  }
  return { label: `Due ${pretty}`, tint };
}

function PhaseRows({ eventId, items }: { eventId: string; items: ReadonlyArray<ChecklistItemView> }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const done = item.status === 'done';
        const tag = dueLabel(item);
        const href = checklistItemHref(eventId, item.template_key);
        const desired = done ? 'pending' : 'done';
        return (
          <li
            key={item.item_id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${
              done ? 'border-ink/5 bg-cream' : 'border-ink/10 bg-white'
            }`}
          >
            {/* One-tap toggle — server action, no client JS. */}
            <form action={toggleChecklistItem} className="shrink-0">
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="item_id" value={item.item_id} />
              <input type="hidden" name="desired" value={desired} />
              <button
                type="submit"
                aria-label={done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full transition ${
                  done ? 'text-emerald-600' : 'text-ink/35 hover:text-emerald-600'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
                ) : (
                  <Circle className="h-5 w-5" strokeWidth={1.75} />
                )}
              </button>
            </form>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${done ? 'text-ink/45 line-through' : 'text-ink'}`}>
                {item.title}
              </p>
              <p className="truncate text-xs">
                <span className="text-ink/45">{CHECKLIST_CATEGORY_LABELS[item.category]}</span>
                <span aria-hidden className="text-ink/25"> · </span>
                <span className={done ? 'text-ink/40' : tag.tint}>{tag.label}</span>
              </p>
            </div>

            {href ? (
              <Link
                href={href}
                aria-label={`Go to ${item.title}`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-terracotta transition hover:bg-terracotta/10"
              >
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** State dot color for the passive pill (one_option, searching, in_progress, done). */
function stateDotClass(state: CategoryDecisionState): string {
  switch (state) {
    case 'done':       return 'bg-emerald-500';
    case 'in_progress': return 'bg-blue-400';
    case 'searching':  return 'bg-violet-400';
    case 'one_option': return 'bg-amber-400';
    default:           return 'bg-ink/20';
  }
}

/**
 * VendorCategoriesSection — the per-plan-group decision prompt block.
 *
 * Shows below the phase-based task list. Each plan group row shows:
 *   - group label
 *   - current state pill (passive states: in_progress / done / searching / one_option)
 *   - CategoryDecisionPrompt for actionable states (not_started / needs_more_options /
 *     excluded / deferred)
 */
function VendorCategoriesSection({
  eventId,
  categoryStates,
}: {
  eventId: string;
  categoryStates: ReadonlyArray<CategoryStateEntry>;
}) {
  if (categoryStates.length === 0) return null;

  // Show passive-state entries only if they have something to communicate;
  // filter out completely-active states that already have an inline prompt.
  const PASSIVE_STATES: ReadonlySet<CategoryDecisionState> = new Set([
    'one_option',
    'searching',
    'in_progress',
    'done',
  ]);
  const PROMPT_STATES: ReadonlySet<CategoryDecisionState> = new Set([
    'not_started',
    'needs_more_options',
    'excluded',
    'deferred',
  ]);

  return (
    <section className="space-y-3">
      <div className="border-b border-ink/10 pb-1">
        <h2 className="text-sm font-semibold text-ink">Vendor categories</h2>
        <p className="mt-0.5 text-xs text-ink/55">
          Let us know what you need — skip categories that don't apply.
        </p>
      </div>

      <ul className="space-y-2.5">
        {categoryStates.map(({ planGroupId, label, state }) => {
          const isPassive = PASSIVE_STATES.has(state);
          const hasPrompt = PROMPT_STATES.has(state);

          return (
            <li key={planGroupId}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink">{label}</span>

                {/* Passive states: show a status pill instead of a prompt */}
                {isPassive && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-2 py-0.5 text-[11px] text-ink/60">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${stateDotClass(state)}`}
                    />
                    {CATEGORY_STATE_LABELS[state]}
                  </span>
                )}
              </div>

              {/* Prompt states: inline decision nudge */}
              {hasPrompt && (
                <CategoryDecisionPrompt
                  planGroupId={planGroupId}
                  currentState={state}
                  eventId={eventId}
                  label={label}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ChecklistFull({ eventId, groups, totalCount, doneCount, eventDate, categoryStates }: Props) {
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Your wedding</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wedding checklist</h1>
          <p className="text-sm text-ink/65">
            Your full plan, from 18 months out to the day itself. Every due date is worked out from
            your wedding date — change the date and the whole countdown shifts with it. Tick things
            off at your own pace; this is a guide, not a gate.
          </p>
        </div>

        {totalCount > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                {doneCount} of {totalCount} done
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/45">
                {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        {!eventDate ? (
          <Link
            href={`/dashboard/${eventId}/invitation`}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-cream px-4 py-2.5 text-sm text-ink/70 transition hover:border-terracotta/40"
          >
            <CalendarPlus aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
            <span>Add your wedding date to see a due date on every task</span>
          </Link>
        ) : null}
      </header>

      {/* Vendor categories decision section — above the phase task list so couples
          can orient on what they need before diving into individual tasks. */}
      {categoryStates && categoryStates.length > 0 ? (
        <VendorCategoriesSection eventId={eventId} categoryStates={categoryStates} />
      ) : null}

      {totalCount === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream px-4 py-6 text-center text-sm text-ink/60">
          Your checklist is being set up — check back in a moment.
        </p>
      ) : (
        <div className="space-y-7">
          {groups.map(({ phase, items }) => {
            const phaseDone = items.filter((i) => i.status === 'done').length;
            return (
              <section key={phase?.id ?? 'custom'} className="space-y-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-1">
                    <h2 className="text-sm font-semibold text-ink">
                      {phase ? phase.label : 'Your own tasks'}
                    </h2>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                      {phaseDone}/{items.length}
                    </span>
                  </div>
                  {phase ? <p className="text-xs text-ink/55">{phase.blurb}</p> : null}
                </div>
                <PhaseRows eventId={eventId} items={items} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
