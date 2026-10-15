## 2026-10-15 · chore(supplier): the simpler supplier dashboard, steps 1–6, in one batch

The six step branches (#6554 · #6533 · #6557 · #6559 · #6558 · #6535) merged in order; each step keeps its own
fragment. What the batch itself changed where steps met:
- **Halls "Uses"** (step 2) moved from the Shop's retired inline editor (step 3) to the card's own screen
  `/vendor-dashboard/services/[serviceId]` — its own form outside the card form, read only for a venue card.
- **The account sheet** — steps 5 and 6 each built `shopRows`; now one component, one row list
  (`supplier-avatar-rows.ts`): Your details · Your page · Your collections · Helpers · Plan (never in the store shell) ·
  Settings; a scoped team member sees Settings alone.
- **Two block readers honour repeats** — step 1's first-steps days-off count and step 4's chat answer line read
  `vendor_calendar_blocks` with `.gte('blocked_until')`, which drops every repeat (step 2); both go through
  `lib/not-available` now.
- Step 6's Shop team-tile count had no home (step 5 retired the tile): the Helpers screen is the one seat count.
- Links step 6 wrote to the old Shop folds now go to step 5's homes (`/profile#docs`, `/profile#pay`).

SPEC IMPACT: None (each step's own fragment carries its spec impact).
