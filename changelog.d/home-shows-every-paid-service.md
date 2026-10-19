## 2026-10-20 · feat(home): Your services shows every paid service and Event Hub Pro

Owner, live on cale-ice: *"i thought we will have our other paid services here in home?"* — Home's
"Your services" listed only Guest photos (Papic) and Planner (Setnayan AI). Cause: `homeServices()`
(`lib/home-first-screen.ts`) had only ever been built for those two (2026-10-01); the 2026-10-14
rulings (paid services + Event Hub Pro; the approved services prototype) were never built. The
"left off" rule (`lib/event-needs.ts`, commit 1890230a90) was NOT the cause — it only covers guest
list / suppliers / Event Hub details, and cale-ice has all three on (NULL = on), so "Switch on more"
correctly does not appear there.

- Home now draws Guest photos · Planner · Live stream · Music · Video booth · Event Hub Pro. Owned
  rows say "On" (Event Hub Pro: "Pro on · themes, photo and video backgrounds" + Open the Maker;
  Live stream + Open controller); a payment waiting says "Payment sent · switches on once
  approved"; a service not added is ONE slim line under "Not added" — its catalogue price
  (`platform_retail_catalog_v2` via `getCustomerSkuPriceLabel`; Setnayan AI via its own per-type
  resolver) and **Add**, which opens the service's own page where the shipped purchase lives.
- Ownership is `eventSkuActive` (the feature gate), so an internal / founder-seat host reads "On"
  as the features behave. Which services an event is offered and where each opens is the More
  menu's own builder (`buildOurServices`) — no second list (`lib/home-paid-services.ts`).
- Reuses the shipped `ServiceGlanceRow` (new `slim` + `meter` props, no new card) and its CSS.
- iPhone app (store shell): unchanged — no paid rows, nothing read; Apple's own Papic / Live
  Watch rows stay as shipped.
- Guard `app/dashboard/[eventId]/home-shows-every-paid-service.test.ts`: every paid service in
  `SERVICE_NAMES` + Event Hub Pro lands in exactly one state (owned · pending · add · open · unread ·
  absent) across every read / offer / phase / price / shell combination, and Home draws exactly one
  row unless the state is the event's own "absent"; a need left off never hides one.
- `/dev/home-lab?paid=cale|none|mix|pending|unread`.

Not built (each needs its own read, mapped per service by the 2026-10-13 ruling): the prototype's
live counts on owned rows (suppliers watched, cameras paired, song ready, reels), the in-place Add
sheets (mint → /pay), and the per-service top bands.

SPEC IMPACT: None — builds the approved 2026-10-14 rulings and prototype; no decision changed.
