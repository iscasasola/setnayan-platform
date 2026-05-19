import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  FLAG_STATUSES,
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  FLAG_TYPE_LABEL,
  formatAutoResolveCountdown,
  sweepAutoResolveStaleFlags,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { MiniTour } from '@/app/_components/mini-tour';

export const metadata = { title: 'Force Majeure · Admin' };

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
  await sweepAutoResolveStaleFlags(admin);

  let query = admin
    .from('force_majeure_flags')
    .select(
      'flag_id, public_id, event_id, flag_type, status, description, evidence_urls, admin_handler_user_id, auto_resolve_at, resolved_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'open_set') {
    query = query.in('status', ['open', 'under_review']);
  } else if (filter !== 'all') {
    query = query.eq('status', filter);
  }

  const { data, error } = await query;
  const flags = (data ?? []) as FlagRow[];

  // Side queries — fetch related events + handlers once so the row map is O(1).
  const eventIds = Array.from(new Set(flags.map((f) => f.event_id)));
  const handlerIds = Array.from(
    new Set(
      flags
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

  const eventsById = new Map<string, EventLookup>(
    ((eventsRes.data ?? []) as EventLookup[]).map((e) => [e.event_id, e]),
  );
  const handlersById = new Map<string, AdminLookup>(
    ((handlersRes.data ?? []) as AdminLookup[]).map((u) => [u.user_id, u]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <AlertTriangle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Force majeure</h1>
        </div>
        <p className="text-sm text-ink/60">
          Inbound flags from <code className="text-xs">/dashboard/&lt;event&gt;/disputes</code>.
          7-day auto-resolution timer; review and route to one of 6 resolutions.
        </p>
      </header>

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

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {error.message}
        </p>
      ) : null}

      {flags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/20 bg-cream p-8 text-center text-sm text-ink/55">
          <AlertTriangle
            aria-hidden
            className="mx-auto mb-2 h-6 w-6 text-ink/30"
            strokeWidth={1.5}
          />
          Nothing in this view.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th className="px-3 py-3 font-medium">Flag</th>
                <th className="px-3 py-3 font-medium">Event</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">
                  Handler
                </th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">
                  Created
                </th>
                <th className="px-3 py-3 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => {
                const ev = eventsById.get(f.event_id);
                const handler = f.admin_handler_user_id
                  ? handlersById.get(f.admin_handler_user_id)
                  : null;
                const countdown = f.resolved_at
                  ? `Resolved ${f.resolved_at.slice(0, 10)}`
                  : formatAutoResolveCountdown(f.auto_resolve_at);
                return (
                  <tr
                    key={f.flag_id}
                    className="border-t border-ink/5 hover:bg-terracotta/[0.04]"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/force-majeure/${f.flag_id}`}
                        className="font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta hover:underline"
                      >
                        {f.public_id}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink">
                        {ev?.display_name ?? '—'}
                      </p>
                      <p className="font-mono text-[10px] text-ink/55">
                        {ev?.public_id ?? ''}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-ink/75">
                      {FLAG_TYPE_LABEL[f.flag_type]}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${FLAG_STATUS_TONE[f.status]}`}
                      >
                        {FLAG_STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-ink/70 md:table-cell">
                      {handler?.display_name ?? handler?.email ?? (
                        <span className="text-ink/40">unassigned</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 font-mono text-[11px] text-ink/55 md:table-cell">
                      {f.created_at.slice(0, 10)}
                    </td>
                    <td className="px-3 py-3 text-xs text-ink/70">
                      {countdown ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <MiniTour tourKey="admin_force_majeure_v1" />
    </div>
  );
}
