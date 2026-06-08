import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  Sparkles,
  Star,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
} from 'lucide-react';
import type { ResolvedTask, TodaysTaskStatus } from '@/lib/todays-one-thing';

// V1 pilot Home v2 — owner directive 2026-05-22 (Headspace-pattern).
//
// SINGLE-FOCUS hero card replacing the would-have-been 5-card carousel.
// The host sees ONE thing to do today, not 5 — reduces decision
// paralysis. The 12-card PlanningGroups grid below collapses behind a
// "Show all N more tasks" disclosure beneath this hero, so a host who
// IS ready to ladder through multiple categories can still see them.
//
// Three render variants:
//   - Resolved task → the canonical "Setnayan AI" card with status
//     pill, action title, why-it-matters paragraph, deep-link CTA.
//   - No wedding_date set → date-prompt variant nudging the host to
//     set a date so the resolver has an anchor.
//   - Every category locked → celebratory variant ("You've locked
//     them all"). Edge case but worth handling for emotional payoff.

type Props = {
  eventId: string;
  /** Today's #1 task, resolved server-side. Null = host either has
   *  no wedding_date OR every category is already locked. Caller
   *  distinguishes the two by passing `weddingDateMissing`. */
  topPriorityTask: ResolvedTask | null;
  /** True when the host hasn't set `events.event_date` yet. Drives
   *  the date-prompt variant instead of the celebratory one. */
  weddingDateMissing: boolean;
  /** UNLOCKED categories count — drives the disclosure label below
   *  the hero ("Show all 11 more tasks ↓"). 0 when every category is
   *  locked (celebratory variant). */
  totalRemainingTasks: number;
};

export function TodaysOneThing({
  eventId,
  topPriorityTask,
  weddingDateMissing,
  totalRemainingTasks,
}: Props) {
  // Variant 1 — no wedding date yet → date prompt.
  if (weddingDateMissing) {
    return (
      <DatePromptVariant eventId={eventId} />
    );
  }

  // Variant 2 — every category locked → celebratory variant.
  if (topPriorityTask === null) {
    return <AllLockedVariant />;
  }

  // Variant 3 — canonical resolved-task hero.
  return (
    <ResolvedTaskVariant
      task={topPriorityTask}
      remainingCount={totalRemainingTasks}
    />
  );
}

// ---------- variants ----------

