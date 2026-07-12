'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * FeatureAccordion — the one-page vendor-hub accordion (owner-locked
 * 2026-07-12: "no button hyperlinks · same as profile that expands and
 * collapses · one page access, everything integrated").
 *
 * Extends the ManageTiles pattern to the whole hub: the hub's HOME body
 * renders eagerly above this; every FOLDED feature (Contracts, Earnings,
 * Bookings, …) is a collapsible section here. ONE open at a time, driven by
 * the `?open=<key>` search param — so opening a section is a soft navigation
 * that renders ONLY that section's server body (its DB queries run on expand,
 * not on page load). The server wraps that body in <Suspense> so a skeleton
 * streams while it loads; `children` is that single open body, dropped in
 * under the matching header.
 *
 * Visual language: Atelier glass card + chevron affordance, identical to the
 * profile Manage tiles. No hyperlinks — a header is a <button> that toggles
 * the section in place.
 */
export type AccordionSection = {
  key: string;
  label: string;
  sub?: string;
  icon?: ReactNode;
};

export function FeatureAccordion({
  sections,
  openKey,
  children,
}: {
  sections: AccordionSection[];
  openKey: string | null;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const toggle = (k: string) => {
    const p = new URLSearchParams(Array.from(params.entries()));
    if (openKey === k) {
      p.delete('open');
    } else {
      p.set('open', k);
      // Legacy alias — old redirect stubs land on ?tab=; once the user
      // interacts we speak ?open= only, so drop the stale alias.
      p.delete('tab');
    }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 px-4 pb-10 sm:px-6 lg:px-8 xl:max-w-7xl 2xl:max-w-screen-2xl">
      {sections.map((s) => {
        const isOpen = openKey === s.key;
        return (
          <div
            key={s.key}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 shadow-sm backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => toggle(s.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white"
            >
              {s.icon ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                  {s.icon}
                </span>
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">
                  {s.label}
                </span>
                {s.sub ? (
                  <span className="mt-0.5 block truncate text-[12.5px] text-ink/55">
                    {s.sub}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                aria-hidden
                className={`h-5 w-5 shrink-0 text-ink/40 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
                strokeWidth={1.75}
              />
            </button>
            {isOpen ? (
              <div className="border-t border-ink/10 bg-cream/40">{children}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Streaming skeleton for a section body while its server render loads. */
export function AccordionSkeleton() {
  return (
    <div className="space-y-3 px-5 py-6" aria-hidden>
      <div className="h-5 w-40 animate-pulse rounded-md bg-ink/10" />
      <div className="h-24 animate-pulse rounded-xl bg-ink/[0.06]" />
      <div className="h-24 animate-pulse rounded-xl bg-ink/[0.06]" />
    </div>
  );
}
