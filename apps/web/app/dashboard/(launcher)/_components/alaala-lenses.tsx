'use client';

import { useState, type ReactNode } from 'react';

/**
 * AlaalaLenses — the lens chips inside the obsidian Alaala tile
 * (owner-approved final home design 2026-07-15: Recent · Owned · Attended ·
 * People · With me).
 *
 * Pure client-side show/hide over SERVER-RENDERED lens bodies: the server tile
 * renders every body once and passes them as ReactNodes (the launcher's
 * Expandable idiom — data fetching stays in Server Components; this island
 * owns only the selected-chip state). Deterministic, zero network.
 */

export type AlaalaLensKey = 'recent' | 'owned' | 'attended' | 'people' | 'with_me';

const LENSES: Array<{ key: AlaalaLensKey; label: string }> = [
  { key: 'recent', label: 'Recent' },
  { key: 'owned', label: 'Owned' },
  { key: 'attended', label: 'Attended' },
  { key: 'people', label: 'People' },
  { key: 'with_me', label: 'With me' },
];

export function AlaalaLenses({
  bodies,
}: {
  bodies: Record<AlaalaLensKey, ReactNode>;
}) {
  const [active, setActive] = useState<AlaalaLensKey>('recent');

  return (
    <div>
      <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
        Lenses
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Alaala lenses">
        {LENSES.map((lens) => {
          const on = lens.key === active;
          return (
            <button
              key={lens.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(lens.key)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                on
                  ? 'bg-terracotta text-ink'
                  : 'border border-white/20 text-white/75 hover:bg-white/10'
              }`}
            >
              {lens.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-white/60">
        {bodies[active]}
      </div>
    </div>
  );
}
