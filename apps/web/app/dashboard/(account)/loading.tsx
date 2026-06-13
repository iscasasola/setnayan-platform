/**
 * Skeleton shell rendered while non-event-scoped `/dashboard/*` pages
 * are still server-rendering. Sibling to `[eventId]/loading.tsx` — that
 * one mirrors the event-home page shape (rewritten 2026-05-30 02:08
 * PHT in commit 34c4e92 against the same owner directive); this one
 * covers everything else mounted under `/dashboard/*`:
 *
 *   • `/dashboard` itself — the dashboard root that runs auth check +
 *     fetchUserEvents then redirects to `/dashboard/[eventId]` (most
 *     common) OR `/dashboard/create-event` (zero events + admin/vendor
 *     role) OR renders an empty-state CTA (zero events + customer only).
 *     During the brief moment before the server decides the redirect
 *     target this skeleton renders — typically <500ms but the most
 *     load-bearing transitional moment in the whole post-login chain.
 *   • `/dashboard/profile` — profile settings.
 *   • `/dashboard/notifications` — notifications list.
 *   • `/dashboard/create-event` — event creation form with type picker.
 *   • `/dashboard/api-keys` — API key listing.
 *
 * Owner directive 2026-05-30 — "why does loading take so much time when
 * someone logs in, unlike Facebook?" The architectural answer (already
 * documented on `[eventId]/loading.tsx`) is that Facebook streams app
 * shell from a CDN edge instantly then fills data in afterward, while
 * we wait for ~10+ Supabase queries (~50-200ms RTT each from Singapore)
 * before sending HTML. This skeleton closes the perceived-speed gap by
 * surfacing structured chrome within ~100-200ms of navigation (Next.js
 * uses this as the Suspense fallback while `page.tsx` server-renders).
 * Total time-to-data is unchanged — the wait now feels structured
 * instead of blank.
 *
 * Pre-2026-05-30 this file rendered 3 generic stacked pulse cards under
 * a 3-line header — too arbitrary, didn't feel like "we're getting your
 * dashboard ready", felt nearly broken during the post-login transition.
 * Rewrite mirrors the visual weight of `[eventId]/loading.tsx` so the
 * two skeletons feel sibling-quality regardless of which `/dashboard/*`
 * route a host lands on.
 *
 * Shape rationale — generic-but-structured so it maps cleanly onto
 * every non-event `/dashboard/*` surface without pretending to be any
 * specific one:
 *   1. Header strip — eyebrow + title + subtitle stub, matches the
 *      page-header pattern used by `/profile` + `/create-event` +
 *      `/notifications` + `/api-keys`.
 *   2. Primary panel — wide rounded card, reads as a "current focus"
 *      area: the create-event tile picker, the profile-edit form, the
 *      next-event card on dashboard root, etc.
 *   3. Section eyebrow + 2-card row — covers profile sub-sections,
 *      notifications grouped by date, API-key entries.
 *   4. Three stacked panels — generic list-or-form continuation.
 *
 * Palette uses `ink/[N]` opacity classes — the Facebook brand pivot
 * per CLAUDE.md 2026-05-22 row, then remapped to Clean Editorial values
 * (Warm Alabaster background + Deep Obsidian ink) via the CSS-var
 * token swap from CLAUDE.md 2026-05-29 + 2026-05-30 unification rows.
 * `bg-ink/[0.05]` resolves to Deep Obsidian at 5% opacity sitting on
 * the parent layout's `bg-cream` (Warm Alabaster) — a soft warm grey
 * skeleton tone that matches the production app chrome without
 * importing any new tokens. Matches `[eventId]/loading.tsx` palette
 * verbatim so the two skeletons feel coherent during the brief
 * `/dashboard` → `/dashboard/[eventId]` transition.
 *
 * `aria-busy="true"` + `aria-live="polite"` mirror the event-home
 * sibling — screen readers announce "busy" while skeleton paints and
 * auto-update once the real content swaps in.
 *
 * Child routes (e.g. `/dashboard/profile/concierge`) currently inherit
 * this skeleton because they don't ship their own loading.tsx. If a
 * child route's shape diverges materially, add a route-local
 * loading.tsx — this file remains the dashboard-scope default.
 */
export default function DashboardLoading() {
  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Header strip — eyebrow + title + subtitle. Sized to typical
       *  page-header copy lengths used on /profile + /create-event +
       *  /notifications + /api-keys + dashboard root. */}
      <header className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-ink/[0.07]" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-md bg-ink/[0.07]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-ink/[0.05]" />
      </header>

      {/* Primary panel — wide rounded card reads as a "current focus"
       *  area: the create-event tile picker, the profile-edit form, the
       *  next-event card on dashboard root, etc. */}
      <div className="h-36 animate-pulse rounded-2xl border border-ink/10 bg-ink/[0.03]" />

      {/* Section eyebrow + 2-card row — covers profile sub-sections,
       *  notifications grouped by date, API-key entries. */}
      <div className="space-y-3">
        <div className="h-3 w-40 animate-pulse rounded bg-ink/[0.07]" />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="h-28 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
            />
          ))}
        </ul>
      </div>

      {/* Three stacked panels — generic list-or-form continuation. */}
      <ul className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="h-20 animate-pulse rounded-xl border border-ink/10 bg-ink/[0.03]"
          />
        ))}
      </ul>
    </section>
  );
}
