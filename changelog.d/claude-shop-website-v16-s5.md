## 2026-11-17 · feat(shop): v16 S5 — Check a date opens in place from every door, and says "Popular day"

- **Every door opens Check a date in place.** The sheet itself shipped with SHOP-02 v7 (`CheckADateSheet`, the shop's `?dates` address). The desktop side card's "See every month →" was a plain link that reloaded the page. It now rises over the shop in place, like the action row's button.
- **× steps back onto the shop from every door.** A tapped day in the side card's month and "See every month →" both record that the sheet was opened from the shop, through the new `noteDatesFromShop`, shared with `CheckADateLink`.
- **The drawing's words for a popular day.** The legend reads "Popular day" (`CHECK_DATE_POPULAR`), and a tapped popular day's sheet shows "✦ Popular day" beside Available. Which days count as popular is the shipped hot-date rule (`dayShines`: In demand, Hottest).
- **Trending (🔥 10+ couples) is not drawn.** It is ruled (DECISION_LOG 14 Nov, v7), but no counter or admin kill switch exists on main, and both need a migration. Until they exist, nothing claims trending demand.
- Guard: `lib/the-check-a-date-opens-in-page-v16-s5.test.ts`, four tests, each sabotaged red.

SPEC IMPACT: None. This builds the 14 Nov (SHOP-02 v7) and 15 Nov rulings already in DECISION_LOG and the v16 drawing.
