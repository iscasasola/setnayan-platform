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
import { AlertTriangle, Check, Plus, RefreshCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

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

type Props = {
  eventId: string;
  initialRows: DayRequestRow[];
  side: 'coordinator' | 'vendor';
};

/** Which lane raised it — a soft fill per lane, words in full strength (gold stays a fill, never small words). */
const LANE_TONE: Record<string, string> = {
  couple: 'bg-terracotta/10 text-ink',
  vendor: 'bg-ink/10 text-ink',
  host: 'bg-success-500/10 text-success-700',
  coordinator: 'bg-warn-600/10 text-warn-700',
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
    <section>
      <div className="flex items-center justify-between gap-3">
        <InfoTip
          label={canTriageHere ? 'Requests inbox' : 'Your reports'}
          labelAs="h3"
          labelClassName="text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]"
        >
          {canTriageHere
            ? 'Everything raised on the day — by the couple, the hosts, your suppliers, or you. Tap an item to move it from open to seen to done.'
            : 'What you have reported to the coordinator today. They clear each one as it is handled.'}
        </InfoTip>
        <div className="flex items-center gap-2">
          <Badge tone={summary.openWork > 0 ? 'wait' : 'quiet'}>{summary.openWork} open</Badge>
          <ActionButton
            tone="neutral"
            iconOnly
            icon={RefreshCw}
            label="Refresh"
            waiting={refreshing}
            onClick={() => void refresh()}
          />
        </div>
      </div>

      {canTriageHere ? (
        <p className="mt-1 text-sm text-[color:var(--m-slate-2)]">Tap the box to move an item to seen, then done.</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-700">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
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
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-[color:var(--m-line)] bg-white px-3 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta dark:bg-raised"
        />
        <ActionButton
          tone="brand"
          main
          icon={Plus}
          label="Log"
          disabled={pending || !draft.trim()}
          onClick={add}
        />
      </div>

      <ul className="mt-3 divide-y divide-[color:var(--m-line)]">
        {ordered.length === 0 ? (
          <li className="py-3 text-sm text-[color:var(--m-slate-2)]">All clear — nothing logged yet.</li>
        ) : (
          ordered.map((row) => {
            const done = row.status === 'resolved';
            const isWork = countsAsOpenWork(row);
            const preset = presetByKey(row.preset_key);
            return (
              <li key={row.request_id} className="flex min-h-14 items-start gap-3 py-2.5">
                {canTriageHere ? (
                  // The box is drawn 24 px; the button around it presses at 44.
                  <button
                    type="button"
                    onClick={() => advance(row)}
                    aria-label={`Mark ${statusLabel(nextStatus(row.status)).toLowerCase()}`}
                    className="-my-2.5 -ml-2.5 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"
                  >
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-md border transition duration-sn-micro ease-sn ${
                        done
                          ? 'border-success-400 bg-success-500 text-white'
                          : row.status === 'acknowledged'
                            ? 'border-terracotta bg-terracotta/15 text-ink'
                            : 'border-[color:var(--m-line)] bg-white text-transparent hover:border-terracotta dark:bg-raised'
                      }`}
                    >
                      <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
                    </span>
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
                    className={`block text-sm ${done ? 'text-[color:var(--m-slate-2)] line-through' : 'font-medium text-ink'}`}
                  >
                    {row.body}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        LANE_TONE[row.origin] ?? 'bg-ink/10 text-ink'
                      }`}
                    >
                      {laneLabel(row.origin)}
                    </span>
                    {preset ? (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs text-[color:var(--m-slate-2)]">
                        {preset.label}
                      </span>
                    ) : null}
                    {!isWork && !done ? (
                      <span className="text-xs text-[color:var(--m-slate-2)]">status update</span>
                    ) : null}
                    {row.status !== 'open' ? (
                      <span className="text-xs text-[color:var(--m-slate-2)]">{statusLabel(row.status)}</span>
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
    </section>
  );
}
