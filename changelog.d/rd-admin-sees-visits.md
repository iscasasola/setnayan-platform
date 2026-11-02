## 2026-10-22 · feat(admin): Visits — site traffic in our own admin, no cookies, no banner

Owner, 22 Oct: the traffic stats belong in our own admin, not Vercel — no cookies and no banner. This adds a
**Visits** tab to Admin › App Performance (beside Overview), plus a menu item and ⌘K words ("traffic", "visitors").

- **Captured server-side, after the response** (`middleware.ts` → `after(() => recordSiteVisit(…))`,
  `lib/visits/record-visit.ts` + `visit-capture.ts`). One direct REST call to `record_site_visit` through the
  service role. Nothing runs in the browser and the shared bundle does not grow. Only the production
  deployment writes (`backgroundWritesAllowed`: a preview, or a builder's `next dev`, shares the prod database).
- **Never counted:** the App Store / Play shell (`isStoreShellSignals`; App Privacy says no analytics), bots /
  link previewers / Lighthouse, `/admin`, `/api`, `/auth`, `/dev`, prefetches, server actions, redirects, and a
  `router.refresh()` of the page you are already on. A full page load counts, and so does a move inside the app
  to a different page.
- **Stored** (migration `20271282829207_site_visits_daily.sql`): **daily aggregates only.** Each row is one
  Manila day plus the page's route pattern, the referrer domain, utm_source, phone/tablet/desktop, a two-letter
  country and a signed-in flag, holding a views count and a visitors count. Pages are stored as route patterns
  from the app's own route list: `/v/[slug]`, never the shop's name. Public marketing pages stay exact. No per-view rows. The
  visitor key is sha256(IP | user-agent), made in the middleware, and the database hashes it again with a
  random salt minted for that day. The first visit of the next day deletes that salt and every hash made with it,
  so two days can never be joined. No scheduler is needed: the purge happens on write. No cookie, no localStorage, no id.
- **RLS at CREATE:** `site_visit_days` is read-only for admins (`is_admin()`). The seen and salt tables have no
  policy and no grant. Both functions run as service_role only. The exposure baseline grows by the aggregate's
  admin-read lines, on purpose.
- **The tab** (`_surfaces/visits-surface.tsx` + `visits-view.tsx`): it uses the Growth tab's range control
  (`GROWTH_RANGE_OPTIONS`) and shows visitors, page views, sign-ups and paid orders. Below that come the
  visitors → sign-ups → paid orders line, a per-day chart, top pages, where visitors came from, phone or
  computer, and countries. A refused read says "Couldn't read …" and never shows 0. Demo mode draws badged
  illustrative figures. Lab: `/dev/visits-lab` (dev only).
- Guards: `lib/visits/visits-are-private.test.ts` (no counting in the store shell, no raw id in the write,
  every dynamic route templated, couldn't-read rendered) and `tests/db/site-visits.db.test.ts`.

SPEC IMPACT: DECISION_LOG row 2026-10-22 "VISITS IN OUR OWN ADMIN" (corpus). The App Performance plan
(`0023_admin_console/App_Performance_Plan_2026-07-03.md`) gains a first-party traffic tab.
