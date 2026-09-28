## 2026-09-29 · feat(services): the Suite becomes the event's Our Services page

Owner, 2026-09-29 (DECISION_LOG "WHAT AN EVENT NEEDS — THE EVENT MENU BECOMES
FOUR PILLARS (+ HOME)"): the Suite becomes the Our Services page, each service
card showing added / add.

- `/dashboard/[eventId]/suite` now opens on six `CollectionCard`s — Papic ·
  Live Studio · Gallery (Editorial folded in as its part) · Patiktok · Music
  Maker · Setnayan AI (SAI). Built by `lib/our-services.ts` from the reads the
  page already made: ownership (`eventActiveSkus`, Papic via the exported
  `PAPIC_INCLUSIVE_SKUS`), the live `platform_retail_catalog_v2` price, and the
  Suite's own offered / day-over / Setnayan-AI-sellable / store-shell gates.
  Each card opens the page its event-menu row opens (`addOnHref`). A paid
  service not yet added reads "◆ Add for ₱…"; a missing price reads "See the
  price", never free.
- Everything else the Suite carried stays below under "More for your event"
  (recommendations, the other add-ons, the free tools, search), minus the six,
  so no doorway is lost and nothing shows twice. The search's tag pill row is
  now one `PickMenu` dropdown.
- Same route, so every old /suite link lands here. The event menu's `studio`
  row (key unchanged) and its nav-registry slot default now read "Our
  Services"; the finished-event summary card and the clearance page say it too.
- Guarded by `apps/web/lib/our-services.test.ts` (each test seen failing under
  sabotage). No migration, no server action.

SPEC IMPACT: None — implements the recorded DECISION_LOG 2026-09-29 row; the
menu restructure itself (Stage D) is not in this change.
