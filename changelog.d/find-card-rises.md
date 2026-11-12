## 2026-11-12 · feat(suppliers): the card view rises full-screen and a sideways swipe walks the category

- **Full-screen rises** (shared `Sheet` `rise` + `full`): the supplier/service card view and the ideas board ("More ideas"). The scoped search and "Search all <Category>" already open the full-screen `CategorySearchOverlay`.
- **Swipe sideways on the card BODY → next / previous supplier** in the open category, in the order the page draws them (Booked → Asked → Suggested). A "2 of 5 in Catering" peek row names both ends; each end is a 44 px button. The order is read from the page (`data-sheet-ring`), so it never disagrees with what the couple sees.
- **Gestures never collide** (prototype rules): where the finger starts decides the owner — a swipe that starts on the photo (`data-swipe-photo`, or anything that scrolls sideways) stays the photo's; the first 8 px lock the axis; 60 px steps; 80 px down from the photo or from the top of the body closes; the body keeps `touch-action: pan-y`; the tap that ends a swipe is swallowed.
- The slideshow on top is NOT built here (it belongs to the service-card session); its photo area only needs `data-swipe-photo`.

SPEC IMPACT: None beyond DECISION_LOG row 2026-11-12 "Find is organized by the plan" (Setnayan-specs 98e10d4d), which already records the rises and the swipe.
