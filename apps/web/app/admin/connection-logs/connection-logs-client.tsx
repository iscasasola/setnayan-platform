'use client';

/**
 * ConnectionLogsClient — interactive island for /admin/connection-logs.
 *
 * Owns: Active / Resolved tabs · event-type filter pills · the Supabase
 * Realtime stream (new faults append live) · the inspection modal (file path +
 * raw error + JSON tree of payload_snapshot) · per-row resolve/ignore · bulk
 * "Archive all active".
 *
 * Styling follows the v2.1 editorial register used by app/admin/telemetry —
 * m-card surfaces, gold (#C5A059) accents, obsidian (#1E2229) ink.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Activity,
  Archive,
  Check,
  ChevronRight,
  Clock3,
  Database,
  EyeOff,
  Filter as FilterIcon,
  Inbox,
  MousePointerClick,
  Square,
  X,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

import { resolveAllActive, setLogStatus } from './actions';

export type FaultLogRow = {
  id: string;
  created_at: string;
  event_type: 'BUTTON_FAIL' | 'SUPABASE_SAVE_ERROR' | 'BLANK_FALLBACK' | 'OTHER';
  element_name: string | null;
  file_path: string | null;
  error_message: string | null;
  payload_snapshot: unknown;
  status: 'active' | 'resolved' | 'ignored';
  resolved_at: string | null;
};

type FilterKey = 'all' | 'BUTTON_FAIL' | 'SUPABASE_SAVE_ERROR' | 'BLANK_FALLBACK';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'BUTTON_FAIL', label: 'Broken Buttons' },
  { key: 'SUPABASE_SAVE_ERROR', label: 'Supabase Errors' },
  { key: 'BLANK_FALLBACK', label: 'Blank Fallbacks' },
];

const TYPE_META: Record<
  FaultLogRow['event_type'],
  { label: string; badge: string; Icon: typeof Activity }
> = {
  BUTTON_FAIL: {
    label: 'Broken Button',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    Icon: MousePointerClick,
  },
  SUPABASE_SAVE_ERROR: {
    label: 'Supabase Error',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    Icon: Database,
  },
  BLANK_FALLBACK: {
    label: 'Blank Fallback',
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    Icon: Square,
  },
  OTHER: {
    label: 'Other',
    badge: 'bg-[#C5A059]/12 text-[#A88340] border-[#C5A059]/30',
    Icon: Activity,
  },
};

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ConnectionLogsClient({
  initialActive,
  initialResolved,
  rowLimit,
}: {
  initialActive: FaultLogRow[];
  initialResolved: FaultLogRow[];
  rowLimit: number;
}) {
  const [active, setActive] = useState<FaultLogRow[]>(initialActive);
  const [resolved, setResolved] = useState<FaultLogRow[]>(initialResolved);
  const [tab, setTab] = useState<'active' | 'resolved'>('active');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<FaultLogRow | null>(null);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();

  // ── Realtime stream ──────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-connection-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_telemetry_logs' },
        (payload) => {
          const row = payload.new as FaultLogRow;
          const add = (prev: FaultLogRow[]) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev];
          if (row.status === 'active') setActive(add);
          else setResolved(add);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_telemetry_logs' },
        (payload) => {
          const row = payload.new as FaultLogRow;
          // Two independent functional updates reconcile both lists against the
          // latest state without a cross-state read: drop the row from each,
          // then re-add it to whichever list its new status belongs to.
          setActive((prev) => {
            const without = prev.filter((r) => r.id !== row.id);
            return row.status === 'active' ? [row, ...without] : without;
          });
          setResolved((prev) => {
            const without = prev.filter((r) => r.id !== row.id);
            return row.status === 'active' ? without : [row, ...without];
          });
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      void supabase.removeChannel(channel);
    };
    // createClient returns a stable browser client; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close modal on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const filteredActive = useMemo(
    () => (filter === 'all' ? active : active.filter((r) => r.event_type === filter)),
    [active, filter],
  );

  const rows = tab === 'active' ? filteredActive : resolved;

  const resolveOne = useCallback(
    (row: FaultLogRow, status: 'resolved' | 'ignored') => {
      // Optimistic move; Realtime UPDATE reconciles as a safety net.
      const updated: FaultLogRow = { ...row, status, resolved_at: new Date().toISOString() };
      setActive((prev) => prev.filter((r) => r.id !== row.id));
      setResolved((prev) => [updated, ...prev.filter((r) => r.id !== row.id)]);
      if (selected?.id === row.id) setSelected(null);
      startTransition(async () => {
        const res = await setLogStatus(row.id, status);
        if (!res.ok) {
          // Revert on failure.
          setResolved((prev) => prev.filter((r) => r.id !== row.id));
          setActive((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
        }
      });
    },
    [selected],
  );

  const archiveAll = useCallback(() => {
    const scope = filter;
    const target = scope === 'all' ? active : active.filter((r) => r.event_type === scope);
    if (target.length === 0) return;
    const ids = new Set(target.map((r) => r.id));
    const stamped = target.map((r) => ({
      ...r,
      status: 'resolved' as const,
      resolved_at: new Date().toISOString(),
    }));
    setActive((prev) => prev.filter((r) => !ids.has(r.id)));
    setResolved((prev) => [...stamped, ...prev]);
    startTransition(async () => {
      await resolveAllActive(scope);
    });
  }, [active, filter]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="m-eyebrow text-[#A88340]">Observability · real-time</p>
        <h1 className="m-display-tight text-3xl text-[#1E2229]">Connection Logs</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[#5B5B5B]">
          Front-end faults captured across the app — broken buttons, failed
          Supabase saves, and blank fallbacks — stream in here the moment they
          happen. Resolve them as you fix them; the Active tab stays a true
          picture of what&apos;s still broken.
        </p>
      </header>

      {/* Stats + live indicator */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active issues" value={String(active.length)} />
        <StatCard label="Resolved archive" value={String(resolved.length)} />
        <div className="m-card flex items-center justify-between px-4 py-3">
          <div>
            <p className="m-label-mono text-[10px] uppercase tracking-[0.18em] text-[#A88340]">
              Live stream
            </p>
            <p className="mt-1 text-sm font-medium text-[#1E2229]">
              {live ? 'Connected' : 'Connecting…'}
            </p>
          </div>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              live ? 'animate-pulse bg-emerald-500' : 'bg-[#C5A059]/40'
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Tabs + bulk action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[#C5A059]/30 bg-white p-1">
          <TabButton active={tab === 'active'} onClick={() => setTab('active')}>
            Active issues
            <Count n={active.length} active={tab === 'active'} />
          </TabButton>
          <TabButton active={tab === 'resolved'} onClick={() => setTab('resolved')}>
            Resolved archive
            <Count n={resolved.length} active={tab === 'resolved'} />
          </TabButton>
        </div>

        {tab === 'active' && active.length > 0 ? (
          <button
            type="button"
            onClick={archiveAll}
            disabled={pending || filteredActive.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C5A059] bg-[#C5A059] px-4 py-1.5 text-xs font-medium text-white transition hover:bg-[#A88340] disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            {filter === 'all'
              ? 'Archive all active'
              : `Archive all ${FILTERS.find((f) => f.key === filter)?.label ?? ''}`}
          </button>
        ) : null}
      </div>

      {/* Filter pills (Active only) */}
      {tab === 'active' ? (
        <nav
          aria-label="Filter by fault type"
          className="m-card flex flex-wrap items-center gap-2 px-4 py-3"
        >
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[#A88340]">
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Type
          </span>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition ${
                filter === f.key
                  ? 'border-[#C5A059] bg-[#C5A059] text-white'
                  : 'border-[#C5A059]/30 bg-white text-[#1E2229] hover:bg-[#FBFBFA]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </nav>
      ) : null}

      {/* Results */}
      {rows.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <LogRow
              key={row.id}
              row={row}
              onInspect={() => setSelected(row)}
              onResolve={() => resolveOne(row, 'resolved')}
              onIgnore={() => resolveOne(row, 'ignored')}
              pending={pending}
            />
          ))}
        </ul>
      )}

      {tab === 'active' && active.length >= rowLimit ? (
        <p className="text-center text-[11px] uppercase tracking-[0.16em] text-[#A88340]">
          Showing latest {rowLimit} · resolve some to see older faults
        </p>
      ) : null}

      {selected ? <InspectModal row={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function LogRow({
  row,
  onInspect,
  onResolve,
  onIgnore,
  pending,
}: {
  row: FaultLogRow;
  onInspect: () => void;
  onResolve: () => void;
  onIgnore: () => void;
  pending: boolean;
}) {
  const meta = TYPE_META[row.event_type];
  const isActive = row.status === 'active';
  return (
    <li className="m-card group flex items-start gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onInspect}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
        aria-label="Inspect fault"
      >
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${meta.badge}`}
        >
          <meta.Icon className="h-3 w-3" aria-hidden="true" />
          {meta.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[#1E2229]">
            {row.element_name || 'Unnamed element'}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#5B5B5B]">
            {row.file_path ? (
              <span className="m-mono break-all text-[11px]">{row.file_path}</span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" aria-hidden="true" />
              {formatRelativeTime(isActive ? row.created_at : row.resolved_at ?? row.created_at)}
            </span>
            {row.status === 'ignored' ? (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                ignored
              </span>
            ) : null}
          </span>
          {row.error_message ? (
            <span className="mt-1 block truncate text-xs text-[#5B5B5B]">
              {row.error_message.split('\n')[0]}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="mt-1 h-4 w-4 shrink-0 text-[#C5A059]/50 transition group-hover:text-[#C5A059]"
          aria-hidden="true"
        />
      </button>

      {isActive ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onIgnore}
            disabled={pending}
            title="Ignore — archive without marking as a real fix"
            className="inline-flex items-center gap-1 rounded-full border border-[#C5A059]/30 bg-white px-2.5 py-1 text-xs text-[#5B5B5B] transition hover:bg-[#FBFBFA] disabled:opacity-50"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Ignore
          </button>
          <button
            type="button"
            onClick={onResolve}
            disabled={pending}
            title="Mark resolved — moves to the archive"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Resolve
          </button>
        </div>
      ) : null}
    </li>
  );
}

function EmptyState({ tab }: { tab: 'active' | 'resolved' }) {
  return (
    <div className="m-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {tab === 'active' ? (
        <>
          <Check className="h-8 w-8 text-emerald-500" aria-hidden="true" />
          <p className="text-base font-medium text-[#1E2229]">All clear</p>
          <p className="max-w-md text-sm leading-relaxed text-[#5B5B5B]">
            No active faults right now. New broken buttons, failed saves, or blank
            fallbacks will appear here the instant they happen.
          </p>
        </>
      ) : (
        <>
          <Inbox className="h-8 w-8 text-[#C5A059]" aria-hidden="true" />
          <p className="max-w-md text-sm leading-relaxed text-[#5B5B5B]">
            Nothing archived yet. Resolved and ignored faults land here.
          </p>
        </>
      )}
    </div>
  );
}

function InspectModal({ row, onClose }: { row: FaultLogRow; onClose: () => void }) {
  const meta = TYPE_META[row.event_type];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#1E2229]/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="m-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Fault detail"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#C5A059]/15 px-5 py-4">
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${meta.badge}`}
            >
              <meta.Icon className="h-3 w-3" aria-hidden="true" />
              {meta.label}
            </span>
            <h2 className="mt-2 truncate text-lg font-semibold text-[#1E2229]">
              {row.element_name || 'Unnamed element'}
            </h2>
            <p className="mt-0.5 text-xs text-[#5B5B5B]">
              {new Date(row.created_at).toLocaleString('en-PH')} · {row.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-[#C5A059]/30 p-1.5 text-[#5B5B5B] transition hover:bg-[#FBFBFA]"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <Field label="File path">
            <code className="m-mono block break-all rounded-lg bg-[#FBFBFA] px-3 py-2 text-xs text-[#1E2229]">
              {row.file_path || '—'}
            </code>
          </Field>

          <Field label="Error">
            <pre className="m-mono max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-[#1E2229] px-3 py-2 text-xs leading-relaxed text-[#FBFBFA]">
              {row.error_message || '—'}
            </pre>
          </Field>

          <Field label="Payload snapshot">
            <div className="max-h-72 overflow-auto rounded-lg bg-[#FBFBFA] px-3 py-2">
              <JsonTree data={row.payload_snapshot} />
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="m-label-mono mb-1 text-[10px] uppercase tracking-[0.18em] text-[#A88340]">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Minimal recursive JSON tree viewer for payload_snapshot. */
function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null) return <span className="text-[#5B5B5B]">null</span>;
  if (data === undefined) return <span className="text-[#5B5B5B]">undefined</span>;

  const t = typeof data;
  if (t === 'string') return <span className="text-emerald-700">&quot;{data as string}&quot;</span>;
  if (t === 'number') return <span className="text-sky-700">{String(data)}</span>;
  if (t === 'boolean') return <span className="text-violet-700">{String(data)}</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-[#5B5B5B]">[]</span>;
    return (
      <ul className="border-l border-[#C5A059]/20 pl-3">
        {data.map((item, i) => (
          <li key={i} className="text-xs">
            <span className="text-[#A88340]">{i}: </span>
            <JsonTree data={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  if (t === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-[#5B5B5B]">{'{}'}</span>;
    return (
      <ul className={depth === 0 ? '' : 'border-l border-[#C5A059]/20 pl-3'}>
        {entries.map(([k, v]) => (
          <li key={k} className="text-xs leading-relaxed">
            <span className="font-medium text-[#1E2229]">{k}</span>
            <span className="text-[#5B5B5B]">: </span>
            <JsonTree data={v} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  return <span className="text-[#5B5B5B]">{String(data)}</span>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="m-card px-4 py-3">
      <p className="m-label-mono text-[10px] uppercase tracking-[0.18em] text-[#A88340]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#1E2229]">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active ? 'bg-[#1E2229] text-white' : 'text-[#5B5B5B] hover:text-[#1E2229]'
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] ${
        active ? 'bg-white/20 text-white' : 'bg-[#C5A059]/15 text-[#A88340]'
      }`}
    >
      {n}
    </span>
  );
}
