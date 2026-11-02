## 2026-07-09 · style(overview): "Energy, not skin" density pass on the couple Home cockpit

Presentational density pass on the logged-in couple Overview (`apps/web/app/dashboard/[eventId]/page.tsx`). Adds an editorial "At a glance" bento row (new `_components/overview-at-a-glance.tsx`) under the countdown hero — days-to-go, guests attending, budget committed, and vendors locked, rendered with the existing wine `ProgressRing` primitive plus a calm secondary stat strip (seated · schedule blocks · tasks left). Also adds `.m-serif` section headings ("At a glance", "Explore") so the cockpit reads as a dashboard, not a flat list.

Reuses only values the page already computes (`daysOut`, `stats`, `committedCentavos`, `estimated_budget_centavos`, `lockedVendorCount`, `totalLockableCategories`, `seatedGuests`, `scheduleBlockCount`, `remainingTaskCount`) — no new queries, no server round-trips, no data-shape changes. The countdown hero (`event-countdown-header.tsx`, owned by in-flight PR #2936) was left untouched. Scoped to the couple Overview only; vendor/admin density is a separate follow-up.

SPEC IMPACT: None — UI reskin only.
