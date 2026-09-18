'use client';

/**
 * ShotList — the photographer/videographer day-of checklist (Phase 7 · On the
 * Day console, `photo` variant).
 *
 * ── DAY-10 · THE LIST NOW REACHES THE COUPLE ───────────────────────────────
 * This used to be localStorage-only, and its docblock said so ("Nothing here
 * touches the server"). The list is now saved to `event_shot_list_items`
 * (migration 20271234188149) through `../shot-list-actions.ts`, so it follows
 * the supplier to a second device and the couple reads it on their vendor
 * workspace (`dashboard/[eventId]/vendors/[vendorId]/workspace`).
 *
 * localStorage is KEPT, as an offline cache: on a spotty venue signal the
 * shooter can still check shots off, and "Save again" pushes the device copy
 * once the signal is back.
 *
 * 🔑 THE STATUS LINE IS THE POINT. Which of three states the list is in —
 * saved (the couple sees it), not shared yet, or couldn't reach Setnayan — is
 * always printed under the heading. A list that exists only on this phone must
 * never look like one the couple has; that is the exact defect PR #5502 removed
 * a heading for.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, CloudOff, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { shopEmptyInlineClass } from '../../_components/kit';
import {
  DEFAULT_SHOTS,
  SHOT_LABEL_MAX,
  decideInitialShots,
  normalizeShotLabel,
  parseLocalShots,
  type Shot,
  type ShotListSource,
} from '@/lib/shot-list';
import {
  addShot,
  loadShotList,
  removeShot,
  replaceShotList,
  setShotCaptured,
} from '../shot-list-actions';

function storageKey(eventId: string): string {
  return `setnayan.onday.shotlist.${eventId}`;
}

function makeLocalId(): string {
  return `local_${Math.random().toString(36).slice(2, 9)}`;
}

function seedShots(): Shot[] {
  return DEFAULT_SHOTS.map((label) => ({ id: makeLocalId(), label, done: false }));
}

export function ShotList({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [source, setSource] = useState<ShotListSource | 'loading'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // The latest list, for async callbacks that must not close over a stale one.
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;

  // Hydrate: the saved list first; the device copy only when the saved one
  // is empty or unreachable.
  useEffect(() => {
    let cancelled = false;
    let local: Shot[] | null = null;
    try {
      local = parseLocalShots(window.localStorage.getItem(storageKey(eventId)));
    } catch {
      local = null;
    }
    loadShotList(eventId)
      .catch(() => ({ state: 'unreadable' as const }))
      .then((server) => {
        if (cancelled) return;
        const initial = decideInitialShots(server, local, seedShots);
        setShots(initial.shots);
        setSource(initial.source);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Mirror every change to the device cache (after hydrate).
  useEffect(() => {
    if (source === 'loading') return;
    try {
      window.localStorage.setItem(storageKey(eventId), JSON.stringify(shots));
    } catch {
      // Storage full / blocked — the saved list is unaffected.
    }
  }, [shots, source, eventId]);

  const doneCount = useMemo(() => shots.filter((s) => s.done).length, [shots]);

  /** Push the whole list. Used whenever the saved copy is absent or behind. */
  const saveWhole = useCallback(
    async (list: Shot[]) => {
      setSaving(true);
      const res = await replaceShotList(
        eventId,
        list.map((s) => ({ label: s.label, done: s.done })),
      ).catch(() => ({ ok: false as const, error: 'Couldn’t reach Setnayan.' }));
      setSaving(false);
      if (res.ok) {
        setShots(res.shots);
        setSource('server');
        setError(null);
      } else {
        setError(res.error);
      }
    },
    [eventId],
  );

  /**
   * Apply an edit locally, then save it. When the list is already saved, a
   * single-row write; otherwise the whole list goes up. Any failure drops the
   * list to `offline`, so the status line stops claiming the couple has it.
   */
  const commit = useCallback(
    async (next: Shot[], rowWrite: () => Promise<{ ok: boolean; error?: string }>) => {
      setShots(next);
      if (source !== 'server') {
        await saveWhole(next);
        return;
      }
      setSaving(true);
      const res = await rowWrite().catch(() => ({ ok: false, error: 'Couldn’t reach Setnayan.' }));
      setSaving(false);
      if (!res.ok) {
        setSource('offline');
        setError(res.error ?? 'Not saved.');
      }
    },
    [source, saveWhole],
  );

  function toggle(id: string) {
    const target = shots.find((s) => s.id === id);
    if (!target) return;
    const next = shots.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    void commit(next, () => setShotCaptured(eventId, id, !target.done));
  }

  function remove(id: string) {
    const next = shots.filter((s) => s.id !== id);
    void commit(next, () => removeShot(eventId, id));
  }

  function add() {
    const label = normalizeShotLabel(draft);
    if (!label) return;
    const tempId = makeLocalId();
    const next = [...shots, { id: tempId, label, done: false }];
    setDraft('');
    void commit(next, async () => {
      const res = await addShot(eventId, label, next.length - 1);
      if (res.ok) {
        // Swap the temporary id for the saved one, so a later toggle targets it.
        setShots(shotsRef.current.map((s) => (s.id === tempId ? res.shot : s)));
        return { ok: true };
      }
      return { ok: false, error: res.error };
    });
  }

  function reset() {
    void saveWhole(seedShots());
  }

  const loading = source === 'loading';

  return (
    <div className="sn-tile p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Camera aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} /> Shot list
        </h2>
        <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {doneCount}/{shots.length} captured
        </span>
      </div>
      <p className="mt-2 text-sm text-ink/65">
        Your must-get shots for <span className="font-medium text-ink/80">{eventName}</span>. Tap to
        check them off as you go.
      </p>

      <ShotListStatus
        source={source}
        saving={saving}
        error={error}
        onSave={() => void saveWhole(shotsRef.current)}
      />

      <ul className="mt-4 space-y-1.5" aria-busy={loading}>
        {shots.map((s) => (
          <li
            key={s.id}
            className="group flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={s.done}
              aria-label={s.done ? `Mark "${s.label}" not captured` : `Mark "${s.label}" captured`}
              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                s.done
                  ? 'border-success-400 bg-success-500 text-white'
                  : 'border-ink/25 bg-white text-transparent hover:border-terracotta'
              }`}
            >
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <span
              className={`flex-1 text-sm ${s.done ? 'text-ink/40 line-through' : 'text-ink/80'}`}
            >
              {s.label}
            </span>
            <button
              type="button"
              onClick={() => remove(s.id)}
              aria-label={`Remove "${s.label}"`}
              className="shrink-0 rounded-md p-1 text-ink/30 opacity-0 transition hover:bg-ink/5 hover:text-warn-600 focus:opacity-100 group-hover:opacity-100"
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </li>
        ))}
        {!loading && shots.length === 0 ? (
          <li className={shopEmptyInlineClass}>
            Your list is empty — add a shot below or reset to the default list.
          </li>
        ) : null}
      </ul>

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
          maxLength={SHOT_LABEL_MAX}
          placeholder="Add a shot…"
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        <button
          type="button"
          onClick={add}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={loading || saving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink/60 transition hover:bg-cream"
        >
          <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Reset
        </button>
      </div>
    </div>
  );
}

/** The one line that says whether the couple can see this list. */
function ShotListStatus({
  source,
  saving,
  error,
  onSave,
}: {
  source: ShotListSource | 'loading';
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  if (source === 'loading') {
    return <p className="mt-3 text-xs text-ink/50">Loading your saved list…</p>;
  }
  if (source === 'server') {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-success-700" role="status">
        <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {saving ? 'Saving…' : 'Saved — the couple can see this list on their vendor page.'}
      </p>
    );
  }
  const offline = source === 'offline';
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warn-200 bg-warn-50 px-3 py-2 text-xs text-warn-800"
      role="status"
    >
      <CloudOff aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="flex-1">
        {offline
          ? 'Couldn’t reach Setnayan — changes are on this device only, and the couple may be seeing an older list.'
          : 'Not shared yet — this list is only on this device. The couple sees it once you save it.'}
        {error ? ` (${error})` : null}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="rounded-md bg-ink px-2.5 py-1 font-medium text-cream transition hover:bg-ink/90 disabled:opacity-60"
      >
        {saving ? 'Saving…' : offline ? 'Save again' : 'Share with the couple'}
      </button>
    </div>
  );
}
