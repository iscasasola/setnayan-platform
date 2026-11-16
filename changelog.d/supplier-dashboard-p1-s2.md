## 2026-11-17 · feat(supplier): the desktop layout moves — Today two panes, Shop layout A, a back on cold-opened risen pages

Slice 2 of the P1 supplier drawings. It stacks on #7898 (the W1 walk batch) and #7901 (slice 1, the blue look). This slice only moves where shipped things sit: no new reads, no new actions, and no change below 1280.

- **Today on a computer** (owner 16 Nov, DECISION_LOG "SUPPLIER DESKTOP MAIN PAGES APPROVED").
  - From 1280, the work pane (Needs you today · Also today · Events you run · Coming up) sits beside the Shop pane (400px).
  - From 1600, the Shop pane is 420px and the work pane splits into Needs | Coming up.
  - Two wrappers that are `display: contents` below 1280, plus grid rules in the shipped `supplier-frame.css`. 🔒 `today-is-two-panes-on-a-computer.test.ts`
- **Shop on a computer, layout A** (picks 3–5).
  - From 1280, Analytics, Badges and Makers sit in a 400px side column beside the service cards. The analytics carousel lays out as a 2-across grid (its loop copies and dots step aside), and the cards go 2 across.
  - From 1600, the side column is 440px and the cards go 3 across. 🔒 `shop/the-shop-is-layout-a-on-a-computer.test.ts`
- **A back on a cold arrival** (owner 16 Nov, "NEVER LOSE THE BACK BUTTON").
  - Your details, Settings and Team rise from the avatar with their own ✕. Opened from a deep link or a reload, they had no way back.
  - Each now draws the shipped `BackButton`, which takes its home from `lib/page-home.ts` and returns in place. It sits inside the new `BackWhenNotRisen`, so a risen sheet never shows two ways out. 🔒 `a-cold-arrival-has-a-back.test.ts`

SPEC IMPACT: None. Every move is a 16 Nov approval already in DECISION_LOG.
- Clients on a computer (≥1280): once a day is picked, the picked day sits beside the month as the third column and the client list stays shown. It uses no extra read, because it reuses the month's own data. Phone unchanged. Guard: `customers/the-picked-day-is-column-three-on-a-computer.test.ts`.
- Clients on a computer (≥1280): a booked event in This day opens its page through the one open path (`openClientHref`). That page is the shipped `PickedShell`, now starting right of the rail and under the top bar, so it spans columns 2 and 3. On the phone it still rises full screen. The event id comes from the month's own read (`PoolBookingEntry.eventId`), so there is no extra read. Guard: `customers/an-event-takes-columns-two-and-three.test.ts`.
- Clients on a computer: over Clients, the shared `PickedShell` shows "‹ Calendar" in place of ✕ (a new optional `closeAs` prop, null by default, so the couple side keeps its ✕). Guard: `app/_components/picked/the-couple-side-keeps-its-close.test.ts`.

**Audit fixes (owner 17 Nov audit of #7902):**
- **Today's side pane.** From 1280 the drawing's `.rp` is a sticky column 2. It holds Next events, the five numbers, the Shop block with three small cards (Opened · Asked · Booked, approved pick 2) and Setnayan Verified. The pane draws the same `nextEvents`/`stats` props as the top, so nothing new is read. The cards come from the stats Today already read, and an unread figure shows "—". Verified shows only once the papers are checked, and links to the one paper place. Guard: `today-has-a-side-pane-on-a-computer.test.ts`.
- **Shop thumb row.** From 1280 it starts right of the side column, over the service cards (the drawing's 540 / 580). Its offset is derived from the same tokens as the grid.
- **No magic numbers.**
  - `--desk-gap`, `--today-side`, `--shop-desk-side` and `--clients-day` live on `:root`, and every desk grid reads them.
  - Clients' picked day is a named grid area (top · day · rest), with no `span 40` rows.
  - The This-day panel reads `--fd-app-bar` / `--fd-app-rail-wide`, published on `:root` from the `.fd` values. A guard holds them equal.
- **Phone.** It keeps the day sheet: the event opens its page only from 1280 (`useIsDesktop('xl')`).
- **The Clients quick row** stays mounted (hidden) while a day is picked, instead of being dropped.
