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
import { Screen, Sk } from '@/components/skeletons';

export default function EventSectionLoading() {
  return (
    <Screen label="Loading your event">
      {/* Welcome header — couple's name */}
      <div className="space-y-2">
        <Sk className="h-10 w-64 max-w-full rounded-md" />
        <Sk className="h-4 w-48 rounded" />
      </div>

      {/* Auspicious chip · event meta line */}
      <div className="flex flex-wrap items-center gap-2">
        <Sk className="h-7 w-32 rounded-full" />
        <Sk className="h-5 w-56 rounded" />
      </div>

      {/* Stage strip — 6-pip lifecycle bar */}
      <div className="flex items-center gap-2 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Sk key={i} className="h-2 flex-1 rounded-full" />
        ))}
      </div>

      {/* Budget countdown panel */}
      <Sk className="h-24 rounded-2xl" />

      {/* Finalized vendor chip strip */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-10 w-32 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Marketplace tease */}
      <Sk className="h-40 rounded-2xl" />

      {/* Planning groups — eyebrow + 12-tile grid */}
      <div className="space-y-3">
        <Sk className="h-3 w-56 rounded" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <li key={i}><Sk className="h-28 rounded-xl" /></li>
          ))}
        </ul>
      </div>

      {/* Your plan — eyebrow + 9-tile grid */}
      <div className="space-y-3">
        <Sk className="h-3 w-40 rounded" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <li key={i}><Sk className="h-24 rounded-xl" /></li>
          ))}
        </ul>
      </div>

      {/* Nav grid — eyebrow + 8-tile grid */}
      <div className="space-y-3">
        <Sk className="h-3 w-32 rounded" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}><Sk className="h-20 rounded-xl" /></li>
          ))}
        </ul>
      </div>

      {/* MoneyInFlight · UpcomingSchedules · ActivityFeed */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Sk key={i} className="h-32 rounded-2xl" />
      ))}
    </Screen>
  );
}
