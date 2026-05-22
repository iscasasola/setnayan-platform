'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  Lock,
  Sparkles,
  Layers,
  Anchor,
  type LucideIcon,
} from 'lucide-react';
import type {
  EstimatedEffort,
  NextStep,
  NextStepStatus,
  Parallelizability,
} from '@/lib/next-steps';

// V1 pilot Home v2 — owner directive 2026-05-22 (Wave 2 of the home
// surface evolution). Senior PH wedding planner intelligence encoded
// as data and surfaced as a scannable list. Sits between the Today's
// One Thing hero (PR #337) and the 12-card PlanningGroups grid:
//
//   TodaysOneThing       — ONE thing to act on today
//   Next15Steps          — Scannable ladder of the next 15 things,
//                          tagged with parallelizability so the host
//                          knows what they can work on right now in
//                          parallel vs what's better to wait on.
//   <details>            — The full 12-card PlanningGroups grid for
//                          the host who wants the wide view.
//
// Renders nothing when the resolver returns an empty list (every
// step locked + every paperwork done + every sponsor accepted +
// every tool finalized — the celebratory end-state already covered
// by TodaysOneThing's AllLockedVariant).

type Props = {
  eventId: string;
  steps: ReadonlyArray<NextStep>;
};

// Default-visible step count when the section is collapsed. Owner
// directive 2026-05-22 — section was always-expanded and "cluttered
// the page", so the collapse keeps it scannable at first glance while
// preserving the full ladder one click away.
const VISIBLE_TOP_COUNT = 5;

// Disclosure increment — how many additional steps reveal per click.
// Owner directive 2026-05-22 — incremental reveal feels lighter than
// a single "Show 10 more" disclosure that dumped the entire remaining
// ladder at once. Five-at-a-time mirrors the initial-visible count, so
// the host opens the surface in equal chunks instead of one big jump.
const REVEAL_INCREMENT = 5;

export function Next15Steps({ eventId, steps }: Props) {
  // Number of additional steps revealed beyond VISIBLE_TOP_COUNT. State
  // lives client-side because we increment by REVEAL_INCREMENT per click
  // rather than dumping every remaining row at once. Hydration cost is
  // negligible — the rows themselves render server-side; only the
  // counter + button toggle is client-driven.
  const [extraVisible, setExtraVisible] = useState(0);

  if (steps.length === 0) return null;

  const topSteps = steps.slice(0, VISIBLE_TOP_COUNT);
  const remainingSteps = steps.slice(VISIBLE_TOP_COUNT);
  const visibleExtras = remainingSteps.slice(0, extraVisible);
  const hiddenCount = remainingSteps.length - extraVisible;
  const hasMore = remainingSteps.length > 0;
  const canRevealMore = hiddenCount > 0;
  const isExpanded = extraVisible > 0;
  // When fewer than REVEAL_INCREMENT remain, the button label reflects the
  // true remaining count ("Show 3 more steps") rather than a misleading
  // "Show 5 more" that under-delivers. Matches the existing pluralization
  // pattern (steps.length === 1 ? '' : 's').
  const nextRevealCount = Math.min(REVEAL_INCREMENT, hiddenCount);

  const handleShowMore = () => {
    setExtraVisible((prev) =>
      Math.min(prev + REVEAL_INCREMENT, remainingSteps.length)
    );
  };

  const handleShowFewer = () => {
    setExtraVisible(0);
  };

  return (
    <section
      aria-labelledby="next-15-steps-heading"
      className="space-y-3"
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <Layers
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={1.75}
          />
          <h2
            id="next-15-steps-heading"
            className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
          >
            Next {steps.length} step{steps.length === 1 ? '' : 's'} · your parallel work map
          </h2>
        </div>
      </header>

      <ol className="overflow-hidden rounded-2xl border border-ink/10 bg-cream/40 divide-y divide-ink/8">
        {topSteps.map((step, index) => (
          <li key={step.id}>
            <NextStepRow step={step} index={index} eventId={eventId} />
          </li>
        ))}
        {visibleExtras.map((step, index) => (
          <li key={step.id}>
            <NextStepRow
              step={step}
              index={VISIBLE_TOP_COUNT + index}
              eventId={eventId}
            />
          </li>
        ))}
        {hasMore ? (
          // Disclosure footer — surfaces either "Show N more steps" (when
          // more rows remain hidden) or "Show fewer" (when expanded with
          // no further rows to reveal). The two affordances are mutually
          // exclusive at any given time, but coexist when the host has
          // partially expanded the ladder — "Show 5 more steps" sits next
          // to "Show fewer" so they can keep revealing or collapse back.
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
            {canRevealMore ? (
              <button
                type="button"
                onClick={handleShowMore}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta transition-colors hover:text-terracotta/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <span>
                  Show {nextRevealCount} more step{nextRevealCount === 1 ? '' : 's'}
                </span>
                <span aria-hidden className="font-mono text-sm leading-none">
                  ↓
                </span>
              </button>
            ) : (
              <span aria-hidden className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                All caught up
              </span>
            )}
            {isExpanded ? (
              <button
                type="button"
                onClick={handleShowFewer}
                className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 transition-colors hover:text-ink/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
              >
                <span>Show fewer</span>
                <span aria-hidden className="font-mono text-sm leading-none">
                  ↑
                </span>
              </button>
            ) : null}
          </li>
        ) : null}
      </ol>

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Tagged with what you can do in parallel · expand the full plan below for every category
      </p>
    </section>
  );
}

