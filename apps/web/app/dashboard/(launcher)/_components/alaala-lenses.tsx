'use client';

import { useState, type ReactNode } from 'react';

/**
 * AlaalaLenses — the five owner-approved lens chips (2026-07-15: Recent ·
 * Owned · Attended · People · With me) over Alaala's memory wall.
 *
 * Pure client-side show/hide over SERVER-RENDERED lens bodies: the wall renders
 * every body once and passes them as ReactNodes (the launcher's Expandable
 * idiom — data fetching stays in Server Components; this island owns only the
 * selected-chip state). Deterministic, zero network, one read for five answers.
 *
 * ── WHY IT MOVED OUT OF THE OBSIDIAN TILE (2026-08-13) ─────────────────────
 * It used to sit inside the Alaala·Life-Flash tile, in a 64px text slot, on
 * `sm:` and up only — so the lens bodies could only ever be SENTENCES, and on a
 * phone the lenses did not exist at all. Sentences about events are what made
 * Alaala read as a second list of events. A wall of photographs does not fit in
 * a caption, so the lenses now own the full width beneath the tile, on every
 * screen size. The tile keeps the one job it was drawn for: Life-Flash.
 *
 * `count` is optional and is rendered ONLY when it is a positive number: `null`
 * means NOT MEASURED and 0 on a chip reads as a rebuke on somebody's memories.
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
  counts,
  partial = false,
}: {
  bodies: Record<AlaalaLensKey, ReactNode>;
  counts?: Partial<Record<AlaalaLensKey, number | null>>;
  /** A source hit its fetch ceiling ⇒ render `N+`, never a bare total. */
  partial?: boolean;
}) {
  const [active, setActive] = useState<AlaalaLensKey>('recent');

  return (
    <div>
      <div
        className="flex flex-wrap gap-[7px]"
        role="tablist"
        aria-label="Alaala lenses"
      >
        {LENSES.map((lens) => {
          const on = lens.key === active;
          const count = counts?.[lens.key];
          const showCount = typeof count === 'number' && count > 0;
          return (
            <button
              key={lens.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(lens.key)}
              className={`sn-press inline-flex items-center gap-1.5 rounded-full border px-[13px] py-[7px] text-xs transition-[background-color,border-color,color] duration-200 ${
                on
                  ? 'sn-chip-pop border-transparent bg-terracotta font-extrabold text-[color:var(--sn-ink-black)]'
                  : 'border-ink/12 bg-white/60 font-semibold text-ink/70 hover:bg-white'
              }`}
            >
              {lens.label}
              {showCount ? (
                <span
                  className={`font-mono text-[10px] ${
                    on ? 'text-[color:var(--sn-ink-black)]/60' : 'text-ink/40'
                  }`}
                >
                  {count}
                  {partial ? '+' : ''}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {/* `key` remount re-triggers the lens-body cross-fade per switch. */}
      <div key={active} className="sn-lens-swap mt-3.5">
        {bodies[active]}
      </div>
    </div>
  );
}
