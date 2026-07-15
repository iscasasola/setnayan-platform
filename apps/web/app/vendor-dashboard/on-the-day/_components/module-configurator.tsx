'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { saveDayOfModules } from '../actions';

export type ConfiguratorModule = {
  id: string;
  label: string;
  blurb: string;
  enabled: boolean;
  /** Behind the DPO/NPC consent ruling — shown but not switchable yet. */
  counselGated?: boolean;
};

/**
 * Step 2 of the launcher — activate/deactivate the day-of modules for one
 * booking. Optimistic toggles persisted to `vendor_dayof_configs` via
 * saveDayOfModules. Counsel-gated modules render locked ("Needs setup") until
 * the consent gate ships — they can't be switched on here.
 */
export function ModuleConfigurator({
  eventId,
  modules,
}: {
  eventId: string;
  modules: ConfiguratorModule[];
}) {
  const [state, setState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(modules.map((m) => [m.id, m.enabled])),
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persist(next: Record<string, boolean>) {
    const enabledIds = Object.entries(next)
      .filter(([, on]) => on)
      .map(([id]) => id);
    startTransition(async () => {
      const res = await saveDayOfModules(eventId, enabledIds);
      if (res.ok) {
        setError(null);
        setSavedAt(Date.now());
      } else {
        setError(res.error ?? 'Could not save.');
      }
    });
  }

  function toggle(id: string, gated: boolean | undefined) {
    if (gated) return;
    setState((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persist(next);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="sn-sec">Set up your day-of app</h2>
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {pending ? (
            <>
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} /> Saving…
            </>
          ) : savedAt ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Saved
            </>
          ) : null}
        </span>
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
        Turn on only what you’ll use on the day. Your choices are saved per event.
      </p>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--sn-danger, #b42318)' }}>
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {modules.map((m) => {
          const on = state[m.id] ?? false;
          const gated = Boolean(m.counselGated);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => toggle(m.id, gated)}
                aria-pressed={on}
                disabled={gated || pending}
                className="sn-tile flex w-full items-start justify-between gap-4 text-left transition disabled:opacity-100"
                style={{ cursor: gated ? 'default' : 'pointer' }}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                      {m.label}
                    </span>
                    {gated ? (
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
                      >
                        <Lock aria-hidden className="h-3 w-3" strokeWidth={2} /> Needs setup
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm" style={{ color: 'var(--m-slate-2)' }}>
                    {m.blurb}
                  </span>
                </span>
                {/* Switch */}
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition"
                  style={{
                    background: on && !gated ? 'var(--m-ink)' : 'var(--m-line)',
                    justifyContent: on && !gated ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: 'var(--m-paper)' }} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