// ---------- row ----------

function NextStepRow({
  step,
  index: _index,
  eventId: _eventId,
}: {
  step: NextStep;
  index: number;
  eventId: string;
}) {
  const statusPalette = STATUS_PALETTE[step.status];
  const parPalette = PARALLEL_PALETTE[step.parallelizability];
  const StatusIcon = statusPalette.icon;
  const ParIcon = parPalette.icon;

  return (
    <article className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-cream/70 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 sm:py-5">
      <div className="flex flex-1 flex-col gap-2">
        {/* Status pill + days context */}
        <header className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${statusPalette.pillBorder} ${statusPalette.pillBg} ${statusPalette.pillText}`}
          >
            <StatusIcon
              aria-hidden
              className={`h-3 w-3 ${statusPalette.iconColor}`}
              strokeWidth={2}
            />
            {statusLabel(step.status, step.daysFromFloor)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {step.category}
          </span>
        </header>

        {/* Title */}
        <h3 className="font-display text-lg italic leading-snug text-ink sm:text-xl">
          {step.title}
        </h3>

        {/* Why it matters */}
        <p className="text-sm leading-relaxed text-ink/70">
          {step.whyItMatters}
        </p>

        {/* Parallelizability + effort row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${parPalette.pillBorder} ${parPalette.pillBg} ${parPalette.pillText}`}
            title={parPalette.tooltip}
          >
            <ParIcon
              aria-hidden
              className={`h-3 w-3 ${parPalette.iconColor}`}
              strokeWidth={2}
            />
            {parallelLabel(step)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <Clock
              aria-hidden
              className="h-3 w-3 text-ink/40"
              strokeWidth={1.75}
            />
            {effortLabel(step.estimatedEffort)}
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0">
        <Link
          href={step.ctaHref}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-terracotta/30 bg-cream px-4 py-2 text-xs font-semibold text-terracotta transition-colors hover:bg-terracotta hover:text-cream focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream sm:text-sm"
        >
          {step.ctaLabel}
          <span aria-hidden className="font-mono">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}

// ---------- copy helpers ----------

function statusLabel(status: NextStepStatus, daysFromFloor: number): string {
  switch (status) {
    case 'overdue': {
      const days = Math.abs(daysFromFloor);
      if (days === 0) return 'Overdue today';
      return `Overdue · ${days} day${days === 1 ? '' : 's'} past`;
    }
    case 'due_this_week': {
      if (daysFromFloor === 0) return 'Due today';
      return `Due in ${daysFromFloor} day${daysFromFloor === 1 ? '' : 's'}`;
    }
    case 'due_this_month': {
      const weeks = Math.max(1, Math.round(daysFromFloor / 7));
      return `Due in ${weeks} week${weeks === 1 ? '' : 's'}`;
    }
    case 'next_up': {
      const weeks = Math.max(1, Math.round(daysFromFloor / 7));
      return `Next up · ~${weeks} week${weeks === 1 ? '' : 's'}`;
    }
    case 'not_started':
      return 'Not yet started';
  }
}

function effortLabel(effort: EstimatedEffort): string {
  switch (effort) {
    case '15min':
      return '15-min task';
    case '1hr':
      return '1-hour task';
    case '1day':
      return '1-day task';
    case '1wk':
      return '1-2 week effort';
    case 'ongoing':
      return 'Ongoing';
  }
}

function parallelLabel(step: NextStep): string {
  switch (step.parallelizability) {
    case 'foundation':
      return 'Foundation';
    case 'parallel_ok':
      return 'Parallel OK';
    case 'best_after':
      if (step.bestAfter && step.bestAfter.length > 0) {
        return `Best after · ${step.bestAfter.join(' · ')}`;
      }
      return 'Best after';
    case 'blocked':
      if (step.blockedOn && step.blockedOn.length > 0) {
        return `Blocked · finish ${step.blockedOn.join(' · ')} first`;
      }
      return 'Blocked';
  }
}

// ---------- palettes ----------

type StatusPalette = {
  pillBorder: string;
  pillBg: string;
  pillText: string;
  icon: LucideIcon;
  iconColor: string;
};

const STATUS_PALETTE: Record<NextStepStatus, StatusPalette> = {
  overdue: {
    pillBorder: 'border-rose-400/60',
    pillBg: 'bg-rose-100/60',
    pillText: 'text-rose-800',
    icon: AlertCircle,
    iconColor: 'text-rose-700',
  },
  due_this_week: {
    pillBorder: 'border-amber-400/60',
    pillBg: 'bg-amber-100/60',
    pillText: 'text-amber-800',
    icon: Clock,
    iconColor: 'text-amber-700',
  },
  due_this_month: {
    pillBorder: 'border-amber-300/50',
    pillBg: 'bg-amber-50/60',
    pillText: 'text-amber-800',
    icon: Clock,
    iconColor: 'text-amber-700',
  },
  next_up: {
    pillBorder: 'border-emerald-300/50',
    pillBg: 'bg-emerald-50/50',
    pillText: 'text-emerald-800',
    icon: Sparkles,
    iconColor: 'text-emerald-700',
  },
  not_started: {
    pillBorder: 'border-ink/15',
    pillBg: 'bg-ink/5',
    pillText: 'text-ink/65',
    icon: Sparkles,
    iconColor: 'text-ink/45',
  },
};

type ParallelPalette = {
  pillBorder: string;
  pillBg: string;
  pillText: string;
  icon: LucideIcon;
  iconColor: string;
  tooltip: string;
};

const PARALLEL_PALETTE: Record<Parallelizability, ParallelPalette> = {
  foundation: {
    pillBorder: 'border-terracotta/50',
    pillBg: 'bg-terracotta/10',
    pillText: 'text-terracotta',
    icon: Anchor,
    iconColor: 'text-terracotta',
    tooltip:
      'A foundation lock — nothing waits on this, but everything downstream becomes easier once it is in place.',
  },
  parallel_ok: {
    pillBorder: 'border-emerald-400/40',
    pillBg: 'bg-emerald-50/60',
    pillText: 'text-emerald-800',
    icon: Layers,
    iconColor: 'text-emerald-700',
    tooltip:
      'Safe to work on right now, regardless of what else you have not yet locked.',
  },
  best_after: {
    pillBorder: 'border-amber-400/50',
    pillBg: 'bg-amber-50/60',
    pillText: 'text-amber-800',
    icon: Clock,
    iconColor: 'text-amber-700',
    tooltip:
      'Possible to start now, but most planners recommend locking the upstream item first.',
  },
  blocked: {
    pillBorder: 'border-rose-400/40',
    pillBg: 'bg-rose-50/60',
    pillText: 'text-rose-800',
    icon: Lock,
    iconColor: 'text-rose-700',
    tooltip:
      'A prerequisite is still pending — finish that first to unlock this work.',
  },
};
