/**
 * Skeleton shell rendered while `apps/web/app/dashboard/[eventId]/page.tsx`
 * (event home) and any child route without its own loading.tsx are still
 * waiting on the server.
 *
 * Owner directive 2026-05-30 — "why does loading take so much time when
 * someone logs in, unlike Facebook?" Architectural answer documented in
 * CLAUDE.md 2026-05-30 row "loading.tsx skeleton mirrors event-home
 * layout": Facebook ships an app shell from a CDN edge instantly, then
 * streams data in afterward. We wait for ~10+ Supabase queries (~50-200ms
 * RTT each from Singapore) and only send HTML once everything is ready.
 *
 * This skeleton closes the perceived-speed gap by surfacing the structured
 * event-home shell within ~100-200ms of navigation (Next.js's automatic
 * Suspense boundary uses this as fallback while `page.tsx` renders).
 * Total time-to-data is unchanged (~500-1000ms) — the wait now feels
 * structured instead of blank. PR #567 from 2026-05-28 already collapsed
 * 4 sequential round trips to 2 (~150-600ms saved per render); this row
 * is the visible-feedback half of the same fix.
 *
 * Shape mirrors the event-home render order from page.tsx lines
 * 1600-1853 (WelcomeHeader → AuspiciousChip → EventMetaLine → StageStrip
 * → BudgetCountdownHeader → FinalizedChipStrip → MarketplaceTeaseStrip
 * → PlanningGroups 12-card grid → YourPlanSection 9-tile grid → NavGrid
 * 8-tile grid → MoneyInFlight → UpcomingSchedules → ActivityFeed).
 *
 * Palette uses `ink/[N]` opacity classes — the Facebook brand pivot per
 * CLAUDE.md 2026-05-22 row — NOT the `--m-*` marketing-site tokens.
 *
 * Child routes (/guests · /vendors · /budget · etc.) currently inherit
 * this skeleton because they don't ship their own loading.tsx. If a
 * child route's shape diverges materially, add a route-local
 * loading.tsx — this file remains the event-scope default.
 */
export default function EventSectionLoading() {
  return (
    <section className="space-y-6" aria-busy="true" aria-live="polite">
      {/* Welcome header — couple's name in Saira Condensed display register.
       *  Larger pulse block sized to typical couple-name lengths. */}
      <div className="space-y-2">
        <div className="h-10 w-64 max-w-full animate-pulse rounded-md bg-ink/[0.07]" />
        <div className="h-4 w-48 animate-pulse rounded bg-ink/[0.05]" />
      </div>

      {/* Auspicious chip · event meta line — small status pills. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-7 w-32 animate-pulse rounded-full bg-ink/[0.05]" />
        <div className="h-5 w-56 animate-pulse rounded bg-ink/[0.05]" />
      </div>

      {/* Stage strip — 6-pip lifecycle indicator. */}
      <div className="flex items-center gap-2 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 animate-pulse rounded-full bg-ink/[0.07]"
          />
        ))}
      </div>

      {/* Budget countdown header — single rounded panel. */}
      <div className="h-24 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]" />

      {/* Finalized chip strip — horizontal scroll of locked-vendor pills. */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-32 shrink-0 animate-pulse rounded-full bg-ink/[0.05]"
          />
        ))}
      </div>

      {/* Marketplace tease strip — large discovery card. */}
      <div className="h-40 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]" />

      {/* Planning groups — eyebrow + 12-card grid. */}
      <div className="space-y-3">
        <div className="h-3 w-56 animate-pulse rounded bg-ink/[0.07]" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <li
              key={i}
              className="h-28 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
            />
          ))}
        </ul>
      </div>

      {/* Your plan section — eyebrow + 9-tile grid. */}
      <div className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded bg-ink/[0.07]" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
            />
          ))}
        </ul>
      </div>

      {/* Nav grid — eyebrow + 8-tile grid. */}
      <div className="space-y-3">
        <div className="h-3 w-32 animate-pulse rounded bg-ink/[0.07]" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li
              key={i}
              className="h-20 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
            />
          ))}
        </ul>
      </div>

      {/* MoneyInFlight · UpcomingSchedules · ActivityFeed — three stacked panels. */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]"
        />
      ))}
    </section>
  );
}
