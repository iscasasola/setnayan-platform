## 2026-10-22 · perf(budget,seating): opening Budget or the seat plan draws it once

Built on #6752 (`rd/live-connections-only-where-live`), which already took Budget's Realtime channel away and gave the
seat plan's live refresh a re-read only on RE-subscribe. What was still drawing these pages twice on open was not the
socket firing — it was state set again with nothing new in it:

- **Budget** — `BudgetScreen` flipped a `mounted` flag in a mount effect so the thumb row could be portalled to
  `<body>`, re-rendering the whole screen (summary + every row) right after the first paint. The flag now lives in a
  small `BodyPortal`, so only that host renders twice. Lab: `BudgetScreen` renders **2 → 1** on open.
- **Seating** — every presence `sync` (the couple's OWN join and every re-track: on open, then each 30 s lock
  heartbeat) answered with a brand-new `Map`, re-rendering the whole editor with nobody else there. `nextPeers`
  (`seating-presence-peers.ts`) hands back the same Map when the others are unchanged, and the hook then calls no
  setState at all. The plan's live-refresh channel also joined and left on EVERY open (it listened on `!canEdit`, true
  while the lock is still `idle`/`acquiring`); it now listens only once the lock says view-only (`lockSaysViewOnly`),
  on both the 2D editor and the 3D plan. Lab: alone and editing **7 → 4** editor renders, plan channel joins 1 → 0;
  a co-planner who lands view-only **8 → 5** — a simulated change on the plan still refreshes their page once, and a
  peer arriving still re-renders it.

Guard: `apps/web/lib/budget-and-seating-render-once.test.ts` (presence list identity driven; the sync handler and
setter read from the syntax tree; every `useSeatingLiveRefresh` caller gated on `lockSaysViewOnly`; `BudgetScreen` sets
none of its own state in a mount effect). Sabotage table in the PR body.

SPEC IMPACT: None.
