import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  FLAG_STATUSES,
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  FLAG_TYPE_LABEL,
  formatAutoResolveCountdown,
  sweepEscalateStaleFlags,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { MiniTour } from '@/app/_components/mini-tour';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Force Majeure · Admin' };

/** One number: the query reads it and ConsoleTable discloses it. Never two copies. */
const ROW_LIMIT = 200;

type FlagRow = {
  flag_id: string;
  public_id: string;
  event_id: string;
  flag_type: FlagType;
  status: FlagStatus;
  description: string;
  evidence_urls: string[] | null;
  admin_handler_user_id: string | null;
  auto_resolve_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

type EventLookup = {
  event_id: string;
  display_name: string;
  public_id: string;
};

type AdminLookup = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type FilterValue = 'all' | 'open_set' | FlagStatus;

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: 'open_set', label: 'Active (open + under review)' },
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under review' },
  { value: 'refund_issued', label: 'Refund issued' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'partial_credit', label: 'Partial credit' },
  { value: 'mediation', label: 'Mediation' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminForceMajeurePage({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const filterRaw = search.filter ?? 'open_set';
  const filter: FilterValue =
    filterRaw === 'all' ||
    filterRaw === 'open_set' ||
    (FLAG_STATUSES as readonly string[]).includes(filterRaw)
      ? (filterRaw as FilterValue)
      : 'open_set';

  const admin = createAdminClient();

  // Per the no-cron lock (PR #47, 2026-05-14): every admin pageview sweeps
  // stale `open` / `under_review` flags past their 7-day auto-resolve
  // window. Idempotent + best-effort; failures never block render.
  await sweepEscalateStaleFlags(admin);

  let query = admin
    .from('force_majeure_flags')
    .select(
      'flag_id, public_id, event_id, flag_type, status, description, evidence_urls, admin_handler_user_id, auto_resolve_at, resolved_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  if (filter === 'open_set') {
    // Include `escalated` — a stale flag the sweep advanced for attention must
    // stay in the default triage queue, never disappear (gap audit B2).
    query = query.in('status', ['open', 'under_review', 'escalated']);
  } else if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;
  if (error) {
    logQueryError('AdminForceMajeurePage (force_majeure_flags)', error);
  }
  // NULL is "not measured". `?? []` is what let the empty state contradict the
  // error alert three inches above it.
  const flags = data as FlagRow[] | null;

  // Side queries — fetch related events + handlers once so the row map is O(1).
  const listed = flags ?? [];
  const eventIds = Array.from(new Set(listed.map((f) => f.event_id)));
  const handlerIds = Array.from(
    new Set(
      listed
        .map((f) => f.admin_handler_user_id)
        .filter((v): v is string => typeof v === 'string'),
    ),
  );

  const [eventsRes, handlersRes] = await Promise.all([
    eventIds.length > 0
      ? admin
          .from('events')
          .select('event_id, display_name, public_id')
          .in('event_id', eventIds)
      : Promise.resolve({ data: [] as EventLookup[], error: null }),
    handlerIds.length > 0
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .in('user_id', handlerIds)
      : Promise.resolve({ data: [] as AdminLookup[], error: null }),
  ]);

  // Same rule as the primary read: these carry the event NAME and the HANDLER's
  // name. Refused, every row reads "—" for both, which looks like unassigned work
  // on an unnamed wedding rather than a failed lookup. Neither changes the row
  // count, so ConsoleTable cannot see it — the page has to say it.
  const eventsError = 'error' in eventsRes ? eventsRes.error : null;
  const handlersError = 'error' in handlersRes ? handlersRes.error : null;
  if (eventsError) logQueryError('AdminForceMajeurePage.events', eventsError);
  if (handlersError) logQueryError('AdminForceMajeurePage.handlers', handlersError);

  const eventsById = new Map<string, EventLookup>(
    ((eventsRes.data ?? []) as EventLookup[]).map((e) => [e.event_id, e]),
  );
  const handlersById = new Map<string, AdminLookup>(
    ((handlersRes.data ?? []) as AdminLookup[]).map((u) => [u.user_id, u]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      {/* The page starts at its content; the decorative tile goes with the
          name.
          ⚖ The sentence survives: there is a 7-DAY AUTO-RESOLUTION TIMER on
          this queue. A judgement desk where not deciding is itself a decision
          has to say so on the screen. */}
      <PageMasthead title="Force majeure" />
      <p className="mb-6 text-sm text-ink/70">
        Inbound flags from <code className="text-xs">/dashboard/&lt;event&gt;/disputes</code>.
        7-day auto-resolution timer; review and route to one of 6 resolutions.
      </p>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <label
          htmlFor="filter"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Filter
        </label>
        <select
          id="filter"
          name="filter"
          defaultValue={filter}
          className="input-field h-9 max-w-[18rem] py-0 text-sm"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
      </form>

      {/* FAILS TOWARD THE CAVEAT — a row missing its labels must not read as a
          row with nothing assigned. Distinct from the empty/error states below. */}
      {eventsError || handlersError ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">Some names could not be read.</strong>{' '}
          {eventsError ? 'Event names are missing, so rows show a dash. ' : ''}
          {handlersError
            ? 'Handler names are missing, so a routed flag may look unassigned. '
            : ''}
          The flags themselves, their statuses and their timers are accurate.
        </p>
      ) : null}

      {/* ⚠ THIS PAGE USED TO SAY TWO CONTRADICTORY THINGS AT ONCE. It rendered an
          error alert AND, immediately below it, "Nothing in this view." — because
          `flags` had been coerced from null to []. Better than the pages that only
          said the second thing, and still wrong: a coordinator reads the nearest
          sentence, and the nearest sentence asserted there were no flags. One
          state now, decided by ConsoleTable, never both. */}
      <ConsoleTable
        rows={flags}
        readPermitted
        readError={error}
        reads="the force majeure flags"
        cap={ROW_LIMIT}
        label="Force majeure flags"
        minWidth="52rem"
        note="A flag left alone auto-resolves on its 7-day timer, so an unread queue still moves. Open a flag to route it; there is nothing to press on the list itself."
        rowKey={(f) => f.flag_id}
        empty={{
          Icon: AlertTriangle,
          title: filter === 'all' ? 'No flags have ever been raised' : 'Nothing in this view',
          blurb:
            'Couples raise these from their own disputes screen. Nothing here means nobody has reported a washed-out road, a closed venue or a supplier who could not travel — change the filter if you are looking for ones already resolved.',
        }}
        columns={[
          {
            header: 'Flag',
            cell: (f) => (
              <Link
                href={`/admin/force-majeure/${f.flag_id}`}
                className="font-mono text-[11px] uppercase tracking-[0.15em] text-link hover:underline"
              >
                {f.public_id}
              </Link>
            ),
          },
          {
            header: 'Event',
            cell: (f) => {
              const ev = eventsById.get(f.event_id);
              return (
                <>
                  <p className="font-medium text-ink">{ev?.display_name ?? '—'}</p>
                  <p className="font-mono text-[10px] text-ink/70">{ev?.public_id ?? ''}</p>
                </>
              );
            },
          },
          {
            header: 'Type',
            cell: (f) => <span className="text-ink/75">{FLAG_TYPE_LABEL[f.flag_type]}</span>,
          },
          {
            header: 'Status',
            cell: (f) => (
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${FLAG_STATUS_TONE[f.status]}`}
              >
                {FLAG_STATUS_LABEL[f.status]}
              </span>
            ),
          },
          {
            header: 'Handler',
            hideBelow: 'md',
            cell: (f) => {
              const handler = f.admin_handler_user_id
                ? handlersById.get(f.admin_handler_user_id)
                : null;
              return (
                <span className="text-xs text-ink/70">
                  {handler?.display_name ?? handler?.email ?? (
                    <span className="text-ink/70">unassigned</span>
                  )}
                </span>
              );
            },
          },
          {
            header: 'Created',
            hideBelow: 'md',
            mono: true,
            cell: (f) => <span className="text-ink/70">{f.created_at.slice(0, 10)}</span>,
          },
          {
            header: 'SLA',
            align: 'right',
            cell: (f) => (
              <span className="whitespace-nowrap text-xs text-ink/70">
                {(f.resolved_at
                  ? `Resolved ${f.resolved_at.slice(0, 10)}`
                  : formatAutoResolveCountdown(f.auto_resolve_at)) ?? '—'}
              </span>
            ),
          },
        ]}
      />
      <MiniTour tourKey="admin_force_majeure_v1" />
    </div>
  );
}
