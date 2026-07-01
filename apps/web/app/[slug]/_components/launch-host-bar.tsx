'use client';

import { useState, useTransition } from 'react';
import { Rocket, Wand2, Check, Loader2, Eye } from 'lucide-react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { setLaunchMode } from '../actions';

/**
 * LaunchHostBar — a fixed, HOST-ONLY control bar on the couple's own live
 * website (owner 2026-07-02: "a manual toggle to set it automatic or manual
 * launch … activating one will deactivate the other … save the date, rsvp,
 * event and editorial").
 *
 * The couple reaches their live site via the dashboard "Launch" nav (PR #2556)
 * and flips it IN CONTEXT:
 *   • Automatic — the phase follows the event date (getLifecyclePhase).
 *   • Manual    — pin ONE phase; it stays live for every visitor until switched.
 * It's a single-select segmented control (Auto + the 4 phases), so choosing one
 * deactivates the rest. Only couples see it (page.tsx isCoupleHost gate); the
 * write is couple-gated again server-side (setLaunchMode → couple_can_update_event).
 *
 * Optimistic: the selection paints immediately, the server action persists +
 * revalidates the public page so guests pick up the change on their next load.
 */

const PHASES: { key: LifecyclePhase; label: string }[] = [
  { key: 'save_the_date', label: 'Save the Date' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'event', label: 'Event Day' },
  { key: 'editorial', label: 'Editorial' },
];

const PHASE_LABEL: Record<LifecyclePhase, string> = {
  save_the_date: 'Save the Date',
  rsvp: 'RSVP',
  event: 'Event Day',
  editorial: 'Editorial',
};

export function LaunchHostBar({
  eventId,
  slug,
  mode,
  manualPhase,
  autoPhase,
}: {
  eventId: string;
  slug: string;
  mode: 'auto' | 'manual';
  manualPhase: LifecyclePhase | null;
  autoPhase: LifecyclePhase;
}) {
  const [selMode, setSelMode] = useState<'auto' | 'manual'>(mode);
  const [selPhase, setSelPhase] = useState<LifecyclePhase | null>(manualPhase);
  const [pending, startTransition] = useTransition();

  function choose(next: 'auto' | LifecyclePhase) {
    // Optimistic paint, then persist. On failure, roll the UI back to the last
    // server-confirmed choice (the props) so the bar never lies about state.
    const prevMode = selMode;
    const prevPhase = selPhase;
    if (next === 'auto') {
      if (selMode === 'auto') return;
      setSelMode('auto');
    } else {
      if (selMode === 'manual' && selPhase === next) return;
      setSelMode('manual');
      setSelPhase(next);
    }
    startTransition(async () => {
      const res =
        next === 'auto'
          ? await setLaunchMode(eventId, slug, 'auto')
          : await setLaunchMode(eventId, slug, 'manual', next);
      if (!res?.ok) {
        setSelMode(prevMode);
        setSelPhase(prevPhase);
      }
    });
  }

  const autoActive = selMode === 'auto';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-3">
      <div className="pointer-events-auto max-w-full rounded-2xl border border-white/10 bg-ink/95 text-cream shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="hidden shrink-0 items-center gap-1.5 pr-1 text-[11px] font-medium uppercase tracking-[0.15em] text-cream/55 sm:inline-flex">
            <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Only you
          </span>

          <div
            role="radiogroup"
            aria-label="Website launch mode"
            className="flex items-center gap-1 overflow-x-auto"
          >
            {/* Automatic */}
            <button
              type="button"
              role="radio"
              aria-checked={autoActive}
              disabled={pending}
              onClick={() => choose('auto')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                autoActive
                  ? 'bg-cream text-ink'
                  : 'text-cream/80 hover:bg-white/10 hover:text-cream'
              }`}
            >
              <Rocket aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              <span className="flex flex-col items-start leading-tight">
                <span>Automatic</span>
                <span
                  className={`text-[10px] font-normal ${autoActive ? 'text-ink/55' : 'text-cream/45'}`}
                >
                  now: {PHASE_LABEL[autoPhase]}
                </span>
              </span>
            </button>

            <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-white/15" />

            <span className="hidden shrink-0 items-center gap-1 pl-0.5 pr-1 text-[11px] text-cream/45 md:inline-flex">
              <Wand2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Manual
            </span>

            {/* Manual phase pins */}
            {PHASES.map((p) => {
              const active = !autoActive && selPhase === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={pending}
                  onClick={() => choose(p.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                    active
                      ? 'bg-terracotta text-white'
                      : 'text-cream/80 hover:bg-white/10 hover:text-cream'
                  }`}
                >
                  {active ? (
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
                  ) : null}
                  {p.label}
                </button>
              );
            })}

            {pending ? (
              <Loader2
                aria-hidden
                className="ml-1 h-4 w-4 shrink-0 animate-spin text-cream/60"
                strokeWidth={2}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
