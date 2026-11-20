# Shots — Event Hub Maker: one toolbar, full screen (PR 1 · parts 1–3) — measured against drawing v17

Taken 20 Nov 2026. **Left: the drawing** — `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` at Setnayan-specs
`00f14268` (v17, "final for build"), its Proposed phone, Free couple. **Right: this branch** in `/dev/maker-lab` (maria-and-jose's
real shape, no database) in a local `next dev`, 375 × 812, light and dark scheme; three desktop shots at 1280 × 800.

| # | State | Files |
|---|---|---|
| 01 | A scene selected (the title) | `01-title-selected-375-{light,dark}.png` |
| 02 | A tap on the logo selects it (no jump) | `02-logo-selected-375-*` |
| 03 | Style tab | `03-logo-style-375-*` |
| 04 | ⤢ Expand → full screen | `04-logo-expanded-375-*` |
| 05–07 | E-Gifts selected → expanded → ✓ Done, back on the page | `05…07-gifts-*-375-*` |
| 08 | ⚙ Event Hub settings | `08-gear-375-*` |
| desk | 1280: scene selected · Logo expanded · E-Gifts expanded | `desk-*-1280.png` |

⚠ **Dark:** the Maker has no dark theme on `main` yet (open #7993), so the build's dark-scheme shots render it light —
taken to show nothing breaks, not a dark design. The red "N · 3 Issues" pill is Next's dev overlay (the lab's database
reads have no database), not the app.

## Gaps against v17 — what differs, and the part that carries it

**Matches the drawing (this PR):** the app's bars step away (full screen) · ‹ leads the bar · a tap selects, never jumps
(Logo, E-Gifts) · Edit · Style · Animate ◆ on every scene, ◆ only for a couple without the full Event Hub · ⤢ Expand on
Logo, Love Story, Schedule, E-Gifts (not Dress code — "DRESS COLOURS STAY IN MOOD BOARD") · full screen has ✓ Done; Esc and
Back close it · History is in ⚙ with Undo last change · "Event name".

| Gap (drawing v17 → build) | Ruling | Carried by |
|---|---|---|
| 👁 on the phone's bar; hold-▶ preview still shipped | ONE TOOLBAR (5) | **part 5** |
| ✓ Apply worded pill · neutral Stage pill (build keeps the shipped ✓ icon and accent pill) | ONE TOOLBAR (5) · ICONS AND BUTTONS SIZED BY JOB (4) | **part 6** (Apply sheet) |
| Toolbar head: ‹ name · Page ▾ › and **✕** (build: "You're editing · stage › page › part" caption); Back closes the toolbar, drag the handle down, tap outside | MAKER · WAY BACK | **part 4** (the name ▾ opens Pages) |
| Tabs and ⤢ sit at the toolbar's FOOT; ⤢ is a worded "Expand" pill (build: tabs on top, icon ⤢) | ONE TOOLBAR (2) | **part 4** (toolbar head/foot redraw with the Pages name ▾) |
| Style: ◆ lead line + four groups Layout · Background · Words · Extras ◆ (build: the shipped look cards + Accent/Size, Background as a toggle beside the tabs) | MAKER TABS REVISITED (2) · PAYWALL | **part 4b** (Style and Animate rows) |
| Animate rows Arrives · While showing · Leaves · With the scroll; picking plays at once | MAKER TABS REVISITED (3) | **part 4b** |
| Edit rows by importance (title: Event name › Date and place › Top line); "On the X page" row gone | MAKER EDIT ROWS RUN BY IMPORTANCE (1) · TABS REVISITED (1) | **part 4b** |
| Dress code Edit: code + note + the colours shown, one row "Colours and mood board › Made in Event › Mood Board" (build: the row "Colours and mood board" — its second line comes with 4b — opening the shipped Mood Board editor in place, since the Mood Board page still forwards a host into the Maker) | DRESS COLOURS STAY IN MOOD BOARD (2) | **part 4b**; the Mood Board's own home outside the Hub is its own change |
| ⚙ regrouped: Sharing · On every page · Share and print · History · Event info 🔒; Look leaves ⚙ (build: Look · Your Event Hub · History · …) | EVENT HUB SETTINGS REGROUPED (1) | **part 4** (with the 🎨 Look button) |
| 🎨 Look button + the "Whole Event Hub" part (Edit · Style · Animate) | ONE "LOOK" HOME (1) | **part 4** |
| Stage ▾ = Save the Date · RSVP · Invitation · The Day (Post Event leaves) | POST EVENT LEAVES THE EVENT HUB (1) | **part 4** |
| Guest page bar under the canvas (build) → Pages list (drawing) | ONE TOOLBAR (4) | **part 4** |
| Full screen: foot keeps the tabs with ⤡ Minimize where ⤢ was (build: ⤡ beside ✓ Done, the editor's own tabs below — the foot ⤡ covered the Logo editor's Spacing slider) | ONE TOOLBAR (2) | kept — explained in the PR |
| ⤢ on Wedding March and Memories | ONE TOOLBAR (2) | no full-screen editor exists for either in the Maker yet |
| ◆ on every Style choice; Apply: "◆ Get the full Event Hub and apply" / "Apply without the ◆ changes" | PAYWALL | **part 6** |
| Video scene | ONE "LOOK" HOME (4) | **part 4** (Pages' "Gifts, photos & video") |
