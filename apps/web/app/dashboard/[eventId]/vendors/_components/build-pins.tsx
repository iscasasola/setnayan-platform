'use client';

/**
 * BuildPins — the Pin constraint solver's mode selector for the Build tab
 * (Budget "Build" · Phase 3a). Plan: `Budget_Build_Pin_Solver_Plan_2026-06-09.md`.
 *
 * "Pin one, recommend the rest." A segmented control lets the couple fix the
 * dimension they care about, and the rest is searched / auto-recommended:
 *   - Budget   (default) → the allocator recommends the service mix (the planner).
 *   - Services           → lock the chosen set; show what it costs + find the date.
 *   - Date               → fix the day; bridge to /find-date.
 *
 * Date-solve REUSES /find-date (the Schedule-Matrix Date Finder) — not forked.
 * Date-aware re-pricing (last-minute + seasonality) is Phase 3b. Mode is local UI
 * state (a transient view choice, not saved-build data). Client component.
 */

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Wallet, ListChecks, CalendarRange, ArrowRight, type LucideIcon } from 'lucide-react';
import { computeBudgetAllocation, type AllocationConfig } from '@/lib/budget-allocation';
import type { PlannerLeafInput } from '@/lib/budget-allocation-data';

type PinMode = 'budget' | 'services' | 'date';
const peso = (php: number) => `₱${Math.round(php ?? 0).toLocaleString('en-PH')}`;

const MODES: { key: PinMode; label: string; icon: LucideIcon; hint: string }[] = [
  {
    key: 'budget',
    label: 'Budget',
    icon: Wallet,
    hint: 'Your budget is fixed — we recommend the services that fit.',
  },
  {
    key: 'services',
    label: 'Services',
    icon: ListChecks,
    hint: 'Your services are fixed — here is what they cost, and when you can do them.',
  },
  {
    key: 'date',
    label: 'Date',
    icon: CalendarRange,
    hint: 'Your date is fixed — find the services and vendors that fit it.',
  },
];

export function BuildPins({
  eventId,
  budgetPhp,
  leaves,
  config,
  eventDate,
  plannerSlot,
}: {
  eventId: string;
  budgetPhp: number | null;
  leaves: PlannerLeafInput[];
  config: Partial<AllocationConfig>;
  eventDate?: string | null;
  plannerSlot: ReactNode;
}) {
  const [mode, setMode] = useState<PinMode>('budget');

  // Months until the event — drives the last-minute-surcharge heads-up (Phase 3b).
  const monthsUntil = useMemo(() => {
    if (!eventDate) return null;
    const t = new Date(eventDate).getTime();
    if (Number.isNaN(t)) return null;
    return (t - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
  }, [eventDate]);

  const cost = useMemo(() => {
    if (leaves.length === 0) return null;
    const r = computeBudgetAllocation({ budgetPhp: budgetPhp ?? 0, leaves, config });
    const lo = r.leaves.reduce((a, l) => a + l.rangeLowPhp, 0);
    const hi = r.leaves.reduce((a, l) => a + l.rangeHighPhp, 0);
    return { lo, hi, count: r.leaves.length };
  }, [budgetPhp, leaves, config]);

  const active = MODES.find((m) => m.key === mode) ?? MODES[0]!;
  const findDate = `/dashboard/${eventId}/find-date`;

  return (
    <div className="space-y-4">
      {/* What's fixed? — pin a dimension, the rest is recommended. */}
      <div>
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
          What is fixed?
        </div>
        <div
          role="tablist"
          aria-label="What is fixed"
          className="inline-flex flex-wrap gap-1 rounded-xl border border-ink/10 bg-cream p-1"
        >
          {MODES.map((m) => {
            const on = m.key === mode;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setMode(m.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  on ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden /> {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-ink/55">{active.hint}</p>
      </div>

      {mode === 'budget' && plannerSlot}

      {mode === 'services' && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
          {cost ? (
            <>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
                  Your chosen services typically cost
                </div>
                <div className="mt-1 font-display text-3xl italic text-ink">
                  {peso(cost.lo)} – {peso(cost.hi)}
                </div>
                <p className="mt-1 text-sm text-ink/60">
                  Across {cost.count} categories. Lock the services you want, then find the date that
                  keeps the most of them.
                </p>
              </div>
              <Link
                href={findDate}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
              >
                Find your date <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink/60">Add some services to see what they cost.</p>
          )}
        </div>
      )}

      {mode === 'date' && (
        <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/50">
              Pin your date
            </div>
            <p className="mt-1 text-sm text-ink/70">
              Know your date? See which vendors can all do it — and which dates keep the most of your
              shortlist.
            </p>
          </div>
          <Link
            href={findDate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:opacity-90"
          >
            Find your date <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </Link>
          {monthsUntil != null && monthsUntil >= 0 && monthsUntil < 6 ? (
            <p className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Your date is about {Math.max(1, Math.round(monthsUntil * 4.345))} weeks away — some
              vendors add a last-minute surcharge for bookings this close, so lock the ones you love
              early.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
