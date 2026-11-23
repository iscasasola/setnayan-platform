'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Minus, Plus, RotateCcw, Ticket } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { QUEUE_SERVED_LABEL, QUEUE_TOOL_KEY, queueCounterView, type ListStore } from '@/lib/shot-list';
import { addShot, loadShotList, removeShot } from '../../../../shot-list-actions';

type CounterStore = Pick<ListStore, 'load' | 'add' | 'remove'>;
/** The shipped actions — what the live page uses. A dev lab passes `memoryListStore()` instead. */
const ACTIONS: CounterStore = {
  load: (eventId, tool) => loadShotList(eventId, tool),
  add: (eventId, label, position, tool) => addShot(eventId, label, position, tool),
  remove: (eventId, itemId) => removeShot(eventId, itemId),
};

/**
 * 🔢 QUEUE COUNTER — the counter template (hub tool `queue_counter`, DECISION_LOG 2026-11-23; drawing
 * `prototypes/hub_tools_working_2026-10-28/` template ④: the big number, "served of 131", the bar, − and ＋).
 *
 * Each ＋ saves ONE row (`event_shot_list_items`, tool `queue_counter`, its time = the serve), each − removes the
 * latest one, so the count is the rows: two phones at one booth add up instead of overwriting each other. "Of" is the
 * couple's RSVP — attending, from the same brief the Hub's "coming" tile reads (`coming`), never a second count.
 *
 * Honest: until the saved rows are read the number is not drawn; a refused read says so with Try again, never 0. A
 * refused ＋ or − puts the number back and says why.
 */
export function QueueCounter({
  eventId,
  coming,
  store = ACTIONS,
}: {
  eventId: string;
  coming: number | null;
  /** Labs only: an in-memory store. Pages never pass it. */
  store?: CounterStore;
}) {
  const [ids, setIds] = useState<string[] | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unreadable'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const idsRef = useRef<string[]>([]);
  idsRef.current = ids ?? [];

  const load = useCallback(() => {
    setState('loading');
    store.load(eventId, QUEUE_TOOL_KEY)
      .catch(() => ({ state: 'unreadable' as const }))
      .then((res) => {
        if (res.state !== 'ok') {
          setState('unreadable');
          return;
        }
        setIds(res.rows.map((r) => r.item_id));
        setState('ok');
      });
  }, [eventId, store]);

  useEffect(load, [load]);

  function serve() {
    setError(null);
    const at = idsRef.current.length;
    const temp = `local_${at}_${Date.now()}`;
    setIds([...idsRef.current, temp]);
    startTransition(async () => {
      const res = await store.add(eventId, QUEUE_SERVED_LABEL, at, QUEUE_TOOL_KEY).catch(() => ({
        ok: false as const,
        error: 'Couldn’t reach Setnayan.',
      }));
      if (res.ok) setIds(idsRef.current.map((id) => (id === temp ? res.shot.id : id)));
      else {
        setIds(idsRef.current.filter((id) => id !== temp));
        setError(`Not counted. ${res.error}`);
      }
    });
  }

  function takeBack() {
    const last = idsRef.current[idsRef.current.length - 1];
    if (!last || last.startsWith('local_')) return;
    setError(null);
    setIds(idsRef.current.slice(0, -1));
    startTransition(async () => {
      const res = await store.remove(eventId, last).catch(() => ({ ok: false as const, error: 'Couldn’t reach Setnayan.' }));
      if (!res.ok) {
        setIds([...idsRef.current, last]);
        setError(`Not taken back. ${res.error}`);
      }
    });
  }

  if (state === 'unreadable') {
    return (
      <div data-hub-tool="queue_counter" data-state="unreadable">
        <QueueTitle />
        <p role="alert" className="mt-2 text-sn-md text-warn-800">
          We couldn’t load the count right now. It is not zero.
        </p>
        <div className="mt-3">
          <ActionButton tone="neutral" onClick={load} icon={RotateCcw} label="Try again" />
        </div>
      </div>
    );
  }

  const view = queueCounterView(ids?.length ?? 0, coming);
  const loading = state === 'loading';
  return (
    <div data-hub-tool="queue_counter" data-state={state} aria-busy={loading}>
      <QueueTitle />
      <p className="mt-1 text-sn-md text-[color:var(--m-slate-2)]">Tap Served for each guest you serve.</p>
      <div className="mt-3 text-center">
        <p className="tabular-nums text-sn-3xl font-bold text-ink" data-queue-served="">
          {loading ? '—' : formatCount(view.served)}
        </p>
        <p className="text-sn-md text-[color:var(--m-slate-2)]" data-queue-of="">
          {view.of == null ? 'served · guest count couldn’t load' : `served of ${formatCount(view.of)} coming`}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ background: 'var(--m-line-soft)' }}>
        <div className="h-full rounded-full" style={{ width: `${view.pct}%`, background: 'var(--m-sage-deep)' }} />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sn-md text-warn-800">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-center gap-2">
        <ActionButton
          tone="neutral"
          onClick={takeBack}
          disabled={loading || pending || view.served === 0}
          icon={Minus}
          label="Take one back"
        />
        <ActionButton tone="brand" main onClick={serve} disabled={loading} icon={Plus} label="Served" />
      </div>
    </div>
  );
}

/** The tool's heading — the same as the checklists' (icon + title), so the tools read as one set. */
function QueueTitle() {
  return (
    <h2 className="flex items-center gap-2 text-lg font-semibold">
      <Ticket aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} /> Queue counter
    </h2>
  );
}
