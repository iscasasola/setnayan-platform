# HANDOVER — rd/couple-dashboard-desktop-tablet (delete before reporting green)

Contract: corpus `prototypes/couple_dashboard_desktop_tablet_2026-10-19.html` (0f7e3858/b96c097d) + DECISION_LOG
"APPROVED — COUPLE DASHBOARD DESKTOP + TABLET (AREA 2)" (8604c3b2). Brief: shots-2026-10-19/sweep/BATCH-BRIEF.md.

## Split
- PR 1 (this branch): the 701 boundary — shell band, dock, Sheet dock point, page docks, slim bar, labs `&shell=1`.
- PR 2 (rd/couple-dashboard-caps, from main): column caps — Guests List/Setup 48rem, Map 64rem, Budget 48rem,
  Papic 48rem, Suppliers shell 64rem. Home already capped (max-w-xl → lg:max-w-3xl; prototype keeps it).
- PR 3 (rd/couple-dashboard-panels, stacked on PR 1): Sheet `tab` set → 440 (27.5rem); SidePanel 30rem→27.5rem,
  768→701; hand-rolled sheets on the five pages (Guests NewGroup/Quick add/Add guest/Add from people, Suppliers
  accordion confirm + loading modal, Papic InlineCheckoutDrawer) adopt the panel.

## Decisions taken (no ruling needed)
- Boundary is OPT-IN per tree (`boundary="tab"`), only the event layout. Other trees unchanged (areas 3–4).
- Slim phone bar moved 768→701 for ALL trees (measure every tree's cluster at 701/720/744 before claiming it fits).
- Page-internal `lg:` copy/layout switches (swipe hint, Tap/Click to view, capture-bar add doors, Suppliers title
  row, Maker, details record sheets, seating) are NOT chrome and stay at lg — named in PR body.

## Walk
- Lab env + shared 54321 stub; port 3741; `work/scripts/serve.sh` (45-min ceiling) + `walk.mjs`, `compare.mjs`.
- Compiles are slow (~2 min/route): warm the 4 lab routes with curl first.
- Before-shots = `git checkout origin/main -- <non-dev paths>` then `git checkout HEAD -- apps/web` to restore.
