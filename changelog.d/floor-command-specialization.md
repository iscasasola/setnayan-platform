## 2026-07-27 · feat(vendor-dayof): Run the floor — the coordinator specialization (the third and last)

Registers `floor_command` via the registry's two-step recipe: one component in
its own new subdirectory, one line in `SPECIALIZATION_SURFACES`. `page.tsx`,
`specialization-slot.tsx` and `lib/vendor-dayof-frame.ts` untouched. All three
specializations — song desk · script & cues · run the floor — now ship.

**This is assembly, not construction.** The owner's note ("we already had this
prior") was right, and the Rule-0 audit before any code confirmed every tool the
gate's blurb names already exists: the run-of-show header + `advance_schedule_block`,
the event QR kit, the check-in / seat-lookup desk, and `requests-inbox.tsx` —
which is already coordinator-aware by construction ("the booked COORDINATOR sees
every lane and triages"). Nothing was re-drawn.

The audit found exactly **three holes**, and this closes those and nothing else:

1. **The inbox was a link AWAY.** `moduleHref('issues_log')` sends the
   coordinator back to `/vendor-dashboard/on-the-day` — out of the fullscreen,
   wake-locked console they are standing in — to reach the tool they use most.
   Now inline. Mounted via `IssuesLog` rather than `RequestsInbox` directly, so
   the device-local offline log survives as the fallback on venue wifi.
2. **They could not ADVANCE.** `RunOfShowHeader`'s advance control is gated
   behind `canAdvance`, which defaults false and which the live page never
   passes. So the person running the floor could not move the show along from
   the floor console — while every other screen waits on that pointer, including
   the host/MC cue card shipped hours earlier, which reads "You're on: <block>"
   from `run_state` alone. `advance-control.tsx` is that control, and it says
   out loud that everyone else's screen follows — a control with an invisible
   blast radius is one people are afraid to press.
3. **Nothing crossed "what's open" against "where the show is."** Both facts
   ship separately; the cross is new, and it is the judgement a coordinator
   makes over and over: 20 minutes behind with four things unresolved — push, or
   fix? `lib/floor-command.ts` makes that one call (15 tests).

**Lateness RAISES the bar for advancing, not lowers it** — the one opinion in
the module. Running behind is when pushing is most tempting and most expensive:
every open request is a supplier waiting on an answer, and advancing past them
converts a late show into a broken one. Late **and** unresolved is the only
state that says stop; either alone does not.

Status pings are never work — reuses the shipped `countsAsOpenWork`, so a
supplier saying "we've arrived" can never hold the floor.

**Gate proven by neutralisation** (run, observed, reverted; recorded in the test
header): dropping the `behind && openWork > 0` arm fails exactly 3 of 15 and
nothing else, which is the proof the tests hold the CROSS rather than either
fact alone.

**Reused, never forked:** `summarizeInbox` / `countsAsOpenWork` / `sortInbox`
(`lib/day-requests.ts`) · `deriveRunOfShow` / `driftLabel` (`lib/run-of-show.ts`)
· `advance_schedule_block` (self-gating, single-winner, idempotent — a double
tap or a race with the couple's own screen is a benign no-op).

Data boundary: `fetchRunOfShowBlocks` and `getDayRequestsView` both run under the
caller's own RLS, scoped to `eventId`; the requests view additionally fail-closes
to inactive before its Data Privacy control is approved, and the desk still
renders its run-of-show half in that state. No admin client on this path.

Verified: `tsc --noEmit` clean · `next lint` 0 errors · full unit suite
4564/4564 (15 new) · production build green.

SPEC IMPACT: None. No schema, no new tool, no pricing or locked-decision change.
`floor_command`, its `coordinator` tile mapping and the `solo` tier floor were
all locked 2026-07-26/27 and are consumed as-is.
