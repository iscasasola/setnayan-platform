## 2026-07-26 · fix(explore): Setnayan's own services are not marketplace vendors

Owner 2026-07-26: *"remove setnayan from Explore"* · *"all setnayan in app services
are either on their exact location on the dashboard or on suites"* ·
*"monogram and papic is in suite"*.

Explore is the **vendor marketplace** — where a couple finds and books a third-party
supplier. Setnayan's own offerings (Papic, Animated Monogram, Setnayan AI, Live
Studio, Patiktok, Pakanta, …) are ordinary catalog SKUs in
`platform_retail_catalog_v2`, bought from the suite or from their own dashboard
surface. Listing them alongside vendors implied they were bookable through a
supplier flow they never used.

**⚠ Reverses the 2026-05-22 PM directive** that floated first-party canonicals
ABOVE everything else in Explore. Three places carried that float; all are gone:

1. SQL `.order('is_setnayan_service', …)` on the main query
2. the in-memory partnership/quality tiebreak
3. the Phase-C gated rating/review re-sort

and the query now filters first-party rows out entirely, using the same NULL-safe
predicate `dashboard/[eventId]/date-selection/page.tsx` already uses.

**No orphaned doorway** (repo wayfinding rule). Verified every service keeps its
way in: `/dashboard/[eventId]/studio/{papic,animated-monogram,setnayan-ai,pakanta,
patiktok,panood,save-the-date,led,custom-qr-guest,editorial-pro,indoor-blueprint,
mood-board,photo-delivery,website-pro,live-studio-control,playlist}` plus the suite
at `/dashboard/[eventId]/suite`, whose hrefs come from `lib/add-ons-catalog` and
point at `/studio/*`. The one suite tile linking to Explore is "Compare vendors" —
a third-party feature, deliberately untouched.

**Zero live effect — verified in prod:** `vendor_market_stats` holds exactly 1
vendor and **0** with `is_setnayan_service = true`. (The single profile is
"SetnaProd", services `['pabati']`, `coming_soon` + `unverified` — not first-party,
and already invisible in Explore because the verification gate admits only
`verified` vendors.)

SPEC IMPACT: reverses the 2026-05-22 first-party-float directive; logged in
`DECISION_LOG.md`.
