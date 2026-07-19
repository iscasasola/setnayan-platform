'use client';

/**
 * ShotList — the photographer/videographer day-of checklist (Phase 7 · On the
 * Day console, `photo` variant).
 *
 * Deliberately CLIENT-SIDE + localStorage-scoped per event. On the wedding day
 * the shooter wants a fast, offline-tolerant "must-get shots" list they can
 * check off between setups — no round-trips, works on a spotty venue signal, no
 * new table + RLS surface. Seeded from a sensible default list the first time an
 * event is opened; fully editable (add / rename / remove / reorder-by-toggle);
 * a "reset to defaults" restores the seed. Nothing here touches the server.
 *
 * Storage key is namespaced by eventId so each couple gets their own list on the
 * device. If the vendor switches devices the list doesn't follow — acceptable
 * for a v1 personal checklist; a synced, couple-shared shot list is a follow-up
 * (would need a table + booked-vendor RLS).
 */

import { useEffect, useMemo, useState } from 'react';
import { Camera, Check, Plus, RotateCcw, Trash2 } from 'lucide-react';

type Shot = { id: string; label: string; done: boolean };

const DEFAULT_SHOTS: readonly string[] = [
  'Getting-ready details (rings, shoes, invite, perfume)',
  'Bride portrait',
  'Groom portrait',
  'First look',
  'Processional / entrance',
  'Ceremony wide + the vows',
  'The kiss',
  'Recessional',
  'Family & principal-sponsor groupings',
  'Full entourage',
  'Couple portraits (golden hour)',
  'Reception room, empty',
  'Grand entrance',
  'First dance',
  'Toasts / speeches',
  'Cake cutting',
  'Bouquet & garter toss',
  'Candid guest moments',
  'Send-off',
];

function storageKey(eventId: string): string {
  return `setnayan.onday.shotlist.${eventId}`;
}

function makeId(): string {
  return `s_${Math.random().toString(36).slice(2, 9)}`;
}

function seedShots(): Shot[] {
  return DEFAULT_SHOTS.map((label) => ({ id: makeId(), label, done: false }));
}

export function ShotList({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');

  // Hydrate from localStorage on mount (client-only). Seed on first open.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(eventId));
      if (raw) {
        const parsed = JSON.parse(raw) as Shot[];
        if (Array.isArray(parsed)) {
          setShots(parsed.filter((s) => s && typeof s.label === 'string'));
          setLoaded(true);
          return;
        }
      }
    } catch {
      // Corrupt / unavailable storage — fall through to a fresh seed.
    }
    setShots(seedShots());
    setLoaded(true);
  }, [eventId]);

  // Persist on every change (after the initial hydrate).
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey(eventId), JSON.stringify(shots));
    } catch {
      // Storage full / blocked — the list still works in-memory this session.
    }
  }, [shots, loaded, eventId]);

  const doneCount = useMemo(() => shots.filter((s) => s.done).length, [shots]);

  function toggle(id: string) {
    setShots((prev) => prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  }

  function remove(id: string) {
    setShots((prev) => prev.filter((s) => s.id !== id));
  }

  function add() {
    const label = draft.trim();
    if (!label) return;
    setShots((prev) => [...prev, { id: makeId(), label: label.slice(0, 140), done: false }]);
    setDraft('');
  }

  function reset() {
    setShots(seedShots());
  }

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
        check them off as you go — this list lives on this device, private to you.
      </p>

      <ul className="mt-4 space-y-1.5">
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
        {shots.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink/15 px-3 py-4 text-center text-sm text-ink/45">
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
          maxLength={140}
          placeholder="Add a shot…"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium text-ink/60 transition hover:bg-cream"
        >
          <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Reset
        </button>
      </div>
    </div>
  );
}
