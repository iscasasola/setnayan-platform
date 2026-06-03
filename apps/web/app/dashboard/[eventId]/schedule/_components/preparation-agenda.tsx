import Link from 'next/link';
import {
  Wallet,
  FileText,
  Users,
  Flag,
  CalendarRange,
  ListPlus,
  type LucideIcon,
} from 'lucide-react';
import {
  PREPARATION_SOURCE_LABEL,
  type PreparationAgenda,
  type PreparationItem,
  type PreparationSource,
} from '@/lib/preparation';
import {
  AddPreparationItem,
  DeletePreparationItemButton,
} from './prep-item-controls';

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
 * Mostly read-only: the autofill rows (Payment / Paperwork / Meeting /
 * Milestone) are owned + edited on their own surface (Budget / Paperwork / a
 * vendor's page) and deep-link there. The HYBRID layer (2026-06-03) adds
 * manual rows the couple can add via the "+ Add to schedule" control and
 * delete inline — plus vendor-added rows (source 'manual', backed by
 * event_preparation_items). Manual rows carry an inline delete button; the
 * autofill rows stay read-only here.
 *
 * Clean Editorial tokens only (cream / ink / terracotta / mulberry / emerald
 * / blue / indigo accents) — consistent with the Home "Upcoming" surface.
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
      <div className="space-y-3">
        <div className="flex justify-end">
          <AddPreparationItem eventId={eventId} />
        </div>
        <PreparationLegend sourceCounts={agenda.sourceCounts} />
      </div>
      {agenda.groups.map((group) => (
        <section key={group.key} aria-labelledby={`prep-month-${group.key}`} className="space-y-3">
          <h2
            id={`prep-month-${group.key}`}
            className="sticky top-0 z-[1] -mx-1 bg-cream/85 px-1 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 backdrop-blur"
          >
            {group.label}
            <span className="ml-2 text-ink/35">
              {group.items.length} item{group.items.length === 1 ? '' : 's'}
            </span>
          </h2>
          <ul className="space-y-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <PreparationRow eventId={eventId} item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * The visual a row paints with. Autofill rows use their own `source`. A manual
 * row borrows an autofill visual based on its `kind`: a `meeting` item looks
 * like the Meeting source, a `payment` item like the Payment source, and a
 * `task` item keeps the plain "manual" look. This is purely presentational —
 * the row stays `source: 'manual'` for the delete-control / sourceLabel logic.
 */
function displaySourceFor(item: PreparationItem): PreparationSource {
  if (item.source === 'manual') {
    if (item.kind === 'meeting') return 'meeting';
    if (item.kind === 'payment') return 'payment';
  }
  return item.source;
}

/**
 * Chip label. Typed manual rows (meeting/payment) read like the autofill
 * ("Meeting" / "Payment") so the schedule speaks one vocabulary; their
 * "added by you / a vendor" context lives in the subtitle. Plain manual tasks
 * keep their per-row `sourceLabel` chip ("Added by you" / "From {vendor}").
 */
function chipLabelFor(item: PreparationItem, display: PreparationSource): string {
  if (item.source === 'manual' && (item.kind === 'meeting' || item.kind === 'payment')) {
    return PREPARATION_SOURCE_LABEL[display];
  }
  return item.sourceLabel ?? PREPARATION_SOURCE_LABEL[item.source];
}

function PreparationRow({ eventId, item }: { eventId: string; item: PreparationItem }) {
  const display = displaySourceFor(item);
  const Icon = iconFor(display);
  const chipLabel = chipLabelFor(item, display);
  const overdue = item.daysFromNow < 0;

  const body = (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${containerStylesFor(
        display,
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
          display,
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
          className={`max-w-[8.5rem] truncate rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${chipStylesFor(
            display,
          )}`}
          title={chipLabel}
        >
          {chipLabel}
        </span>
        {item.amountPhp !== undefined ? (
          <span className="font-mono text-xs text-ink/70">
            ₱{Math.round(item.amountPhp).toLocaleString('en-PH')}
          </span>
        ) : null}
        {item.isManual && item.itemId ? (
          <DeletePreparationItemButton
            eventId={eventId}
            itemId={item.itemId}
            label={item.title}
          />
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
  manual: 'items you or your vendors added',
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
          ? 'As you add vendor payment due dates, schedule vendor meetings, or start your paperwork, those dated steps will gather here automatically — sorted by month, all the way up to your wedding day. You can also add your own steps below.'
          : 'Set your wedding date first, then add vendor payment due dates and start your paperwork. Those dated steps will gather here automatically, sorted by month. You can also add your own steps below.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <AddPreparationItem eventId={eventId} />
        <Link
          href={`/dashboard/${eventId}/budget`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
        >
          Open budget
        </Link>
        <Link
          href={`/dashboard/${eventId}/paperwork`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta"
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
    case 'manual':
      return ListPlus;
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
    case 'manual':
      return 'bg-mulberry/10 text-mulberry';
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
    case 'manual':
      return 'border-mulberry/20 bg-mulberry/[0.04]';
    default:
      return 'border-ink/10 bg-cream';
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
    case 'manual':
      return 'bg-mulberry/10 text-mulberry';
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
