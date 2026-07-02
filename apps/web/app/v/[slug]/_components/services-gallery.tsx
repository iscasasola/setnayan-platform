'use client';

/**
 * ServicesGallery — the public vendor profile's "Services & pricing" gallery
 * with service-coverage filter chips (owner directive 2026-07-02: "Full gallery
 * of their Service Cards with filtering of what service coverage").
 *
 * Dumb client component: all label/price/meta formatting is done server-side in
 * ServicesPricingSection and passed as plain serializable data, so this file
 * needs no taxonomy imports. Chips filter by coverage group (the SERVICE_GROUPS
 * a vendor actually covers). The chip row only renders when a vendor spans more
 * than one coverage group — a single-group vendor has nothing to filter.
 */

import { useState } from 'react';

export type ServiceCard = {
  id: string;
  label: string;
  priceLabel: string;
  /** Crew / meal line, pre-joined server-side. null → no second line. */
  meta: string | null;
};

export type ServiceGroup = {
  key: string;
  label: string;
  cards: ServiceCard[];
};

const ALL = '__all__';

export function ServicesGallery({ groups }: { groups: ServiceGroup[] }) {
  const [active, setActive] = useState<string>(ALL);

  // Only offer filtering when there's more than one coverage group to switch
  // between; otherwise the chips are dead weight.
  const showChips = groups.length > 1;
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const visible = active === ALL ? groups : groups.filter((g) => g.key === active);

  return (
    <div className="space-y-5">
      {showChips ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter services by coverage">
          <FilterChip
            label="All"
            count={total}
            on={active === ALL}
            onClick={() => setActive(ALL)}
          />
          {groups.map((g) => (
            <FilterChip
              key={g.key}
              label={g.label}
              count={g.cards.length}
              on={active === g.key}
              onClick={() => setActive(g.key)}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-5">
        {visible.map((g) => (
          <div key={g.key} className="space-y-2">
            {/* Group label is redundant once a single coverage chip is active. */}
            {active === ALL ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                {g.label}
              </p>
            ) : null}
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.cards.map((c) => (
                <li key={c.id}>
                  <div className="rounded-xl border border-ink/10 bg-cream p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-ink">{c.label}</p>
                      <p className="font-mono text-sm text-ink/80">{c.priceLabel}</p>
                    </div>
                    {c.meta ? (
                      <p className="mt-1 text-[12px] text-ink/55">{c.meta}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
        on
          ? 'border-mulberry bg-mulberry text-cream'
          : 'border-ink/15 bg-cream text-ink/70 hover:border-mulberry/40 hover:text-ink'
      }`}
    >
      <span>{label}</span>
      <span className={on ? 'text-cream/70' : 'text-ink/40'}>{count}</span>
    </button>
  );
}
