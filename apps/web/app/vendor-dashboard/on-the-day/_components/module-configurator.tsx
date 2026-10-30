'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Explain } from '@/app/_components/explain';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { saveDayOfModules } from '../actions';

export type ConfiguratorModule = {
  id: string;
  label: string;
  blurb: string;
  enabled: boolean;
  /** Behind the DPO/NPC consent ruling — shown but not switchable yet. */
  counselGated?: boolean;
  /** Optional derived-state badge (e.g. the Papic tier: "Papic Ltd · 70 pts"). */
  readout?: string;
};

/**
 * Step 2 of the launcher — activate/deactivate the day-of modules for one
 * booking. Optimistic toggles persisted to `vendor_dayof_configs` via
 * saveDayOfModules. Counsel-gated modules render locked ("Needs setup") until
 * the consent gate ships — they can't be switched on here.
 *
 * 🗓 v13 (owner "Approved." 2026-10-29): Hub › Set up › "Tools for this event" — one hairline row per tool, its name and
 * one line, the longer words behind its ⓘ, the house switch on the right (prototype `hubSetup`). Same action, same saves.
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
    <div data-hub-tools="">
      <div className="flex items-center justify-between gap-2 pt-4">
        <p className="home-k2">Tools for this event</p>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[12px] text-ink/55" aria-live="polite">
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
          <Explain title="Tools for this event">
            Filled from what this event booked you for. Turn on only what you’ll use on the day — your choices are saved
            for this event only.
          </Explain>
        </span>
      </div>
      {error ? (
        <p role="alert" className="py-2 text-[13px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
      <FormRows data="hub-tools">
        {modules.map((m) => {
          const on = state[m.id] ?? false;
          const gated = Boolean(m.counselGated);
          return (
            <FormRow
              key={m.id}
              name={m.label}
              about={{ words: m.blurb }}
              line={gated ? 'Needs setup' : (m.readout ?? null)}
              attrs={{ 'data-hub-tool': m.id }}
            >
              <button
                type="button"
                role="switch"
                aria-checked={on && !gated}
                aria-label={m.label}
                onClick={() => toggle(m.id, gated)}
                disabled={gated || pending}
                className={SWITCH_BUTTON}
              >
                <SwitchTrack on={on && !gated} />
              </button>
            </FormRow>
          );
        })}
      </FormRows>
    </div>
  );
}
