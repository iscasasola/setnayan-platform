## 2026-09-29 · feat(services): Event Hub Pro card; Thank-You Video and Playlist find their homes

Owner, "yes to all 4" (DECISION_LOG 2026-09-29 "OWNER: YES TO ALL FOUR").

- Our Services gains an **Event Hub Pro** card (`CollectionCard`): "◆ Add for
  ₱…" with the live `platform_retail_catalog_v2` price (never typed; "See the
  price" when unknown) → the existing Pro page; "Added to your event" when
  owned. Hidden in the app-store shell (the Suite's `surfaceOk` refuses every
  `STORE_SHELL_HIDDEN_ADDON_KEYS` entry) and where the event type has no Event
  Hub. Try-then-pay at the Maker's Apply is unchanged.
- **Thank-You Video** is a link under the Papic card; **Playlist** a link under
  the Music Maker card (like Editorial under Gallery), opening the same pages
  the Suite's cards for them opened. Each shows only where the tool is
  offered; the lists below now ask the BUILT cards (`shownAddOnKeys`), so a
  Playlist whose Music Maker card is absent stays reachable further down.
- "More for your event" now holds only Find your date (→ Details › Date,
  #6120 not on main yet) and Indoor Blueprint (→ Details › Seat plan, not
  built yet); it disappears on its own once both land.
- Guarded by `apps/web/lib/our-services.test.ts` (19 tests; the new ones seen
  failing under sabotage). No migration, no server action.

SPEC IMPACT: None — implements the recorded DECISION_LOG row.
