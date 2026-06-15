'use client';

/**
 * SummaryAiToggle — the Summary tab's inline Setnayan AI switch (owner 2026-06-09).
 *
 * Replaces the old "Manage / Turn on" LINK to /details. The Summary is a
 * read-only cover with exactly ONE control: this toggle. Flipping it persists
 * `events.planning_mode` (guided ⇄ manual) via the shared `setPlanningMode`
 * server action — the SAME governing gate the match-criteria strip uses
 * (lib/setnayan-ai) — and does NOT navigate anywhere. Optimistic switch state
 * with a useTransition pending; the server revalidate re-grounds it.
 */

import { useOptimistic, useTransition } from 'react';
import { Gem } from 'lucide-react';
import { setPlanningMode } from '../../actions';

export function SummaryAiToggle({
  eventId,
  enabled,
}: {
  eventId: string;
  /** Current Setnayan AI state (model.personalizationEnabled). */
  enabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(enabled);

  function flip() {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('mode', next ? 'guided' : 'manual');
      await setPlanningMode(fd);
    });
  }

  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-ink/70">
        <Gem className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden />
        Setnayan AI {optimistic ? 'is on' : 'is off'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label="Toggle Setnayan AI"
        onClick={flip}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          optimistic ? 'bg-terracotta' : 'bg-ink/20'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-paper shadow transition-transform ${
            optimistic ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </section>
  );
}
