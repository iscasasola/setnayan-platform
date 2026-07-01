'use client';

/**
 * IssuesLog — the coordinator's day-of issues tracker (Phase 7 · On the Day
 * console, `coordinator` command-center variant).
 *
 * Client-side + localStorage-scoped per event, same rationale as ShotList: on
 * the day the coordinator jots what's going sideways (late vendor, missing
 * chairs, delayed grand entrance) and clears each as it's handled, offline-
 * tolerant, no round-trip, no new RLS surface. A shared/synced issues log that
 * the couple can see is a follow-up (would need a table + booked-vendor RLS).
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, Trash2 } from 'lucide-react';

type Issue = { id: string; text: string; resolved: boolean; at: number };

function storageKey(eventId: string): string {
  return `setnayan.onday.issues.${eventId}`;
}

function makeId(): string {
  return `i_${Math.random().toString(36).slice(2, 9)}`;
}

export function IssuesLog({ eventId }: { eventId: string }) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(eventId));
      if (raw) {
        const parsed = JSON.parse(raw) as Issue[];
        if (Array.isArray(parsed)) {
          setIssues(parsed.filter((i) => i && typeof i.text === 'string'));
          setLoaded(true);
          return;
        }
      }
    } catch {
      // Corrupt / unavailable storage — start empty.
    }
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey(eventId), JSON.stringify(issues));
    } catch {
      // Storage full / blocked — in-memory only this session.
    }
  }, [issues, loaded, eventId]);

  const openCount = useMemo(() => issues.filter((i) => !i.resolved).length, [issues]);

  function add() {
    const text = draft.trim();
    if (!text) return;
    setIssues((prev) => [
      { id: makeId(), text: text.slice(0, 240), resolved: false, at: Date.now() },
      ...prev,
    ]);
    setDraft('');
  }

  function toggle(id: string) {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, resolved: !i.resolved } : i)));
  }

  function remove(id: string) {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} /> Issues
          log
        </h3>
        <span className="rounded-full bg-ink/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {openCount} open
        </span>
      </div>
      <p className="mt-2 text-sm text-ink/65">
        Track anything that comes up on the day — a late supplier, a swap, a delay — and clear it once
        it&rsquo;s handled. Private to you, on this device.
      </p>

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
          maxLength={240}
          placeholder="Log an issue…"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Log
        </button>
      </div>

      <ul className="mt-4 space-y-1.5">
        {issues.length === 0 ? (
          <li className="rounded-xl border border-dashed border-ink/15 px-3 py-4 text-center text-sm text-ink/45">
            All clear — nothing logged yet.
          </li>
        ) : (
          issues.map((i) => (
            <li
              key={i.id}
              className="group flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => toggle(i.id)}
                aria-pressed={i.resolved}
                aria-label={i.resolved ? `Reopen issue` : `Mark issue resolved`}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                  i.resolved
                    ? 'border-success-400 bg-success-500 text-white'
                    : 'border-ink/25 bg-white text-transparent hover:border-terracotta'
                }`}
              >
                <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <span
                className={`flex-1 text-sm ${i.resolved ? 'text-ink/40 line-through' : 'text-ink/80'}`}
              >
                {i.text}
              </span>
              <button
                type="button"
                onClick={() => remove(i.id)}
                aria-label="Remove issue"
                className="shrink-0 rounded-md p-1 text-ink/30 opacity-0 transition hover:bg-ink/5 hover:text-warn-600 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
