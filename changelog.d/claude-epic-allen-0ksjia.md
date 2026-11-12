## 2026-11-12 · fix(clients): a month tap no longer freezes the page · the schedule chip leaves the Clients month

- **The freeze (owner: "When calendar is pressed on the different month, i cannot leave the page").** The Clients month wrote
  `?m=` with `history.replaceState(null, …)`. Next 15 reads a state without its `__NA` mark as an outside URL change and
  dispatches a router RESTORE, which DISCARDS the pending router action — the previous ‹ ›'s month fetch (a server
  action) — and never settles its promise. Two quick taps and no tab, link or Back could navigate again, even back on the
  first month. Reproduced in a minimal next@15.5.28 + react@19.2.6 app (2 taps → stuck; 1 tap or slow taps → fine);
  writing the address with `window.history.state` (the house pattern) navigates at every pace.
  Guard: `app/vendor-dashboard/customers/a-month-tap-never-freezes-the-page.test.ts` (verified red with one `null` put back).
- **Clients tab tapped again puts the month back** — this month, no day picked, every schedule — and the tab's own
  navigation still runs (it clears the address).
- **"All schedules ▾" under the Clients month is gone** (owner: "should be inside the show and sort and remove it from the
  page under the calendar"). The pick is Show & sort's Schedule row only. The picked client's Schedule page keeps its chip
  (it has no Show & sort). `the-schedule-pick-is-in-show-sort.test.ts` updated + test 5.

SPEC IMPACT: None in code contracts. Corpus note: DECISION_LOG "📅 CLIENTS SCHEDULE PICKER → SHOW & SORT" said the
schedule pick lives in Show & sort AND a chip under the month; the owner's 2026-11-12 ruling removes the chip from the
Clients screen (not edited from this cloud session — the corpus is not in this container).
