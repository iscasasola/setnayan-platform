## 2026-08-05 · fix(guest-site): "Happening now" stops running forever

**SPEC IMPACT:** None.

A schedule block's virtual end is its own end time, else the next block's start.
**The final block has no next**, so that was `null` — and the loop reads `null`
as *"still running"*. A couple who left the last item's end time blank had a page
saying **"Happening now · Send-off"** with a pulsing dot **for the rest of the
site's life**, to every guest who ever opened it again, weeks and months after
the wedding.

An open-ended final block is now capped at the end of its own day **in the
venue's clock**. That is not an arbitrary duration: a send-off does not continue
into next week, and the couple's own calendar day is the only boundary the data
gives. A block that genuinely runs past midnight has an explicit end time — that
is what the field is for, and it still wins.

Reuses `eventDateToEpoch` from the 2026-08-04 wall-clock work (now exported)
rather than deriving the arithmetic twice — two copies is how the halves drift
into agreeing with each other and disagreeing with the venue.

---

⚠ **THE COUNTDOWN WAS BUILT AND THEN REVERTED — this is the record of why.**

It targets `events.event_date` through `new Date(iso)` (midnight UTC), so it
expires at 08:00 Manila on the wedding morning and simply disappears. The obvious
fix is to target the venue's midnight instead. I built it, then measured it:

| venue | old | new | |
|---|---|---|---|
| Manila | 18 Dec 08:00 | 18 Dec 00:00 | **8 hours WORSE** |
| New York | 17 Dec 19:00 | 18 Dec 00:00 | 5 hours better |

Better for the Americas, **worse for the primary market** — because a countdown
to the START of a day is not what *"Until we say I do"* means. The honest fix is
to count to the **ceremony**, which needs the schedule the widget is not given: a
real change, not a one-liner. Reverted rather than shipped, and the reasoning is
pinned in `lib/day-of-tail.test.ts` so the next person does not repeat the
one-liner.
