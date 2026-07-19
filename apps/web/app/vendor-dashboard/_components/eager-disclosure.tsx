'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { Collapsible } from './collapsible';

/**
 * EagerDisclosure — a single collapsible section whose body is rendered
 * eagerly (server-side, passed as `children`) and toggled purely client-side,
 * with NO navigation. Same chevron-card look as FeatureAccordion.
 *
 * Use this (instead of the lazy FeatureAccordion) when a hub's HOME body is
 * very expensive and there's only ONE cheap folded section: re-navigating to
 * lazy-load that section would re-run the heavy home loader, so it's cheaper
 * to render the light section eagerly and just show/hide it. (My Performance:
 * home ≈ 25 queries, Demand ≈ 3 — eager wins.)
 */
export function EagerDisclosure({
  label,
  sub,
  icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  sub?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white"
        >
          {icon ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{label}</span>
            {sub ? (
              <span className="mt-0.5 block truncate text-[12.5px] text-ink/55">
                {sub}
              </span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden
            className={`h-5 w-5 shrink-0 text-ink/40 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            strokeWidth={1.75}
          />
        </button>
        <Collapsible open={open}>
          <div className="border-t border-ink/10 bg-cream/40">{children}</div>
        </Collapsible>
      </div>
    </div>
  );
}
