## 2026-07-09 · feat(home): "Where to?" account hub redesign (YOUR EVENTS + YOUR SPACES)

Rebuilt the customer account home (`app/dashboard/(account)/page.tsx`) to the
owner's mockup — a "Where to?" hub with two collections:

- **YOUR EVENTS** — rich event cards: Filipino event-type badge
  (KASAL / BINYAG / DEBUT …), a big monogram letter, place · date, a real
  "% planned" progress bar (checklist done/total), and "N days". Plus a
  "New event" tile. Horizontal-scroll on mobile, 4-up grid on desktop.
- **YOUR SPACES** — cross-cutting doorways: Life Story (obsidian hero),
  Marketplace (`/explore`), Your shop (`/vendor-dashboard`, gated
  `hasVendorAccess`), HQ (`/admin`, gated `hasAdminAccess`). Folds in the old
  RoleSwitchRows (Shop console / Setnayan HQ) as cards.

SKIN: first surface of the "Energy, not skin" wine reskin — wine `#5C2542` +
display serif (`.m-serif`), 16px tiles, violet admin accent. Wine is introduced
page-scoped (arbitrary values) because the shipped `mulberry` token was
repurposed to obsidian at the Clean-Editorial rebrand; neutrals stay on the
theme-aware cream/ink tokens so light + dark both render.

PRESERVED: the 2026-07-04 landing rule (single-event non-console → jump into the
event; 0-event console → create-event), and all three flag-gated blocks —
LifeFlashHomeCard (`lifeStoryEnabled`), AutoSurfacedEvents
(`accountAutosurfaceEnabled`), the person-spine "Your story" section
(`personLifeStoriesEnabled`) — all default-OFF in prod, so zero visible change
there.

"% planned" reuses `fetchChecklistItems` (one light query per active event, in
parallel); it is NULL when an event has no checklist rows (card shows the
countdown only — no fabricated number). No new deps, no schema, no migration.
tsc + next lint clean.

FOLLOW-UPS (flagged for owner): (1) the reskin is home-only — pages behind it
stay obsidian/gold until the "Energy, not skin" rollout continues; (2) the Life
Story card points at the Memories Hub (`/dashboard/library`) until a dedicated
`/dashboard/life-story` route ships.

SPEC IMPACT: None (UI redesign).
