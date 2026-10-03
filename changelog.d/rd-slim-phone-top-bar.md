## 2026-10-03 · feat(shell): the phone's top bar is one slim row

Owner, on the phone: *"on mobile. this row takes so much space on all pages."*
Below 768px the shared signed-in bar (`FrontDoorShell`, app variant) is now one
row of 44px circles — ☰ · mark · search · chat · bell · avatar — 51px plus the
notch (`env(safe-area-inset-top)`), down from 61px (63px on the Guest list),
measured at 390×844 on the real components. Desktop and 768–1023 are unchanged.

- **Search → its icon.** The palette trigger is the same button drawn as a
  circle; opened, its dialog sits over the bar, full width. On the Guest list
  the real box collapses to its icon and a tap focuses it and opens it over the
  whole bar (16px text, so iOS does not zoom); a search still applied while it
  is shut is marked with a dot. Same components — no second search, no new
  client code.
- **Avatar → a plain round photo** (no pill border, no chevron); it opens the
  same account menu.
- **Chat and bell** keep their badges and are 44px circles.
- `--fd-bar` follows the bar on phones, so what parks under it stays flush.
- Also fixed on phones: the palette's dimmed backdrop covered only the bar
  (the bar's `backdrop-filter` makes it the containing block for `fixed`
  boxes) — it now covers the screen.
- ☰ stays: the approved phone design draws no top bar, the 2026-08-29 ruling
  keeps the menu on every surface, and on the board, account pages and HQ the
  drawer is the phone's only way to most of the app.

Class hooks `fd-round` (`unread-bell-badge.tsx`, `unread-messages-badge.tsx`)
and `fd-acct` (`account-switcher.tsx`); rules in `front-door.css` (one
`max-width: 767.98px` block). Guarded by
`apps/web/tests/e2e/slim-phone-top-bar.spec.ts` (renders the real bar under the
app's compiled CSS and measures it at 390 and 375; desktop pinned at 61px).

**Finished 2026-10-03 (C5):** the pill radius uses the token
(`var(--m-r-full)`, not `9999px` — the radius guard was red). "One row on
every page" is now measured on every tree that hands the bar its own cluster:
the events board, the supplier app and HQ join the event pages in the spec, at
375 and 360. HQ's worst case ("Queue counts unavailable" + "Setnayan Team") ran
19px past a 375 screen and squeezed its bell to a 27px ellipse; on a phone the
HQ role tag now steps out (`fd-role`), the SLA pill keeps its words and
shortens with "…" only if it still cannot fit (`fd-urgency`, full sentence in
its aria-label), and the round controls never shrink. Desktop unchanged.

SPEC IMPACT: None
