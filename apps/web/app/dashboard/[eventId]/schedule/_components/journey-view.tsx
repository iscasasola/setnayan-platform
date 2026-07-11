import Link from 'next/link';
import {
  Sparkles,
  CalendarHeart,
  BookHeart,
  Wallet,
  FileText,
  Users,
  Flag,
  ListPlus,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import type { PreparationSource } from '@/lib/preparation';
import type {
  JourneyTimeline,
  JourneyPhase,
  JourneyEntry,
  JourneyMilestone,
} from '@/lib/journey';

/**
 * JourneyView — read-only render of the "Journey" mode on /schedule
 * (event-lifecycle arc, 2026-07-11).
 *
 * Pure presentational server component. Receives the already-built,
 * phase-grouped timeline from lib/journey.ts and renders it as the couple's
 * historical arc: an at-a-glance progress rail (kickoff → the day → the story)
 * followed by the phases, each a vertical timeline of milestones + the dated
 * steps that fall inside it.
 *
 * The three lifecycle bookends (You started planning · The day · Your story)
 * render as larger accented nodes. The ordinary rows reuse the SAME icon/tone
 * vocabulary the Preparation mode speaks (Payment / Paperwork / Meeting /
 * Milestone / Added) so the two schedule modes feel like one surface.
 *
 * Clean Editorial tokens only (cream / ink / terracotta / mulberry / emerald /
 * blue / indigo accents).
 */

export function JourneyView({
  timeline,
  hasEventDate,
  eventId,
}: {
  timeline: JourneyTimeline;
  hasEventDate: boolean;
  eventId: string;
}) {
  if (timeline.totalEntries === 0) {
    return <JourneyEmptyState eventId={eventId} hasEventDate={hasEventDate} />;
  }

  return (
    <div className="space-y-8">
      <JourneyArc timeline={timeline} />
      {timeline.phases.map((phase) => (
        <PhaseSection key={phase.id} phase={phase} />
      ))}
    </div>
  );
}

// ── The progress arc header ────────────────────────────────────────────────

function JourneyArc({ timeline }: { timeline: JourneyTimeline }) {
  const pct = Math.round(timeline.progressPct * 100);
  const nodes: { key: string; label: string; date: Date | null; dim?: boolean }[] = [
    { key: 'start', label: 'Started', date: timeline.createdDate },
    { key: 'day', label: 'The day', date: timeline.eventDate },
    {
      key: 'story',
      label: 'Your story',
      date: timeline.editorialDate,
      dim: timeline.editorialDate === null,
    },
  ];

  return (
    <section className="rounded-2xl border border-mulberry/15 bg-mulberry/[0.03] p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mulberry">
          Your journey
        </p>
        <p className="font-mono text-[11px] text-ink/45">{pct}% of the way</p>
      </div>

      {/* Rail */}
      <div className="relative mx-1 h-1.5 rounded-full bg-ink/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-mulberry/70"
          style={{ width: `${pct}%` }}
        />
        {/* "today" marker */}
        <span
          aria-hidden
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mulberry bg-cream"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Node labels */}
      <div className="mt-3 flex items-start justify-between">
        {nodes.map((n) => (
          <div
            key={n.key}
            className={`flex flex-col ${
              n.key === 'start'
                ? 'items-start text-left'
                : n.key === 'story'
                  ? 'items-end text-right'
                  : 'items-center text-center'
            }`}
          >
            <span
              className={`text-xs font-medium ${n.dim ? 'text-ink/40' : 'text-ink/75'}`}
            >
              {n.label}
            </span>
            <span className="font-mono text-[10px] text-ink/45">
              {n.date ? monthDayYear(n.date) : n.dim ? 'to come' : '—'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── One phase ──────────────────────────────────────────────────────────────

function PhaseSection({ phase }: { phase: JourneyPhase }) {
  return (
    <section aria-labelledby={`journey-phase-${phase.id}`} className="space-y-3">
      <header className="space-y-0.5">
        <h2
          id={`journey-phase-${phase.id}`}
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {phase.label}
          <span className="ml-2 text-ink/35">
            {phase.entries.length} step{phase.entries.length === 1 ? '' : 's'}
          </span>
        </h2>
        <p className="text-xs text-ink/50">{phase.caption}</p>
      </header>

      {/* Vertical timeline: a rail down the left, a node per entry. */}
      <ol className="relative ml-1 space-y-2 border-l border-ink/10 pl-5">
        {phase.entries.map((entry) => (
          <li key={entry.id} className="relative">
            <TimelineNode entry={entry} />
            <JourneyRow entry={entry} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The little dot on the rail, left of each row. Milestones get a ring. */
function TimelineNode({ entry }: { entry: JourneyEntry }) {
  if (entry.milestone) {
    return (
      <span
        aria-hidden
        className={`absolute -left-[27px] top-3 h-3.5 w-3.5 rounded-full border-2 ${
          entry.pending
            ? 'border-ink/25 bg-cream'
            : 'border-mulberry bg-mulberry/30'
        }`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`absolute -left-[22px] top-[18px] h-2 w-2 rounded-full ${
        entry.past ? 'bg-ink/25' : 'bg-terracotta/60'
      }`}
    />
  );
}

function JourneyRow({ entry }: { entry: JourneyEntry }) {
  const isMilestone = Boolean(entry.milestone);
  const Icon = isMilestone
    ? milestoneIcon(entry.milestone as JourneyMilestone)
    : iconFor(displaySourceFor(entry));

  const body = (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${
        isMilestone
          ? entry.pending
            ? 'border-ink/15 border-dashed bg-cream'
            : 'border-mulberry/25 bg-mulberry/[0.05]'
          : containerStylesFor(displaySourceFor(entry))
      } ${entry.pending ? 'opacity-80' : ''}`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          {monthDay(entry.date)}
        </span>
        {/* Only surface the year when it differs from the current year — a
            same-year arc doesn't need "2026" stamped on every row (the arc
            header already anchors it); a cross-year engagement still reads. */}
        {entry.date.getFullYear() !== new Date().getFullYear() ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/40">
            {yearOf(entry.date)}
          </span>
        ) : null}
      </div>
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-lg ${
          isMilestone ? 'h-10 w-10 bg-mulberry/10 text-mulberry' : `h-9 w-9 ${iconStylesFor(displaySourceFor(entry))}`
        }`}
      >
        <Icon className={isMilestone ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate ${isMilestone ? 'text-sm font-semibold text-ink' : 'text-sm font-medium text-ink'}`}
        >
          {entry.title}
        </p>
        <p className="truncate text-xs text-ink/55">{entry.subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.14em] ${
            entry.pending
              ? 'text-ink/40'
              : entry.past
                ? 'text-ink/40'
                : 'text-terracotta'
          }`}
        >
          {relativeTag(entry)}
        </span>
        {entry.amountPhp !== undefined ? (
          <span className="font-mono text-xs text-ink/70">
            ₱{Math.round(entry.amountPhp).toLocaleString('en-PH')}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (entry.href) {
    return (
      <Link href={entry.href} className="block transition hover:opacity-95">
        {body}
      </Link>
    );
  }
  return body;
}

// ── empty state ─────────────────────────────────────────────────────────────

function JourneyEmptyState({
  eventId,
  hasEventDate,
}: {
  eventId: string;
  hasEventDate: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <BookHeart aria-hidden className="mx-auto mb-2 h-6 w-6 text-mulberry/40" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">Your journey starts here.</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
        {hasEventDate
          ? 'As you plan — booking vendors, scheduling meetings, working through paperwork — every dated step lands on this timeline. It runs from the day you started, through the big day, all the way to the editorial you publish afterward.'
          : 'Set your date first. Then, as you plan, every dated step gathers here into one continuous story — from the day you started, through the big day, to the editorial you publish afterward.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={`/dashboard/${eventId}/vendors`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-mulberry/50 hover:text-mulberry"
        >
          Find vendors
        </Link>
        <Link
          href={`/dashboard/${eventId}/schedule?view=preparation`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-mulberry/50 hover:text-mulberry"
        >
          Open preparation
        </Link>
      </div>
    </div>
  );
}

// ── presentation maps ────────────────────────────────────────────────────

function milestoneIcon(milestone: JourneyMilestone): LucideIcon {
  switch (milestone) {
    case 'created':
      return Sparkles;
    case 'the_day':
      return CalendarHeart;
    case 'editorial':
      return BookHeart;
    default:
      return Sparkles;
  }
}

/** Manual/typed rows borrow an autofill visual by kind — same rule as the
 *  Preparation agenda so the two modes stay visually consistent. */
function displaySourceFor(entry: JourneyEntry): PreparationSource {
  if (entry.prepSource === 'manual') {
    if (entry.prepKind === 'meeting') return 'meeting';
    if (entry.prepKind === 'payment') return 'payment';
  }
  return entry.prepSource ?? 'manual';
}

function iconFor(source: PreparationSource): LucideIcon {
  switch (source) {
    case 'payment':
      return Wallet;
    case 'paperwork':
      return FileText;
    case 'meeting':
      return Users;
    case 'milestone':
      return Flag;
    case 'manual':
      return ListPlus;
    default:
      return CalendarRange;
  }
}

function iconStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'bg-warn-100 text-warn-700';
    case 'paperwork':
      return 'bg-blue-50 text-blue-700';
    case 'meeting':
      return 'bg-indigo-50 text-indigo-700';
    case 'manual':
    case 'milestone':
    default:
      return 'bg-mulberry/10 text-mulberry';
  }
}

function containerStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'border-warn-200/70 bg-warn-50/40';
    case 'paperwork':
      return 'border-blue-200/70 bg-blue-50/30';
    case 'manual':
      return 'border-mulberry/20 bg-mulberry/[0.04]';
    default:
      return 'border-ink/10 bg-cream';
  }
}

function monthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    .format(date)
    .toUpperCase();
}

function monthDayYear(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function yearOf(date: Date): string {
  return String(date.getFullYear());
}

function relativeTag(entry: JourneyEntry): string {
  if (entry.pending) return 'to come';
  const d = entry.daysFromNow;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d < 0) {
    const ago = Math.abs(d);
    if (ago < 30) return `${ago}d ago`;
    if (ago < 365) return `${Math.round(ago / 7)}w ago`;
    return `${Math.round(ago / 365)}y ago`;
  }
  if (d < 30) return `in ${d}d`;
  if (d < 365) return `in ${Math.round(d / 7)}w`;
  return `in ${Math.round(d / 30)}mo`;
}
