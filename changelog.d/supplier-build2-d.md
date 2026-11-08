## 2026-11-08 · perf(clients): Build 2 B2-D — one thread draw per client open + Decisions on Details (#42)

- **Build-1 bug:** opening a client ran the whole supplier thread page TWICE (the Chat and the Quotation bodies both
  render it, and the picked client builds every body per request). Every embed of the thread now shares ONE draw per
  render (`askedOnce` in `messages/[threadId]/page.tsx`, keyed by the viewer's session client and the thread); the
  draw returns the Chat, Quotation and Details-Decisions nodes together. The picked client's draw also skips the
  conversation list it never shows. Measured in a dummy-env lab (fetch counted, no network): **128 → 62 requests,
  2 → 1 thread draws, markThreadRead 1 → 1** per open — with Details' Decisions included.
- **#42 Decisions on Details:** the list in place (v118 `dec`) — every quote, meeting, adjustment, logged payment and
  guest-count change with where it stands now, the one waiting on you in the ask colour with its answer under it
  (the stream's own `ReplyControls`, landing back on Details). Drawn from the SAME draw, through the SAME merge as the
  conversation's Decisions view (`threadDecisionFacts`, moved out of the stream into `lib/thread-decisions.ts`) —
  0 requests of Details' own. A refused card read is said in one line; no conversation → "Nothing decided yet."
- Guard: `clients/[eventId]/a-client-open-draws-the-thread-once.test.ts` (one draw per open · ≤1 read mark · Details
  adds 0 requests · per-render memory only · no read in the Details body · the thread's own quote rows, centavo-exact ·
  a refused read is said). Sabotaged three ways, each red.
- Build 1's door (`details-decisions-door.tsx`, `decisionsLine`) is retired; `/dev/clients-lab` draws the real list
  on v118's five rows (`&decisions=none|partial`).

SPEC IMPACT: None — implements row #42 of the supplier Build 2 list as already ruled (v118); no decision changed.
