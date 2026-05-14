'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';

/**
 * Stub: the full coordinator-broadcast feature (per iteration 0019
 * force-majeure / 0023 admin escalation) is not yet shipped. Renders the
 * eventual placeholder UI — last-broadcast preview + opt-in toggle — using
 * local state only so the surface is wired and visible.
 */
export function CoordinatorBroadcastCard() {
  const [optedIn, setOptedIn] = useState(true);

  return (
    <article className="space-y-3 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Megaphone aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Coordinator broadcast
        </p>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
          Coming soon
        </span>
      </header>

      <div className="rounded-md bg-cream/60 p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Last broadcast
        </p>
        <p className="mt-1 text-sm text-ink/55">
          No broadcast yet — your coordinator can send updates here on the day.
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-cream/60 px-3 py-2 text-sm">
        <span className="text-ink/70">Receive broadcasts on this device</span>
        <input
          type="checkbox"
          checked={optedIn}
          onChange={(e) => setOptedIn(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-terracotta"
        />
      </label>

      <p className="text-[11px] text-ink/45">
        Composer ships with iteration 0019 (force-majeure comms) and 0023
        (admin escalation).
      </p>
    </article>
  );
}
