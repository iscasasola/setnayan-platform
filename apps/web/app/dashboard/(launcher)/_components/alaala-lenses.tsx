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
      <p className="mb-[9px] text-[10px] font-normal uppercase tracking-[0.14em] text-terracotta-100/50">
        Lenses
      </p>
      <div
        className="flex flex-wrap gap-[7px]"
        role="tablist"
        aria-label="Alaala lenses"
      >
        {LENSES.map((lens) => {
          const on = lens.key === active;
          return (
            <button
              key={lens.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(lens.key)}
              className={`rounded-full border px-[11px] py-1.5 text-xs transition-[background-color,border-color,color] duration-200 ${
                on
                  ? 'sn-chip-pop border-transparent bg-terracotta font-extrabold text-[color:var(--sn-ink-black)]'
                  : 'border-white/[0.16] bg-white/10 font-semibold text-terracotta-100/80 hover:bg-white/[0.18]'
              }`}
            >
              {lens.label}
            </button>
          );
        })}
      </div>
      {/* `key` remount re-triggers the lens-body cross-fade per switch. */}
      <div
        key={active}
        className="sn-lens-swap mt-3.5 min-h-16 text-xs leading-normal text-terracotta-100/60"
      >
        {bodies[active]}
      </div>
    </div>
  );
}
