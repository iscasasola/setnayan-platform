## 2026-09-19 · fix(overview): a couple who asked a supplier to lock is not told to "Compare & lock" that category again (SUP-69 · CPL-5)

Re-measured before building. The register row said `askedCount` is "always 0
while `isExploreReplanEnabled` is off"; both halves were wrong. `askedCount`
(the bench's coverage strip) is gated by the **lock-handshake** flag, and both
`NEXT_PUBLIC_LOCK_HANDSHAKE_ENABLED` and `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED`
read `"true"` in production (`vercel env pull`, 2026-09-19). The strip, the
plan accordion and "Your team" already said "asked, waiting".

The screen that still nagged was the **Overview**: its `event_vendors` read
never selected `lock_request_state`, so the decisions board said "Pick your
caterer · 1 option saved · none locked yet · Compare & lock" — and "today's one
thing" could say "Book your caterer" — to a couple waiting on that caterer's
yes. The Setnayan AI briefing (`lib/setnayan-ai-activity.ts`) mirrors the same
cockpit and had the same gap.

- `anyAwaitingVendor` (`lib/lock-request-state.ts`) and `hasOutstandingAsk`
  (`lib/todays-one-thing.ts`) decide it through the one shared core,
  `lockRequestStateOf` — a declined ask nags again, a stale 'pending' on a real
  booking reads as the booking.
- `pickTodaysOneThing` and `buildCockpitModel` take `lockHandshakeEnabled` as a
  parameter (pure cores); flag off is asserted byte-identical.
- Both Overview readers select `lock_request_state` and pass
  `isLockHandshakeEnabled()`; both are registered as gates, and the two cores as
  pure cores, in `lib/flag-chokepoint-scan.test.ts`.

Guarded by `apps/web/lib/asked-is-not-unbooked.test.ts` (mutation-checked:
disabling the skip, or dropping the column from the select, each turns it red).

SPEC IMPACT: None — implements register row SUP-69 (CPL-5); the row's stated mechanism was wrong and is corrected in this entry. Register status left for the controller.
