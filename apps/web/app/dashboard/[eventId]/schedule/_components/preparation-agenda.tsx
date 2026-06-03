import Link from 'next/link';
import {
  Wallet,
  FileText,
  Users,
  Flag,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react';
import {
  PREPARATION_SOURCE_LABEL,
  type PreparationAgenda,
  type PreparationItem,
  type PreparationSource,
} from '@/lib/preparation';

/**
 * PreparationAgendaView — read-only render of the Preparation mode on
 * /schedule (chrome redesign delta #3, 2026-06-03).
 *
 * Pure presentational server component. Receives the already-aggregated,
 * month-grouped agenda from lib/preparation.ts (data sources documented
 * there) and renders it as a date-sorted list grouped by month. Each row:
 * date · label · a source chip (Payment / Paperwork / Meeting / Milestone)
 * · optional amount. Overdue rows (negative daysFromNow) get a quiet
 * "overdue" relative tag in terracotta so a couple sees what slipped.
 *
 * READ-ONLY by design: every dated item is owned + edited on its own
 * surface (Budget / Paperwork / a vendor's page). Rows deep-link there.
 * Manual user-added agenda items are intentionally NOT here — that needs a
 * new table and is a documented fast-follow.
 *
 * Clean Editorial tokens only (cream / ink / terracotta / emerald / blue /
 * indigo accents) — consistent with the Home "Upcoming" surface.
 */

export function PreparationAgendaView({
  eventId,
  agenda,
  hasEventDate,
}: {
  eventId: string;
  agenda: PreparationAgenda;
  hasEventDate: boolean;
}) {
  if (agenda.items.length === 0) {
    return <PreparationEmptyState eventId={eventId} hasEventDate={hasEventDate} />;
  }

  return (
    <div className="space-y-7">
      <PreparationLegend sourceCounts={agenda.sourceCounts} />
      {agenda.groups.map((group) => (
        <section key={group.key} aria-labelledby={`prep-month-${group.key}`} className="space-y-3">
          <h2
            id={`prep-month-${group.key}`}
            className="sticky top-0 z-[1] -mx-1 bg-paper/85 px-1 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 backdrop-blur"
          >
            {group.label}
            <span className="ml-2 text-ink/35">
              {group.items.length} item{group.items.length === 1 ? '' : 's'}
            </span>
          </h2>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <PreparationRow item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PreparationRow({ item }: { item: PreparationItem }) {
  const Icon = iconFor(item.source);
  const overdue = item.daysFromNow < 0;

  const body = (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${containerStylesFor(
        item.source,
      )}`}
    >
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          {monthDay(item.date)}
        </span>
        <span
          className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${
            overdue ? 'text-rose-600' : 'text-terracotta'
          }`}
        >
          {relativeTag(item.daysFromNow)}
        </span>
      </div>
      <span
        aria-hidden
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStylesFor(
          item.source,
        )}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        </div>
        <p className="truncate text-xs text-ink/55">{item.subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${chipStylesFor(
            item.source,
          )}`}
        >
          {PREPARATION_SOURCE_LABEL[item.source]}
        </span>
        {item.amountPhp !== undefined ? (
          <span className="font-mono text-xs text-ink/70">
            ₱{Math.round(item.amountPhp).toLocaleString('en-PH')}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block transition hover:opacity-95">
        {body}
      </Link>
    );
  }
  return body;
}

/**
 * Small legend strip so the couple understands what feeds the agenda
 * (and, implicitly, that it auto-fills — they don't add rows by hand).
 * Only shows sources that actually have items.
 */
function PreparationLegend({
  sourceCounts,
}: {
  sourceCounts: Record<PreparationSource, number>;
}) {
  const present = (Object.keys(sourceCounts) as PreparationSource[]).filter(
    (s) => sourceCounts[s] > 0,
  );
  return (
    <section className="rounded-xl border border-terracotta/20 bg-terracotta/[0.04] p-3 sm:p-4">
      <p className="text-xs text-ink/70">
        This agenda fills in automatically from your{' '}
        {present.map((s, i) => (
          <span key={s}>
            {i > 0 ? (i === present.length - 1 ? ' and ' : ', ') : ''}
            <span className="font-medium text-ink">
              {SOURCE_PLAIN_LABEL[s]}
            </span>
          </span>
        ))}
        . Update any item on its own page — tap a row to jump there.
      </p>
    </section>
  );
}

const SOURCE_PLAIN_LABEL: Record<PreparationSource, string> = {
  payment: 'vendor payment due dates',
  paperwork: 'paperwork deadlines',
  meeting: 'vendor meetings',
  milestone: 'planning milestones',
};

function PreparationEmptyState({
  eventId,
  hasEventDate,
}: {
  eventId: string;
  hasEventDate: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <CalendarRange aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">Nothing to prepare yet.</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
        {hasEventDate
          ? 'As you add vendor payment due dates, schedule vendor meetings, or start your paperwork, those dated steps will gather here automatically — sorted by month, all the way up to your wedding day.'
          : 'Set your wedding date first, then add vendor payment due dates and start your paperwork. Those dated steps will gather here automatically, sorted by month.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          href={`/dashboard/${eventId}/budget`}
          className="rounded-md border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
        >
          Open budget
        </Link>
        <Link
          href={`/dashboard/${eventId}/paperwork`}
          className="rounded-md border border-ink/15 bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
        >
          Open paperwork
        </Link>
      </div>
    </div>
  );
}

// ── presentation maps ──────────────────────────────────────────────────

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
    default:
      return CalendarRange;
  }
}

function iconStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'bg-amber-100 text-amber-700';
    case 'paperwork':
      return 'bg-blue-50 text-blue-700';
    case 'meeting':
      return 'bg-indigo-50 text-indigo-700';
    case 'milestone':
    default:
      return 'bg-mulberry/10 text-mulberry';
  }
}

function containerStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'border-amber-200/70 bg-amber-50/40';
    case 'paperwork':
      return 'border-blue-200/70 bg-blue-50/30';
    default:
      return 'border-ink/10 bg-paper';
  }
}

function chipStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'bg-amber-100 text-amber-800';
    case 'paperwork':
      return 'bg-blue-100 text-blue-800';
    case 'meeting':
      return 'bg-indigo-100 text-indigo-800';
    case 'milestone':
    default:
      return 'bg-mulberry/10 text-mulberry';
  }
}

function monthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    .format(date)
    .toUpperCase();
}

function relativeTag(daysFromNow: number): string {
  if (daysFromNow === 0) return 'Today';
  if (daysFromNow === 1) return 'Tomorrow';
  if (daysFromNow === -1) return '1d overdue';
  if (daysFromNow < 0) return `${Math.abs(daysFromNow)}d overdue`;
  if (daysFromNow < 30) return `in ${daysFromNow}d`;
  return `in ${Math.round(daysFromNow / 7)}w`;
}
