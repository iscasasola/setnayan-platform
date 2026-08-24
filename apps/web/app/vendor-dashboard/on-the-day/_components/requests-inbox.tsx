'use client';

/**
 * RequestsInbox — the ONE inbox over the day-of requests stream
 * (build plan §10 #6). Table `public.event_day_requests`, migration
 * 20271013100000.
 *
 * The same component serves both sides, because the whole point of the origin
 * enum is that there is one list rather than one per lane:
 *
 *   • the booked COORDINATOR sees every lane and triages;
 *   • any other booked supplier sees only what they filed, read-only.
 *
 * Which of those you get is decided on the SERVER (RLS + `side` from
 * getDayRequestsView) — this component only renders what it is handed. Hiding a
 * control is not a boundary.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, Check, Inbox, Loader2, Plus, RefreshCw } from 'lucide-react';

import {
  countsAsOpenWork,
  laneLabel,
  nextStatus,
  normalizeRequestBody,
  presetByKey,
  sortInbox,
  statusLabel,
  summarizeInbox,
  DAY_REQUEST_BODY_MAX,
  type DayRequestRow,
} from '@/lib/day-requests';
import {
  getDayRequestsView,
  setDayRequestStatus,
  submitDayRequest,
} from '../actions';
import { shopEmptyInlineClass } from '../../_components/kit';

type Props = {
  eventId: string;
  initialRows: DayRequestRow[];
  side: 'coordinator' | 'vendor';
};

const LANE_TONE: Record<string, string> = {
  couple: 'bg-terracotta/10 text-terracotta-700',
  vendor: 'bg-ink/10 text-ink/70',
  host: 'bg-success-500/10 text-success-600',
  coordinator: 'bg-warn-600/10 text-warn-600',
};

export function RequestsInbox({ eventId, initialRows, side }: Props) {
  const [rows, setRows] = useState<DayRequestRow[]>(initialRows);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const canTriageHere = side === 'coordinator';
  const ordered = useMemo(() => sortInbox(rows), [rows]);
  const summary = useMemo(() => summarizeInbox(rows), [rows]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const view = await getDayRequestsView(eventId);
      if (view.active) setRows(view.rows);
    } catch {
      // Offline on the floor — keep showing what we have rather than blanking.
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  // The floor moves; poll gently so the coordinator sees supplier check-ins
  // without hunting for a refresh button. 30s matches FloorClock's tick.
  useEffect(() => {
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  function add() {
    const body = normalizeRequestBody(draft);
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await submitDayRequest(eventId, body);
      if (!res.ok) {
        setError(res.error ?? 'Could not save that.');
        return;
      }
      setDraft('');
      await refresh();
    });
  }

  function advance(row: DayRequestRow) {
    if (!canTriageHere) return;
    const target = nextStatus(row.status);
    setError(null);
    // Optimistic — the floor is not a place to wait on a spinner.
    setRows((prev) =>
      prev.map((r) => (r.request_id === row.request_id ? { ...r, status: target } : r)),
    );
    startTransition(async () => {
      const res = await setDayRequestStatus(eventId, row.request_id, target);
      if (!res.ok) {
        setError(res.error ?? 'Could not update that item.');
        setRows((prev) =>
          prev.map((r) => (r.request_id === row.request_id ? { ...r, status: row.status } : r)),
        );
      }
    });
  }

  return (
    <div className="sn-tile p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Inbox aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          {canTriageHere ? 'Requests inbox' : 'Your reports'}
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            {summary.openWork} open
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            aria-label="Refresh"
            className="rounded-md p-1.5 text-ink/40 transition hover:bg-ink/5 hover:text-ink/70"
          >
            {refreshing ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-ink/65">
        {canTriageHere
          ? 'Everything raised on the day — by the couple, the hosts, your suppliers, or you. Tap an item to move it from open to seen to done.'
          : 'What you have reported to the coordinator today. They clear each one as it is handled.'}
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          maxLength={DAY_REQUEST_BODY_MAX}
          placeholder={canTriageHere ? 'Log an issue…' : 'Report something to the coordinator…'}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Log
        </button>
      </div>

      <ul className="mt-4 space-y-1.5">
        {ordered.length === 0 ? (
          <li className={shopEmptyInlineClass}>
            All clear — nothing logged yet.
          </li>
        ) : (
          ordered.map((row) => {
            const done = row.status === 'resolved';
            const isWork = countsAsOpenWork(row);
            const preset = presetByKey(row.preset_key);
            return (
              <li
                key={row.request_id}
                className="flex items-start gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
              >
                {canTriageHere ? (
                  <button
                    type="button"
                    onClick={() => advance(row)}
                    aria-label={`Mark ${statusLabel(nextStatus(row.status)).toLowerCase()}`}
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                      done
                        ? 'border-success-400 bg-success-500 text-white'
                        : row.status === 'acknowledged'
                          ? 'border-terracotta bg-terracotta/15 text-terracotta-700'
                          : 'border-ink/25 bg-white text-transparent hover:border-terracotta'
                    }`}
                  >
                    <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                ) : (
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      done ? 'bg-success-500' : 'bg-terracotta'
                    }`}
                  />
                )}

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${done ? 'text-ink/40 line-through' : 'text-ink/80'}`}
                  >
                    {row.body}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                        LANE_TONE[row.origin] ?? 'bg-ink/10 text-ink/70'
                      }`}
                    >
                      {laneLabel(row.origin)}
                    </span>
                    {preset ? (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-ink/45">
                        {preset.label}
                      </span>
                    ) : null}
                    {!isWork && !done ? (
                      <span className="text-[11px] text-ink/40">status update</span>
                    ) : null}
                    {row.status !== 'open' ? (
                      <span className="text-[11px] text-ink/45">{statusLabel(row.status)}</span>
                    ) : null}
                  </span>
                </span>

                {isWork && row.kind === 'issue' ? (
                  <AlertTriangle
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-warn-600"
                    strokeWidth={1.75}
                  />
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