function ResolvedTaskVariant({
  task,
  remainingCount,
}: {
  task: ResolvedTask;
  remainingCount: number;
}) {
  const palette = STATUS_PALETTE[task.status];
  const PillIcon = palette.pillIcon;

  return (
    <section
      aria-labelledby="todays-one-thing-heading"
      className="space-y-3"
    >
      <header className="flex items-baseline gap-2">
        <Star
          aria-hidden
          className="h-3.5 w-3.5 text-terracotta"
          strokeWidth={1.75}
        />
        <h2
          id="todays-one-thing-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
        >
          Up next
        </h2>
      </header>

      <article
        className={`flex flex-col gap-5 rounded-2xl border-2 p-6 sm:p-8 ${palette.border} ${palette.bg}`}
      >
        <header className="flex items-start justify-between gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${palette.pillBorder} ${palette.pillBg}`}
          >
            <PillIcon
              aria-hidden
              className={`h-3.5 w-3.5 ${palette.pillIconColor}`}
              strokeWidth={2}
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.18em] ${palette.pillTextColor}`}
            >
              {pillLabel(task)}
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            {task.category}
          </p>
        </header>

        <div className="space-y-3">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            {task.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
            {task.whyItMatters}
          </p>
        </div>

        <div>
          <Link
            href={task.ctaHref}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream"
          >
            {task.ctaLabel}
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </article>

      {remainingCount > 1 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {`${remainingCount - 1} more ${remainingCount - 1 === 1 ? 'task' : 'tasks'} below`}
        </p>
      ) : null}
    </section>
  );
}

function DatePromptVariant({ eventId }: { eventId: string }) {
  return (
    <section
      aria-labelledby="todays-one-thing-heading"
      className="space-y-3"
    >
      <header className="flex items-baseline gap-2">
        <Star
          aria-hidden
          className="h-3.5 w-3.5 text-terracotta"
          strokeWidth={1.75}
        />
        <h2
          id="todays-one-thing-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
        >
          Up next
        </h2>
      </header>

      <article className="flex flex-col gap-5 rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
        <header className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/40 bg-terracotta/5 px-3 py-1">
            <CalendarPlus
              aria-hidden
              className="h-3.5 w-3.5 text-terracotta"
              strokeWidth={2}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              First things first
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            Set your wedding date
          </h3>
          <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
            The date anchors everything else — your countdown, your vendor
            lock-by reminders, your timeline. Even a tentative month works for
            now; you can sharpen it later.
          </p>
        </div>

        <div>
          {/* 2026-05-23 — Owner reported this was routing to /invitation
              (the monogram + widgets editor) instead of the Phase 0 date
              picker. Aligned with the AuspiciousChip target at the top of
              event home so both surfaces land on the same picker. See
              auspicious-chip.tsx line 50 for the canonical destination. */}
          <Link
            href={`/dashboard/${eventId}/date-selection`}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream"
          >
            Set your date
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </article>
    </section>
  );
}

function AllLockedVariant() {
  return (
    <section
      aria-labelledby="todays-one-thing-heading"
      className="space-y-3"
    >
      <header className="flex items-baseline gap-2">
        <Star
          aria-hidden
          className="h-3.5 w-3.5 text-terracotta"
          strokeWidth={1.75}
        />
        <h2
          id="todays-one-thing-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
        >
          Up next
        </h2>
      </header>

      <article className="flex flex-col gap-5 rounded-2xl border-2 border-emerald-300/50 bg-emerald-50/40 p-6 sm:p-8">
        <header className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-100/60 px-3 py-1">
            <Sparkles
              aria-hidden
              className="h-3.5 w-3.5 text-emerald-700"
              strokeWidth={2}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
              All locked
            </span>
          </div>
        </header>

        <div className="space-y-3">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            Every category is locked in.
          </h3>
          <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
            You’ve crossed the planning finish line — every vendor seat is
            held. From here on it’s confirmations, payments, and the final
            walkthrough. Your team is ready.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-800/80">
          <CheckCircle2
            aria-hidden
            className="h-4 w-4"
            strokeWidth={1.75}
          />
          <span>
            All 12 categories show at least one finalized vendor.
          </span>
        </div>
      </article>
    </section>
  );
}

// ---------- status palette + labels ----------

type Palette = {
  border: string;
  bg: string;
  pillBorder: string;
  pillBg: string;
  pillIcon: typeof AlertCircle;
  pillIconColor: string;
  pillTextColor: string;
};

const STATUS_PALETTE: Record<TodaysTaskStatus, Palette> = {
  overdue: {
    border: 'border-rose-300/60',
    bg: 'bg-rose-50/50',
    pillBorder: 'border-rose-400/60',
    pillBg: 'bg-rose-100/60',
    pillIcon: AlertCircle,
    pillIconColor: 'text-rose-700',
    pillTextColor: 'text-rose-800',
  },
  due_this_week: {
    border: 'border-amber-300/60',
    bg: 'bg-amber-50/50',
    pillBorder: 'border-amber-400/60',
    pillBg: 'bg-amber-100/60',
    pillIcon: Clock,
    pillIconColor: 'text-amber-700',
    pillTextColor: 'text-amber-800',
  },
  next_up: {
    border: 'border-terracotta/40',
    bg: 'bg-cream',
    pillBorder: 'border-terracotta/40',
    pillBg: 'bg-terracotta/5',
    pillIcon: Clock,
    pillIconColor: 'text-terracotta',
    pillTextColor: 'text-terracotta',
  },
  not_started: {
    border: 'border-ink/15',
    bg: 'bg-cream',
    pillBorder: 'border-ink/20',
    pillBg: 'bg-ink/5',
    pillIcon: Clock,
    pillIconColor: 'text-ink/55',
    pillTextColor: 'text-ink/70',
  },
};

/**
 * Pill label — composed from status + daysContextual so the host
 * reads "OVERDUE · 30 days past floor" instead of just "OVERDUE".
 * Defensive: omits the days suffix when daysContextual is null.
 */
function pillLabel(task: ResolvedTask): string {
  switch (task.status) {
    case 'overdue': {
      if (task.daysContextual === null) return 'Overdue';
      const days = task.daysContextual;
      return `Overdue · ${days} day${days === 1 ? '' : 's'} past floor`;
    }
    case 'due_this_week': {
      if (task.daysContextual === null) return 'Due this week';
      const days = task.daysContextual;
      if (days === 0) return 'Due today';
      return `Due in ${days} day${days === 1 ? '' : 's'}`;
    }
    case 'next_up': {
      if (task.daysContextual === null) return 'Next up';
      const days = task.daysContextual;
      return `Lock by · ${days} day${days === 1 ? '' : 's'}`;
    }
    case 'not_started':
      return 'Worth thinking about';
  }
}
