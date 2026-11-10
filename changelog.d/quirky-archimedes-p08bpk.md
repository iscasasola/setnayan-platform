## 2026-11-09 · fix(maker): the RSVP stage shows only when guests reply

Owner, 9 Nov: *"have the 4 stages for the time being and the RSVP stage only when they have RSVP."*

- `needsHidesStage` (`apps/web/lib/event-needs.ts`) now also drops the Maker's `rsvp-stage` (the reply form · When yes ·
  When no) when the event takes no replies — `events.rsvp_ask_config.guestsReply === false`, which onboarding's
  "How do guests get in?" → no reply writes. Absent or unknown still means guests reply (today's Maker); only an
  explicit `false` hides it. No guest list still drops it, as before.
- The fact rides the Maker page's existing event-row read (`rsvp_ask_config` added to that select, read through
  `readGuestsReply`) — no new request. `EventNeedsRead.guestsReply` is optional, so every other reader is unchanged.
- Never a blank page: `needsLandingStage` lands an asked-for RSVP stage on the Invitation beside it (The Day when the
  Invitation is dropped too), and the Maker shell closes an open RSVP stage that becomes hidden on a refresh.
- The four public stages (Save the Date · Invitation · The Day · Post Event) and Home's "Pick what shows" sheet are
  untouched. "How guests get in" stays editable from Event Details and Guests › Setup, so a couple can turn replies
  back on and the stage returns.
- Known edge: the stage follows the APPLIED `rsvp_ask_config`; a reply setting changed only in the draft shows/hides
  the stage after Apply.
- Tests: `lib/event-needs.test.ts` pins no list → hidden · `guestsReply: false` → hidden · `true`/absent → shown, and the
  landing stage; `lib/what-the-event-left-off-is-absent.test.ts` pins the page and shell wiring.

SPEC IMPACT: corpus `DECISION_LOG.md` row 2026-11-09 "RSVP stage shows only when guests reply" (already written).
