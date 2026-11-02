## 2026-10-19 · fix(safe-areas): every bar fixed to the screen clears the left and right safe areas, each on its own

iPad + iPhone Duo audit row W2 (batch B3; corpus `IPHONE_DUO_READINESS_2026-10-08.md` points 5 · 21 · 22 · 23).
`viewportFit: 'cover'` lets every page run under the sensor, and side insets are often asymmetric (a Duo's vertical
system bar, a phone held sideways, Split View) — but `env(safe-area-inset-left/right)` was used in 2 places, so the
bars' end buttons and corner controls sat under the sensor housing and in the rounded corners.

- `app/globals.css`: `--sn-safe-l` / `--sn-safe-r` on `:root` are exactly `env(safe-area-inset-left/right, 0px)`
  (one name each, so a walk can stand in for a sensor). ONE rule pads `[data-bottom-dock]`, `[data-maker-shell]`,
  `[data-sheet-panel]`, `[data-sticky-top]` and the new marker `[data-safe-x]` (guest hub bar, event-day bar, site
  menu bar, schedule moment sheet, seating drawer) by them — elements with no side padding of their own.
- Bars WITH their own gutter name `max(gutter, inset)` in place (`pl-[max(1rem,var(--sn-safe-l))]` …): cookie
  banner, stale-tab notice, toasts, launcher pill nav, the site menu's pill row, story sheet, guest drawer, the
  Maker's half sheet and slim bar, the three keyboard bars (`SP_KEY_BAR_FIXED`), mood board, supplier find/build rows,
  pay bar, push prompt, Panood alerts, marketplace bar, seating context dock; and the stylesheet bars (budget,
  guests and supplier thumb rows, the front door's top bar and drawer, the home footer sheet, side panel, inspector
  sheet, Ugat card).
- Corner controls keep off the rounded corners on the side they hug: the guest hub's top corners, the music
  button, the nav FAB, Papic's buy button, the ⓘ bubble, face-enroll / part-error / play-status toasts, the cart peek,
  the account drawer and the Sheet's close ×.
- On every device whose side insets are 0 (desktop, a phone held upright, an iPad) nothing moves — before/after
  pixel diffs at 375 / 390 / 1280 in the PR.
- Guard `lib/every-bar-clears-the-side-insets.test.ts`: every edge-hugging `fixed` element in `app/` + `lib/`
  (JSX classes, class constants, and stylesheet blocks) carries the rule's attribute or names the inset of each side
  it touches; an attributed element carries no side padding of its own. 7 sabotages, all red.

Not in this change: in-flow page content (headings, cards) still runs edge to edge under a side inset — it is not a
bar, and a page-wide gutter is a layout call for T1/T3.

SPEC IMPACT: None — implements corpus `IPHONE_DUO_READINESS_2026-10-08.md` points 5, 21, 22, 23 for the web layer.
