## 2026-07-10 · feat(dashboard): the event Home IS the dashboard

The couple's event Home (`/dashboard/[eventId]`) now renders the journey-rail /
decisions / around-your-event dashboard experience in place — formerly the
separate `/dashboard/[eventId]/progress` route.

- Extracted the entire dashboard body + all its data-loading into a shared
  server component `app/dashboard/[eventId]/_components/event-dashboard.tsx`
  (`<EventDashboard>`), verbatim: the AI gate (`aiActive = aiEntitled ||
  suriPreview`, real entitlement OR `?suri=preview` for internal accounts), all
  defensive fetches + `logQueryError` patterns, the free first-venue-shortlist
  offer, the premium wine/champagne skin, the journey rail, decisions board, and
  the Suri briefing / What's-next / Suri-on-watch AI extras. Added a
  `slotAfterBento` render slot between the At-a-glance bento and the journey rail.
- Rebuilt the Home (`page.tsx`) as: `EventDayPrepCta` + `AutoPreloadOnEventDay` +
  the day-of takeover (`DayOfModeGrid`, wedding-day window) ABOVE, then
  `<EventDashboard>` with the cultural / set-date overlays (`SetDateNudge`,
  `NikahEssentialsCard`, the Chinese tea-ceremony tile) injected through
  `slotAfterBento`. The Home forwards its own `?suri` param to `<EventDashboard>`,
  so the internal AI-state preview now works on the Home URL.
- Removed the old status-board body the dashboard supersedes: `EventCountdownHeader`,
  `OverviewAtAGlance`, the dormant R4 `SuriCockpit` (+ `cockpitEnabled` /
  `buildCockpitModel` usage on Home), `TodaysOneThing`, `WeddingRoadmapAsync`,
  the "Needs you" `UpcomingSchedulesAsync`, the "Up next" `ChecklistAsync`, the
  standalone `SchedulePreviewAsync`, `ActivityFeedAsync`, and the "Explore"
  doorway — plus every helper/import/fetch that ONLY fed them. The cockpit lib +
  component files are untouched (other refs exist); Home just stops rendering it.
- Retired the `/progress` route: `progress/page.tsx` now `redirect()`s to
  `/dashboard/${eventId}`, forwarding `?suri=preview`. Its `_components/*` and
  `_actions/*` stay in place and are imported by `<EventDashboard>`. The
  free-venue-shortlist action now revalidates the Home layout; the AI
  guard-plan default deep link points at the Home.
- Retired the "Progress" Home sub-nav item from `_components/customer-nav-config.ts`,
  `lib/customer-menu.ts` (child + Home match arrays), and the
  `customer.home-subnav.progress` nav-slot registry default; dropped the now-unused
  `Route` icon imports.

Verification: `tsc --noEmit` clean · `next lint` (touched files) 0 errors · unit
suite 1343/1343 pass · radius + nav-icon-source + bottom-nav + legibility guards
pass · `next build` exit 0 (`/dashboard/[eventId]` compiles; `/progress` is a
766 B redirect).

SPEC IMPACT: None — UI/route consolidation only. No schema, pricing, SKU, RLS, or
flag changes. The event Home now surfaces the dashboard directly; the `/progress`
route redirects to it and its Home sub-nav entry is removed.
