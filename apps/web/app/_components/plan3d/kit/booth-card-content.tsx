'use client';

/**
 * kit/booth-card-content — the KIND-AWARE list section inside the booth vendor
 * card (booth-kit slice 4; consumes the `cardKind` every booth template
 * carries). A caterer's booth reads as a "Menu", a band's as a "Set list", a
 * bar's as "On the bar", everything else as the default "What's included" —
 * one Array<{label}> data shape for all four kinds, fetched server-side per
 * surface via `fetchBoothCardItems` (lib/vendor-services). An included line is
 * WORDS ONLY — no peso beside it (owner 11 Nov 2026: "The inclusions should not
 * have a price"; a priced thing is its own service card). Pure presentational —
 * no DB, no state.
 */

import type { BoothCardItem } from '@/lib/seating-3d';
import type { BoothCardKind } from './booth-templates';

const KIND_HEADINGS: Record<BoothCardKind, string> = {
  menu: 'Menu',
  songlist: 'Set list',
  drinks: 'On the bar',
  inclusions: 'What’s included',
};

export function BoothCardContent({ kind, items }: { kind: BoothCardKind; items: BoothCardItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{KIND_HEADINGS[kind]}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={`${it.label}-${i}`} className="text-sm leading-relaxed text-ink/80">
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
