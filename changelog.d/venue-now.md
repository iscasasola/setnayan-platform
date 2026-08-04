## 2026-08-04 · fix(day-of): the couple's own wedding-day screens read the right hour

The banner, the "what's happening now" card, the live schedule and the schedule
preview all asked *"which moment are we in?"* by comparing the couple's timeline
against the reader's clock. The timeline is written in the **venue's** time, so
on a Manila wedding day every one of those screens was eight hours out.

At 2 PM, as the couple walked down the aisle, their own dashboard was reading
the day as if it were 6 AM — and cheerfully offering hair and make-up as the
next thing about to happen. The countdowns were wrong by the same eight hours,
and the preview kept suggesting moments that had already passed.

All of them now read the clock **at the venue**. One value changed at the top of
each screen; every countdown, sort and comparison underneath keeps working.

The "don't show me this again" timer on the banner deliberately stays on real
time — that one is about the reader, not the wedding.

SPEC IMPACT: None.
