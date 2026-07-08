'use client';

/**
 * kit/booth-card-content — the KIND-AWARE list section inside the booth vendor
 * card (booth-kit slice 4; consumes the `cardKind` every booth template
 * carries). A caterer's booth reads as a "Menu", a band's as a "Set list", a
 * bar's as "On the bar", everything else as the default "What's included" —
 * one Array<{label, worthPhp?}> data shape for all four kinds, fetched
 * server-side per surface via `fetchBoothCardItems` (lib/vendor-services).
 * Items with a stated peso worth render the marketplace's "₱X free" value
 * chip. Pure presentational — no DB, no state.
 */

import type { BoothCardItem } from '@/lib/seating-3d';
import type { BoothCardKind } from './booth-templates';

const KIND_HEADINGS: Record<BoothCardKind, string> = {
  menu: 'Menu',
  songlist: 'Set list',
  drinks: 'On the bar',
  inclusions: 'What’s included',
};

/** "₱2,500 free" — the inclusion's stated worth, whole pesos. */
function formatWorthPhp(worth: number): string {
  return `₱${worth.toLocaleString('en-PH', { maximumFractionDigits: 0 })} free`;
}

export function BoothCardContent({ kind, items }: { kind: BoothCardKind; items: BoothCardItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{KIND_HEADINGS[kind]}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li
            key={`${it.label}-${i}`}
            className="flex items-baseline justify-between gap-3 text-sm leading-relaxed text-ink/80"
          >
            <span className="min-w-0">{it.label}</span>
            {typeof it.worthPhp === 'number' && it.worthPhp > 0 ? (
              <span className="shrink-0 rounded-full bg-terracotta/10 px-2 py-0.5 text-[11px] font-medium text-terracotta">
                {formatWorthPhp(it.worthPhp)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
