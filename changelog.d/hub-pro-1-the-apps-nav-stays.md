## 2026-10-30 · feat(maker): Event Hub Pro slice 1 — the Hub keeps the app's top bar and bottom nav; ✕ dropped; ⚙ ends the pinned row

Builds the owner-approved Event Hub Pro look redesign, slice 1 (DECISION_LOG 2026-10-30 "EVENT HUB PRO (look redesign) —
THE APP'S NAV STAYS; THE EDITING TOOLBAR SHOWS AND HIDES; THREE OPEN CALLS SETTLED"; 2026-10-27 "THE EVENT HUB JOINS
THE SAME SHAPE AS HOME · GUESTS · SUPPLIERS"; prototype `prototypes/build-contracts-2026-10-30/event-hub-pro/`).

- **The Maker no longer covers the screen.** The shell sits in the room the app's chrome leaves — under the app's top
  bar, beside the rail from 701 px, above the bottom nav with Hub lit (`MAKER_IN_THE_APP_CSS` in
  `lib/maker-phone-room.ts`; `useTheAppsRoom` measures it). Its foot is the nav's top LESS the home indicator, so every
  phone tool already placed from `env(safe-area-inset-bottom)` lands on the nav's top unedited. z-80 → z-40: under every
  sheet on `<body>` (the bell and account panels now open over the Maker).
- **▶ held** (the whole page as a guest, LOCKED "every bar slides away"): the app's top bar and bottom nav slide away with
  the Maker's own bar.
- **✕ Exit dropped** (call 1) — the app's nav is the way out; Home is the ✕'s old door (`/dashboard/<eventId>`).
  `lib/the-maker-exit-goes-to-the-event.test.ts` → `lib/the-hub-is-left-by-the-apps-nav.test.ts`.
- **⚙ Event Hub settings** at the right end of the pinned row — the house `MenuSettingsButton menu="hub"` (now `live`).
  Its sheet is what the Maker's own "Your Event Hub" sheet held (Go live · who can view · which version · open browsing ·
  the QR · the Pro line); Settings › Who can view opens the same sheet. `MoreSheet` is deleted; the work area portals into
  the ⚙'s body through the context (`moreHost`). ↺ Undo · ✓ Apply stay on the row (call 3).
- `/dev/maker-lab` draws the Maker inside the REAL app chrome (`LabShell`, Hub lit).

Guards amended where the 30 Oct row amends LOCKED behaviour (the ✕, the full-screen root): the-toolbar-is-the-maker-in-four
(bar = side · undo · preview · apply · settings), the-maker-keeps-the-page-on-a-phone (one row at 375 with ⚙; the room is
the app's), the-maker-top-nav-and-ticket-style 2a (✕ gone), studio-pages-have-no-title-row (4), there-is-one-maker 2,
the-maker-toolbars-lose-nothing (✕'s home is the app's nav), the-maker-lower-third-holds-every-tool 5 (the shell has no
link), the-made-once-items-are-pages (no dialog drawn shut). Re-anchored on the new root class only (logic unchanged):
pick-guests-on-every-guest-print, the-maker-live-walk-holds 6, the-march-opens-the-guest-card-in-place 6, pick-menu-place.

SPEC IMPACT: builds the 2026-10-30 row's slice 1 as ruled (its "Nothing built." now reads built for the app's nav, the ✕
and the ⚙); amends Maker_Two_Bars_LOCKED's "✕ left everywhere" for the Hub tab exactly as that row says. No new ruling.
