## 2026-10-05 · feat(maker): three zones — the hub top nav, the page, and the LOWER THIRD where every phone tool lives · the ticket style waits for Apply

Builds `prototypes/maker_lower_third_interactive_2026-10-05_fable.html` + `maker_keynote_chrome_2026-10-05_fable.*` (frames 1–9). The owner approved the design ("approve") and asked for it in full ("make it happen · no bugs · fully functional"; "each scene and setting must be there and not links. editing should be on the actual tool thirds"). Phone (< lg) only; the desktop keeps its columns.

- **Top nav** (the whole Event Hub):
  - ✕ Exit: red, its own pill, an X. It used to be "‹", which reads as back one step.
  - The screen you are on: "RSVP · RSVP form", "Invitation · Welcome", "Theme · Font". It truncates.
  - [↺ Undo | 👁 Preview]: one shared pill.
  - ✓ Apply: green, its own pill, with the count.
  - One new shared wrapper, `IconPill` (`launch/_components/icon-pill.tsx`).
- **The lower third** (`maker-lower-third.tsx`, in the shell's flow under the page; `MAKER_LT_HEIGHT` = clamp(216 px, 30dvh, 236 px)):
  - **Row 1, where you are:** the menu ▾ shows the pick ("RSVP ▾") beside the part on screen.
  - **Row 2, the navigator:** the pick's parts first, then the stage's scenes. Each layer draws its own tiles into the navigator (`IntoLowerThird`).
    - A stage: its guest pages (Welcome · Details · Our Love Story · Me), then its scenes (the strip, "+ Add a scene" last).
    - RSVP: RSVP form · After they submit · When they decline, captioned "The form / When yes / When no".
    - Theme: Theme · Background · Font · Colours · Buttons, then Mood Board · Logo · Hero · Reveal.
    - Details: Event Details' items.
    - Settings: Event Bar (a switch) · Who can view · Prints · Restore what guests see · Reset this stage… · About the Maker.
  - **The menu:** a sheet INSIDE the lower third with exactly two groups.
    - Global settings: Theme · Settings · Details.
    - Stages: Save the Date · RSVP · Invitation · The Day · Post Event, with the live-today dot.
    - One open at a time (`lib/one-open.ts`).
  - **A tool open** (a tile's editor, or a part tapped on the page):
    - The menu and the navigator fold sideways into a 52 px LEFT COLUMN: the tool's name, ‹ › to step (the navigator's tiles, or a part's parts), and ×.
    - The tool takes the rest, 311 px at 375 (`MAKER_LT_TOOL`, `useMakerTool`).
    - × closes it, and so do a tap on the name, a tap on the empty page, or Escape.
    - 240 ms; instant under Reduce Motion.
  - **Removed, not hidden:**
    - The old bottom bar (Page ▾ · Look · Event Details), and the phone's floating Event Bar switch (now the desktop's only).
    - The sheets' scrim, grip, Peek and slim bar inside the Maker.
    - `SheetScrim`, `SheetGrip`, `MAKER_PHONE_PANEL_CAP`, `MAKER_PHONE_GUIDED_PANEL_CAP`, `MAKER_PHONE_BOTTOM_BAR_PX`.
    - The page chips "Edit · …".
  - Nothing editable opens over the page: the scene sheet, the part sheet, Event Details' editor, a guided step, the RSVP controls, the logo's two panels, Who can view, the scene templates and the typing bar all sit in the lower third.
- **Editing in place, never a link:**
  - The Names & date sheet: no "This scene is made in the Hero editor" and no "Open Hero editor"; the part sheet has no "Open the Hero editor"; its parts are ONE "Part ▾".
  - The Reveal's controls and Post Event's rows are drawn IN their fixed scene's panel; no "Open … editor" button is left.
  - A fixed scene's "where it comes from" is said, never linked ("Open your guest list →" is gone).
- **The ticket style goes through the hub draft (owner 2026-10-02 Q7).**
  - The draft's `print_details` holds `pass_design` beside `name_style`; the keys merge one at a time, and Apply merges only what the draft holds.
  - `PassCardDesignPicker` saves through `hubDraftAction`. The live `POST /api/hub-print/pass-design` is gone.
  - The Guest's ticket scene draws the first coming guest's real ticket (`pass_guest=first`) with ONE Ticket style ▾.
- **Look opens the Look tools.** It never lands on the guided flow's stage list (`lookVisit`).
- **The Event Bar (i) note is gone.** It floated over the tiles and could not be closed.
- **👁 Preview is seen on a setup screen.** A view pick puts the stage back on screen.
- **Guards:**
  - New, each sabotaged red and then restored green: `lib/the-maker-top-nav-and-ticket-style.test.ts` and `lib/the-maker-lower-third-holds-every-tool.test.ts`. The second covers the fixed order, the menu's two groups, the left column with tools ≥ 300 px, every old door reachable, and no link out.
  - Rewritten to the lower third: `the-maker-keeps-the-page-on-a-phone`, `a-sheet-never-covers-the-bottom-bar`, `element-sheet-state`, `a-phone-sheet-opens-at-half`, `no-two-bar-buttons-share-a-label`, `the-scene-strip-never-scrolls-down`, `every-scene-is-in-the-navigator`, `the-logo-is-layers`, `the-look-is-one-panel`, `the-made-once-items-are-pages`, `the-guided-steps-share-one-layout`, `the-maker-toolbars-lose-nothing`, `the-maker-controls-are-compact`, `the-event-bar-is-the-stages-own`, `tap-to-type-is-instant`.
  - Baselines regenerated with their generators: `port:baseline`, `root-map --baseline`.
- **Lab:** `/dev/maker-lab` (dev-only) mounts the real shell, work area, RSVP stage and draft bar on maria-and-jose's real shape (read-only from production). `/dev/details-lab`'s page builder moved to `details-lab-node.tsx` so both labs share it.

SPEC IMPACT: corpus `DECISION_LOG.md`, a 2026-10-05 row. It marks `maker_lower_third_interactive_2026-10-05_fable` and `maker_keynote_chrome_2026-10-05_fable` BUILT, records Q7 (2026-10-02, the ticket style waits for Apply) as built, and lists the parts not yet in the lower third.
