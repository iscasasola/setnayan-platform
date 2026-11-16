## 2026-11-12 · feat(home): the event-day and after-the-day Home sit on the large-screen grammar; the Watch is drawn once

Tablet/desktop lane 4 — owner-approved D4 "Redo event-day/after Home" (2026-11-13). Before this, the couple Home on the event day and after it drew its console, summary and services full-bleed at every width, and the dashboard bento drew Setnayan AI's Watch TWICE (an `lg:hidden` fold and a `hidden lg:block` copy of the same rows).

- **Phone (below 701) unchanged.** Every new wrapper is `display: contents` there, so the stack and its order are exactly the phone's.
- **From 701 (`tab:`)** both states sit in the wide column (`tab:max-w-5xl`), one stack with a gap.
- **From `lg`** the stack only gains a column: what is happening now (Today asks, Ready for no signal, the day console, Who's here / the finished summary) on the left; its doors (the live desk, Your services; Who's here after the day) on the right; the receded planning tools span both underneath.
- **One Watch** — `_components/watch-fold.tsx`: one real `<details>` at every width; shut on a phone unless a row is a guard (as before), opened on arrival from 701, and its summary still folds it (never a dead control).
- New guard `app/dashboard/[eventId]/the-day-home-sits-in-the-system.test.ts`; `the-cover-is-the-top-of-home.test.ts` and `lib/every-event-wears-the-one-bar.test.ts` re-aimed at the new branch anchor with the same properties (the cover guard is stricter: the day console must now sit INSIDE the day-of branch).
- Not used: `SupplierColumns`. Its right pane is `display: none` below 701, so anything put there would have to be drawn a second time for the phone — the exact disease this lane removes.

SPEC IMPACT: None — implements the approved D4 row of the tablet/desktop plan; no decision changed.
