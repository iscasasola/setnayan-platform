## 2026-09-25 · feat(event-hub): the Event Hub Maker — the full-screen shell with the final bar

Phase 1 of `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`, built against
`prototypes/event_hub_editor_FINAL_2026-09-24.html`.

- **Route: `/dashboard/[eventId]/launch`, unchanged** (owner: "label change only;
  menu key `launch` and routes unchanged"). Measured first: the event layout is
  handed `params`, never the path, so it cannot skip its rail by segment. The
  Maker covers the viewport instead (`fixed inset-0`, document scroll locked) —
  **zero new pages, zero new server actions, no migration.**
- **Four regions** (`launch/_components/maker-shell.tsx`,
  `website/editor/_components/editor-shell.tsx`, which now holds `MakerWork` in
  place of the old two-pane `EditorShell` — its row chips, scan-to-view QR and
  Pro CTA ported into the ⋯ sheet, its preview into the canvas): toolbar (✕ Exit · ▤ · ▶ Play ·
  ＋ · the bar · Desktop/Phone/Both · ⊞ · ⓘ · ⋯), a resizable/collapsible
  navigator (numbered scenes, "Main" pinned, eye lower-right, transition marker
  between scenes, drag to reorder, right-click / long-press Move up · Move down
  · Hide), the canvas (the real page in an iframe, one stage at a time, reloads
  after every save), and one inspector (Format · Animate · Transition · Content)
  shown only on selection. Phone: canvas on top, navigator strip, inspector as a
  sheet.
- **The bar is the owner's final bar**: Logo · Hero · Reveal · Love Story │
  Save the Date · Invitation · On the Day · Post Event │ Prints & Tickets, red
  dot on the live stage. Stage words come from `PUBLIC_STAGE_LABELS`.
- **Every panel is the one that already shipped**, built by the editor page with
  its own bound action. `/website/editor` renders inside the Maker (`maker=1`)
  and forwards there when opened directly. Every navigator write is an existing
  action (`toggleWidgetVisibility`, `setSectionMode`, `moveWidgetUp/Down`); a drag
  of N places is N single swaps chained through `?chain=`. The eye writes both
  visibility gates (`is_visible` and `mode`) so a hidden scene is hidden on both
  render paths.
- **Coming next, never dead**: ＋ (templates), ⊞ snap grid, Both, Prints &
  Tickets, the in-Maker Logo Maker, the Love Story scrapbook and the one-hero
  model each open a one-line "coming in the next build".
- **Theme panel placeholder** in "Main" reads `lib/invite-themes.ts` as it stands
  (Phase 3 owns it) and opens the shipped picker.
- **Tour** `customer_event_hub_maker_v1` in `lib/tours.ts`, first visit only
  (`users.tour_seen_keys`), ⓘ reopens it without recording; last button "Start"
  lands on the theme panel; its Pro slide is dropped in the store shell and its
  price comes only from `platform_retail_catalog_v2`.
- **Store shell**: Pro-only rows, locks and prices are hidden, not locked
  (`SectionsPanel` `hideLocked`, `lockPanel` → nothing).
- **Menu**: row `launch` → "Event Hub Maker" (also the two `nav-registry-defaults`
  slots; prod `nav_slot_override` holds no rows for them, read 2026-09-25). The
  Logo Maker (`palogo`, via `STUDIO_ABSORBED`) and Editorial leave the tree;
  `/monogram` and `/story` light the Maker row. Kinds with no Event Hub keep both
  rows.
- **Copy**: the rendered "website" strings in the Maker's tree now say "Event
  Hub"; held by `lib/the-hub-never-says-website.test.ts`.
- Tests: `the-maker-bar-is-the-final-bar.test.ts` (nine items in order, two
  dividers, the red dot, no dead button, the tour's store-shell rule),
  `lib/the-maker-is-one-row.test.ts`; menu guards updated to the new name and
  shape.

The Apply · Restore · Reset bar (Phase 2) mounts in `MakerShell`'s `applySlot`.

SPEC IMPACT: None — implements the locked 2026-09-24/25 rulings and the build
plan as written; no decision changed.
