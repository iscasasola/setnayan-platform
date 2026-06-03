/**
 * Guests-tab loading shell. Mirrors guests/page.tsx so the tap into the Guest
 * list paints an instantly-recognisable shape instead of inheriting the
 * event-home skeleton (the wrong shape) from the parent loading.tsx.
 *
 * Owner directive 2026-06-03 — "why is it so slow to transfer to guests from
 * summary". Root cause was a frozen tap: the route blocked on its server reads
 * with no route-local instant state. This file IS that instant state (Next.js
 * renders it as the Suspense fallback the moment navigation begins).
 *
 * Replicates the page's mobile chrome exactly — the injected `.shell-topbar`
 * hide + the safe-area top padding — so there's zero layout jump when the real
 * list streams in.
 */
import { RowSkeleton, Sk } from '@/components/skeletons';

export default function GuestsLoading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="-mt-6 space-y-6 pt-[calc(env(safe-area-inset-top)+3.25rem)] lg:pt-0"
    >
      <span className="sr-only">Loading guests…</span>
      <style>{`.shell-topbar{display:none}`}</style>

      {/* mobile back-X placeholder (fixed, matches the real exit affordance) */}
      <span className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 h-9 w-9 rounded-full bg-ink/[0.06] lg:hidden" />

      {/* Desktop-only chrome — header · team segment · RSVP stats · seating · toolbar */}
      <div className="hidden space-y-6 lg:block">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Sk className="h-3 w-20 rounded" />
            <Sk className="h-9 w-40 rounded-md" />
          </div>
          <div className="flex gap-2">
            <Sk className="h-11 w-28 rounded-md" />
            <Sk className="h-11 w-32 rounded-md" />
          </div>
        </div>

        {/* Team Bride / Team Groom / Everyone segment */}
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-11 w-full max-w-[170px] rounded-full" />
          ))}
        </div>

        {/* RSVP stats strip — 5 count cards */}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="rounded-lg border border-ink/10 p-3">
              <Sk className="h-2.5 w-14 rounded" />
              <Sk className="mt-2 h-6 w-9 rounded-full" />
            </li>
          ))}
        </ul>

        {/* Seating shortcut + search/sort toolbar */}
        <Sk className="h-16 w-full rounded-xl" />
        <div className="flex gap-2">
          <Sk className="h-11 flex-1 rounded-md" />
          <Sk className="h-11 w-56 rounded-md" />
        </div>
      </div>

      {/* Sidebar (desktop) + guest rows */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-4 lg:block">
          <Sk className="h-3 w-16 rounded" />
          {Array.from({ length: 7 }).map((_, i) => (
            <Sk key={i} className="h-8 w-full rounded-md" />
          ))}
        </aside>

        <div className="min-w-0 space-y-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
