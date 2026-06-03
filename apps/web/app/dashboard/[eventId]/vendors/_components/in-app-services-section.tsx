/**
 * InAppServicesSection — compact add-ons launcher grid for the Services tab.
 *
 * Surfaced inside /dashboard/[eventId]/vendors (the "Services" tab) as a
 * clearly-headed section below the vendor plan+budget accordion. Provides a
 * second entry point into the in-app services without removing or hiding the
 * canonical /add-ons route.
 *
 * Data source: the ADD_ONS catalog from @/lib/add-ons-catalog — the single
 * source of truth shared with /add-ons/page.tsx. Never duplicates the list.
 *
 * Visual design: compact horizontal-scroll row of mini-cards on mobile; a
 * 4-column grid on desktop. Each mini-card uses the same per-service animated
 * poster background (base + motion layers) as the full-page poster grid, but
 * cropped to a smaller aspect-[3/2] landscape card so it fits tidily below the
 * accordion. Styling follows the Clean Editorial palette (cream/ink/terracotta/
 * mulberry) and reuses the poster-motion-* keyframe classes from globals.css.
 *
 * Server component — no client JS. Animations are pure CSS.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';

type Props = {
  eventId: string;
};

export function InAppServicesSection({ eventId }: Props) {
  // Show live + web_v1 add-ons in the compact grid. coming_soon cards are
  // omitted here (they're discoverable on the full /add-ons page) to keep
  // the section tidy and action-oriented inside the Services tab.
  const activeAddOns = ADD_ONS.filter((a) => a.status !== 'coming_soon');

  return (
    <section className="mt-10 space-y-4" aria-label="In-app services & add-ons">
      {/* Section heading */}
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Setnayan
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            In-app services &amp; add-ons
          </h2>
        </div>
        <Link
          href={`/dashboard/${eventId}/add-ons`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/12 bg-cream px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:border-ink/25 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          aria-label="View all in-app add-ons"
        >
          See all
          <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>

      {/* Mini-card grid — horizontal scroll on mobile, 4-col on desktop.
          Each card is a landscape crop of the full-page cinema poster so the
          visual language matches /add-ons while fitting the tight row. The
          poster-motion-* classes are defined in globals.css and drive the
          per-service CSS keyframe animation. */}
      <ul
        className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {activeAddOns.map((addon) => {
          const href = addOnHref(addon.key, eventId);
          const motionClass =
            addon.poster.motion === 'drift'
              ? 'poster-motion-drift'
              : addon.poster.motion === 'pulse'
                ? 'poster-motion-pulse'
                : 'poster-motion-scan';

          return (
            <li key={addon.key} className="shrink-0 sm:shrink">
              <Link
                href={href}
                className="group relative flex aspect-[3/2] min-w-[160px] flex-col overflow-hidden rounded-xl shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2 focus-visible:ring-offset-cream sm:min-w-0 sm:w-full"
                aria-label={addon.label}
              >
                {/* Base layer — service color */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: addon.poster.baseBackground }}
                />
                {/* Motion layer — animated gradient */}
                <div
                  aria-hidden
                  className={`absolute inset-0 ${motionClass}`}
                  style={{
                    background: addon.poster.motionBackground,
                    mixBlendMode: 'screen',
                  }}
                />
                {/* Lower-third gradient for text legibility */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/50 to-transparent"
                />

                {/* Top-left icon badge */}
                <div className="absolute left-3 top-3">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-white/20 backdrop-blur-md ${addon.poster.iconBadgeClass}`}
                  >
                    <addon.Icon
                      aria-hidden
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                  </span>
                </div>

                {/* Web V1 pill (top-right, only when applicable) */}
                {addon.status === 'web_v1' && (
                  <div className="absolute right-2.5 top-2.5">
                    <span className="rounded-full bg-cream/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-cream backdrop-blur-md">
                      Web V1
                    </span>
                  </div>
                )}

                {/* Lower-third text */}
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate text-sm font-semibold leading-tight text-cream">
                    {addon.label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-cream/80">
                    {addon.cta} <span aria-hidden>›</span>
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer link — full add-ons page for coming-soon items + details */}
      <p className="px-1 text-xs text-ink/45">
        More services launching soon.{' '}
        <Link
          href={`/dashboard/${eventId}/add-ons`}
          className="underline underline-offset-2 hover:text-ink/70"
        >
          View all add-ons
        </Link>
      </p>
    </section>
  );
}
