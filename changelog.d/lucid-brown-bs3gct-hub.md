## 2026-11-17 · fix(event-hub): the Maker says "Event Hub", not "website"; its small presses reach 44px, the monogram save cannot hang

From the couple-dashboard audit (390px, code + labs):

- **Copy.** The monogram reveal upsell said the mark plays "on your website" (twice) and the save-the-date unlock said "One unlock for your whole website" — both now say **Event Hub**. (The Love Story placeholder and the sukob prose that say "celebration" are left alone: both are reasoned entries in `lib/the-app-says-event-in-plain-words.test.ts`'s allow-list.)
- **44px floor.** Love Story's book bar (`#pick`, `#on-our-event-hub`, the Maker link, the photo menu trigger and its two submit buttons) and the Prints "all-in-one ◆" link were `min-h-10` (40px) → `min-h-11`.
- **Stuck spinner.** `monogram/animate-rows.tsx` set `busy` and awaited the save with no `finally`; a rejected server action (dropped connection) left both buttons disabled forever with nothing said. It now resets in `finally` and says the save did not happen.

SPEC IMPACT: None
