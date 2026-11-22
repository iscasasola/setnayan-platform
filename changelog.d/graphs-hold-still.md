## 2026-11-21 · fix(shop-analytics): the graph carousel never grows when you swipe — every picture draws from the first paint

Owner: *"the graphs when scrolled goes up and down"* · *"when i arrived here the graph size increased"*.

Measured live on www.setnayan.com/vendor-dashboard/shop (signed in, fresh load): at 969 px the Analytics carousel was
340 px tall until the first swipe to "The next 13 weeks", then 593 px — the Badges heading under it jumped 254 px; at
375 px it grew three times in one pass (261 → 310 → 403 px), layout-shift 0.08. Each graph card drew a 64-px stand-in
until it was swiped into view and every slide stretches to the tallest, so the first sight of a tall card grew the row.

Now `GraphCard` draws `{g.pic}` from the first paint; only the motion waits (useTween already held values; `.ag-pop` and
`.ag-slide` are now paused inside an unplayed section). Swept the other signed-in chart pages the same way (supplier
Today, Clients, Portfolio; couple Home, event Today, Budget, Guests at 375 px): scroll layout-shift 0 – 0.002, no other
jumping graph found.

Guard: `apps/web/app/vendor-dashboard/shop/the-analytics-carousel-never-changes-height.test.ts` (sabotage — restoring
the stand-in — turns 3 of 4 checks red).

SPEC IMPACT: None

**22 Nov follow-up:** an example card's title keeps clear of its "Example" chip — at 375 px "Compared with similar
suppliers" ran under it (`.ag-card.ag-ex .ag-open b` now reserves the chip's room, as the tile form already did).
Proof in `build-sessions/shots-graphs-hold-still/`: 19 cards swiped at 375 and 1280, light and dark — the carousel's
height never changes (403 px · 593 px).
