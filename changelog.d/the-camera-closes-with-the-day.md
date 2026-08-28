## 2026-08-29 · fix(privacy): a supplier's camera closes when the celebration is over

Owner, 2026-08-28, ruling on the supplier capture lane: ***"they get to use it
until event day."***

**What was true before: the lane had no time bound at all.** The capture route
gated on a session, the privacy control, a booked event, consent and the tier's
point budget — and nothing whatsoever about *when*. A supplier booked on one
celebration could keep shooting into it a year later.

**The rule is not a new one.** "Over" already has ONE answer in this product:
06:00 in the **venue's** clock on the day after `COALESCE(event_end_date,
event_date)`, or the moment the host presses *Close out the day*.
`getMenuLifecyclePhase` owns it. The six hours (a Filipino reception runs past
midnight), the LAST day rather than the first (a festival's middle days are not
"after") and the calendar-day step (never `+24h`, which lands an hour off across
a DST boundary) were all argued out there. Re-deriving any of them here is the
second opinion this codebase keeps paying for.

🔑 **The reading this encodes, stated so it can be corrected in one word:**
*"until event day"* is taken as **through the day, closed after it** — a supplier
delivers ON the day, and a lane that shut before it would be useless on the one
day it exists for.

**What the tests pin, each a real way to get this wrong**

- Open all through the day, and **past midnight** — the most likely real capture
  of the night, which a midnight boundary would refuse.
- Closed at 06:00 the morning after, and closed six months later.
- **Still open in the months before** — a cake maker photographs the cake when
  the cake is made. Only the far end moved.
- A multi-day celebration stays open through its **last** day.
- The **venue's** clock decides: 06:00 Manila is 22:00 UTC the previous day, so a
  server reading its own clock would close a Manila wedding's lane eight hours
  early.
- The host's *Close out the day* closes it immediately.
- The gate runs **before** the upload and before any points are spent.
- **Fails OPEN** — an unreadable event, a missing date or an unknown timezone
  leaves the lane open. A transient read failure must never stop a supplier
  capturing on the one day they are standing at the venue.

**And a false comment is corrected.** The route's docblock said the control was
*"default OFF … this route 403s and no guest PI is collected"*. It has been
**ACTIVE in production since 2026-07-16 04:51 UTC**, approved by the owner — and
six weeks of planning read that comment and believed the lane was shut. A privacy
control's state lives in the database; a comment describing it is a claim with an
expiry date.

🪤 **Three of my own guards were decoration, and only mutation testing found
them.** The route-wiring test matched the column names *anywhere in the file* —
but they also appear in the `.select(...)`, so removing the last day, the venue's
clock and the host's close-out from the resolver call left all three strings in
place and the test green. Three real regressions, invisible. It asserts the
**argument list** now.

🪤 Two smaller ones in the same pass: `indexOf('r2Upload')` matched the **import**
on line 4, so an ordering test failed on correct code; and a `/default OFF/`
match found the sentence *correcting* the claim and called it the claim.

**Measured** · 12 tests for the window · **11,125 unit pass, 0 fail** · 5
mutations, each measured by occurrence count before → after, all RED.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-29.
