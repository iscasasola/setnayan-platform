## 2026-11-17 · feat(event-dashboard): the event dashboard frame of drawing v13 — the 1280 board, the profile menu, the back

Builds the frame of the approved event dashboard drawing (`prototypes/event_dashboard_clean_2026-11-16/`, artifact
J4EaNmdqHfDZ66stWH46GM v13). The clean warm look itself (tokens, frames, floating pill) is #7888 / #7883; this PR is
the layout and the shared menu.

- **Today from 1280 is three columns** (clean look screen 2b): the event card, Next and To do | Guests · Budget ·
  Schedule | Suppliers · Event Hub, then Prints · Your services · Memories. Three wrappers that are `display: contents`
  below 1280, so the phone and the tablet keep the shipped order; the two-column detail hides where the board shows.
  The cover is the first column's card from 1280 (no bleed, round, scrolls with its column).
- **Guests' three summary cards sit in one row from 1280** (owner "Yes, all 8" Q1) — `SnapCarousel rowFrom="xl"`.
- **Memories takes the full width from 1024** and starts at 6 a row at 1280, 8 at 1600 (Q4) — the desk steps become
  6 · 8 · 12 · 16.
- **The profile menu, one design for the whole website:** the phone sheet rises full screen with "‹ <the page it opened
  over>" and ✕ (no grab bar); the computer panel is 360 wide and as tall as the screen allows; names and emails wrap
  instead of being cut with "…".
- **‹ Today on Your services, opened** (the Orders page had no way back), from the page-home map.

Guards: `the-home-grid-reads-in-order` (2b, the board's column order), `the-sheet-back-names-the-page` (new),
`the-memories-stage-is-48rem-then-full-width` (1b), `gallery-zoom`; four Home guards that counted "two versions" now name the board
as the third.

SPEC IMPACT: None — builds the approved drawing; no decision changes. Flagged for the owner: DECISION_LOG 75a46e3c
item 12 ("Memories on desktop is a 48rem column") and the later 16 Nov "Yes, all 8" row ("Memories full width") disagree;
this follows the later row and the drawing. **Owner answered 17 Nov (via controller):** Memories full width from 1024 ·
desk zoom steps 6·8·12·16 · "Now/Next" stays inside the event card (the 2 Nov ruling holds; the drawing yields).

Audit fixes (controller, 17 Nov): the profile sheet's back names the page from the shipped route map (`pageOwnLabel` in
`lib/page-home.ts`, via `lib/sheet-back-label.ts`), so Today reads "‹ Today", not the couple's names; the 1280 board
carries `data-tour="home-tiles"`; board Count ids are suffixed `-board` so the count-up plays on the copy you see;
`the-event-bar-never-remounts` test 1 now fails when the dock moves inside the swapping content (sabotage-run); the
Memories guard is renamed to what it asserts; the sheet lab draws ✕ and the mapped back label, not typed text.
