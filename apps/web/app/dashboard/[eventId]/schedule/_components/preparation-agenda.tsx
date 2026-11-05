import Link from 'next/link';
import {
  Wallet,
  FileText,
  Users,
  Flag,
  CalendarRange,
  ListPlus,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import {
  PREPARATION_SOURCE_LABEL,
  isTodoItem,
  planningProgress,
  planningRowId,
  type PreparationAgenda,
  type PreparationItem,
  type PreparationSource,
} from '@/lib/preparation';
import { checklistTaskAnchor } from '@/lib/checklist-anchor';
import {
  AddPreparationItem,
  PrepItemSwipe,
  PlanningFilterFrame,
  PlanningTick,
  TaskDateButton,
} from './schedule-lazy';
import { formatCount } from '@/lib/format-number';

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
 * event_preparation_items). Manual rows delete by their swipe (with Undo); the
 * autofill rows stay read-only here.
 *
 * Clean Editorial tokens only (cream / ink / terracotta / mulberry / emerald
 * / blue / indigo accents) — consistent with the Home "Upcoming" surface.
 */

export function PreparationAgendaView({
  eventId,
  agenda,
  hasEventDate,
  eventWord = 'wedding',
  line = false,
  eventDateIso = null,
  initialFilter = 'all',
  eventIsOver = false,
}: {
  eventId: string;
  agenda: PreparationAgenda;
  hasEventDate: boolean;
  /** The locked event day — a before-the-day task's date stops there (plan §3). */
  eventDateIso?: string | null;
  /**
   * ✅ `todo` — open on the To do filter (the old /checklist address forwards here with `filter=todo`; owner
   * 2026-11-01, "Checklist merges into Planning Stage").
   */
  initialFilter?: 'all' | 'todo';
  /** The celebration already happened — a date is just a date: no "overdue", no alarm red. */
  eventIsOver?: boolean;
  /**
   * 📅 Drawn under the Schedule page's one line (owner 2026-10-31: *"so many upper space not used"*): the
   * steps start at once — "+ Add a step" is the pill in the thumb zone and what feeds the agenda is said in the page's
   * ⓘ (`preparationLegendWords`), not in a tinted band above the rows.
   */
  line?: boolean;
  /** eventNoun(event_type) — a birthday is not told to set its "wedding date". */
  eventWord?: 'wedding' | 'event';
}) {
  const unread = agenda.unread ?? [];
  if (agenda.items.length === 0 && unread.length === 0) {
    return (
      <PreparationEmptyState eventId={eventId} hasEventDate={hasEventDate} eventWord={eventWord} />
    );
  }
  // 🔢 The filter's figures are the SAME count Home's To do tile reads (`planningProgress`) — one rule, one list.
  const progress = planningProgress(agenda.items);

  return (
    <div className="space-y-7" data-prep-agenda={line ? 'line' : 'page'}>
      {unread.length > 0 ? (
        /* 🛑 A refused read says so — never an empty "nothing to do" (house rule). */
        <p role="alert" data-planning-unread={unread.join(' ')} className="rounded-xl bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          We couldn’t load{' '}
          {unread.includes('task') ? 'your to-do tasks' : unread.includes('manual') ? 'the steps you added' : 'your payment steps'}. They’re safe — pull to
          refresh or try again in a moment.
        </p>
      ) : null}
      {line ? (
        <AddPreparationItem eventId={eventId} door="pill" />
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <AddPreparationItem eventId={eventId} />
          </div>
          <PreparationLegend sourceCounts={agenda.sourceCounts} />
        </div>
      )}
      <PlanningFilterFrame
        initial={initialFilter}
        allCount={agenda.items.length}
        todoCount={progress.total}
        todoOpen={progress.open}
      >
      {agenda.groups.map((group) => {
        const todoHere = group.items.filter(isTodoItem).length;
        return (
        <section
          key={group.key}
          aria-labelledby={`prep-month-${group.key}`}
          data-plan-group-todo={todoHere}
          className={`space-y-3 ${todoHere === 0 ? 'group-data-[plan-filter=todo]/plan:hidden' : ''}`}
        >
          <h2
            id={`prep-month-${group.key}`}
            className="sticky top-0 z-[1] -mx-1 bg-cream/85 px-1 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 backdrop-blur"
          >
            {group.label}
            <span className="ml-2 text-ink/35 group-data-[plan-filter=todo]/plan:hidden">
              {formatCount(group.items.length)} item{group.items.length === 1 ? '' : 's'}
            </span>
            <span className="ml-2 hidden text-ink/35 group-data-[plan-filter=todo]/plan:inline">
              {formatCount(todoHere)} to do
            </span>
          </h2>
          <ul className="space-y-2">
            {group.items.map((item) => {
              const rowId = isTodoItem(item) ? planningRowId(item) : null;
              return (
              <li
                key={item.id}
                // 🔗 Home's To do tile opens THIS row (`#task-<id>`, `planningTodoHref`).
                id={rowId ? checklistTaskAnchor(rowId) : undefined}
                data-plan-row={item.source}
                data-plan-todo={isTodoItem(item) ? (item.done ? 'done' : 'open') : undefined}
                className={`scroll-mt-24 has-[[data-swipe-gone]]:hidden ${isTodoItem(item) ? '' : 'group-data-[plan-filter=todo]/plan:hidden'}`}
                // 💾 A payment due is money — never kept as last-seen data (lib/last-seen).
                data-money={displaySourceFor(item) === 'payment' || item.amountPhp !== undefined ? '' : undefined}
              >
                <PreparationRow eventId={eventId} item={item} eventDateIso={eventDateIso} eventIsOver={eventIsOver} />
              </li>
              );
            })}
          </ul>
        </section>
        );
      })}
      </PlanningFilterFrame>
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

function PreparationRow({
  eventId,
  item,
  eventDateIso,
  eventIsOver,
}: {
  eventId: string;
  item: PreparationItem;
  eventDateIso: string | null;
  eventIsOver: boolean;
}) {
  const display = displaySourceFor(item);
  const Icon = iconFor(display);
  const chipLabel = chipLabelFor(item, display);
  const done = item.done === true;
  // AFTER THE DAY, A DEADLINE IS JUST A DATE (the Checklist page's rule, kept): nothing on a finished celebration is
  // "overdue" — the date stays, the alarm goes.
  const overdue = !eventIsOver && !done && item.daysFromNow !== null && item.daysFromNow < 0;
  const tickId = item.source === 'task' ? item.taskItemId : item.source === 'manual' ? item.itemId : undefined;

  const dateColumn = (
    <>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {item.date ? monthDay(item.date) : 'No date'}
      </span>
      <span
        className={`mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${
          done || eventIsOver ? 'text-ink/40' : overdue ? 'text-danger-600' : 'text-terracotta'
        }`}
      >
        {done ? 'Done' : item.daysFromNow === null ? 'Set one' : eventIsOver ? '' : relativeTag(item.daysFromNow)}
      </span>
    </>
  );

  const text = (
    <div className="min-w-0 flex-1">
      <p className={`truncate text-sm font-medium ${done ? 'text-ink/45 line-through' : 'text-ink'}`}>{item.title}</p>
      <p className="truncate text-xs text-ink/55">{item.subtitle}</p>
    </div>
  );

  const row = (
    <div
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2 ${containerStylesFor(display)} ${
        done ? 'opacity-75' : ''
      }`}
    >
      {tickId ? (
        <PlanningTick eventId={eventId} kind={item.source === 'task' ? 'task' : 'manual'} id={tickId} done={done} title={item.title} />
      ) : null}
      {item.source === 'task' && item.taskItemId ? (
        <TaskDateButton
          eventId={eventId}
          itemId={item.taskItemId}
          title={item.title}
          dateIso={item.dateIso ?? null}
          planDateIso={item.planDateIso ?? null}
          dateSet={item.dateSet === true}
          eventDateIso={eventDateIso}
          afterDay={item.afterDay === true}
        >
          {dateColumn}
        </TaskDateButton>
      ) : (
        <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">{dateColumn}</div>
      )}
      {tickId ? null : (
        <span
          aria-hidden
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStylesFor(display)}`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      )}
      {item.href ? (
        <Link href={item.href} className="flex min-h-11 min-w-0 flex-1 items-center transition hover:opacity-90">
          {text}
        </Link>
      ) : (
        <div className="flex min-h-11 min-w-0 flex-1 items-center">{text}</div>
      )}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {/* A task's second line already names its area — no chip repeating it, so the title keeps the width (390). */}
        {item.source === 'task' ? null : (
        <span
          className={`max-w-[7rem] truncate rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${chipStylesFor(
            display,
          )}`}
          title={chipLabel}
        >
          {chipLabel}
        </span>
        )}
        {item.amountPhp !== undefined ? (
          <span className="font-mono text-xs text-ink/70">
            ₱{Math.round(item.amountPhp).toLocaleString('en-PH')}
          </span>
        ) : null}
      </div>
    </div>
  );
  // 👈 A hand-added / supplier-added step deletes by its swipe (owner 2026-11-03) — no trash on the row.
  if (!(item.isManual && item.itemId)) return row;
  return (
    <PrepItemSwipe eventId={eventId} itemId={item.itemId} label={item.title}>
      {row}
    </PrepItemSwipe>
  );
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

/** What feeds the agenda, in a sentence — the legend's words, for the page's ⓘ under Booked (owner 2026-10-31). */
export function preparationLegendWords(sourceCounts: Record<PreparationSource, number>): string {
  const present = (Object.keys(sourceCounts) as PreparationSource[]).filter((s) => sourceCounts[s] > 0).map((s) => SOURCE_PLAIN_LABEL[s]);
  if (present.length === 0) return 'Dated steps gather here from your supplier payments, meetings and paperwork.';
  const list = present.length === 1 ? present[0] : `${present.slice(0, -1).join(', ')} and ${present[present.length - 1]}`;
  return `This agenda fills in automatically from your ${list}. Update any item on its own page — tap a row to jump there.`;
}

const SOURCE_PLAIN_LABEL: Record<PreparationSource, string> = {
  task: 'to-do tasks',
  payment: 'supplier payment due dates',
  paperwork: 'paperwork deadlines',
  meeting: 'supplier meetings',
  milestone: 'planning milestones',
  manual: 'items you or your suppliers added',
};

function PreparationEmptyState({
  eventId,
  hasEventDate,
  eventWord,
}: {
  eventId: string;
  hasEventDate: boolean;
  eventWord: 'wedding' | 'event';
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center">
      <CalendarRange aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">Nothing to prepare yet.</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink/60">
        {hasEventDate
          ? `As you add supplier payment due dates, schedule supplier meetings, or start your paperwork, those dated steps will gather here automatically — sorted by month, all the way up to your ${eventWord} day. You can also add your own steps below.`
          : `Set your ${eventWord} date first, then add supplier payment due dates and start your paperwork. Those dated steps will gather here automatically, sorted by month. You can also add your own steps below.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <AddPreparationItem eventId={eventId} />
        <Link
          href={`/dashboard/${eventId}/budget`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta-700"
        >
          Open budget
        </Link>
        <Link
          href={`/dashboard/${eventId}/paperwork`}
          className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink hover:border-terracotta/50 hover:text-terracotta-700"
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
    case 'task':
      return ListChecks;
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
      return 'bg-mulberry/10 text-mulberry';
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

function chipStylesFor(source: PreparationSource): string {
  switch (source) {
    case 'payment':
      return 'bg-warn-100 text-warn-800';
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
