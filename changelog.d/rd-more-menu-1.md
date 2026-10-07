## 2026-10-08 · feat(live-watch): the More row opens the controller once owned; the shop window becomes one "More cameras" row (More-menu step 1)

Corpus `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md` §3 step 1, prototype
`prototypes/more-menu-pages-2026-10-07/3-live-watch.html` (owner: *"Live Stream
full controller."* · *"those have so many words"*).

- `lib/our-services.ts` — once the event OWNS Live Watch, the More menu's
  "Live stream" row opens `/panood/control/[eventId]` (`liveStudioControlPath`)
  instead of the shop window. Waiting-for-payment and not-bought are unchanged.
- `/studio/live-studio-control` — the hero, stat tiles, highlights, three
  paragraphs, plans table and not-included list (incl. the "Build state:"
  developer note) are gone. The page is: title · brand line · one sentence + ⓘ ·
  ONE "More cameras · Add Live Watch · ₱…" row that opens the SAME
  `ChoosePlanSheet` (same plan, same four readiness notices, same YouTube
  acknowledgement) · the thumb bar's "Go live" (the free single-camera door,
  kept where it was — open owner call). The YouTube panel and the hosted-channel
  section are untouched here (step 2 turns them into Set-once rows).
- New shared pieces: `components/thumb-bar.tsx` (glass row, slides up — button
  rule 5/7) · `components/service-rows.tsx` (ServiceHead · RowGroup · ServiceRow)
  · `ChoosePlanSheet.renderTrigger` (a row can be the sheet's door).
- Tour `customer_live_watch_v1` + `<MiniTour>` on the page.
- Guard `lib/live-watch-is-one-row-not-a-shop.test.ts`; `our-services.test.ts`
  gains the owned → controller case.

Built on `rd/maker-button-rule` (#6400, not yet on main) for `ActionButton`.

SPEC IMPACT: None (implements the approved audit; the open owner calls in its §4 stay open).
