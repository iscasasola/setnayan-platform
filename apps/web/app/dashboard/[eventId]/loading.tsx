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
 * structured instead of blank.
 *
 * Shape mirrors the `<EventDashboard>` render order after the 2026-07-10
 * "Home IS the dashboard" rewrite (hero → briefing strip → at-a-glance
 * bento → journey rail → decisions board → around-your-event). The
 * pre-rewrite surfaces this file used to sketch (auspicious chip · budget
 * countdown panel · finalized vendor chip strip · planning-groups grids)
 * were retired with that rewrite — page-layer hygiene sweep 2026-07-12.
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
      {/* Hero — event name + date line + countdown */}
      <div className="space-y-2">
        <Sk className="h-10 w-64 max-w-full rounded-md" />
        <Sk className="h-4 w-48 rounded" />
      </div>

      {/* Briefing strip */}
      <Sk className="h-14 rounded-2xl" />

      {/* At-a-glance bento — 2×2 stat tiles */}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <Sk className="h-28 rounded-2xl" />
          </li>
        ))}
      </ul>

      {/* Journey rail — progress pips */}
      <div className="flex items-center gap-2 py-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Sk key={i} className="h-2 flex-1 rounded-full" />
        ))}
      </div>

      {/* Decisions board */}
      <div className="space-y-3">
        <Sk className="h-3 w-40 rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Sk key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Around your event — tile row */}
      <div className="space-y-3">
        <Sk className="h-3 w-52 rounded" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <Sk className="h-24 rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
