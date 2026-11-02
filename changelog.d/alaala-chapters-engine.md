## 2026-08-19 · feat(alaala): the chapter engine — an event's frames, by the moment they happened in

**SPEC IMPACT:** None yet — this is the pure engine. **It is not mounted on any
screen; nothing renders differently.** The album view that uses it is the next PR.

Owner 2026-08-19, deciding the rule the whole file is shaped by:
*"chapter happens depending on the time, not who took it."*

So a chapter is **a window of time**. Every schedule block makes one — guest-facing
or backstage — and crew photos and guest photos land in the same chapter when they
happened in the same hour. **One timeline, never one per source.**

### The four rulings, implemented

| ruling | behaviour |
|---|---|
| time decides, not authorship | every block becomes a chapter, backstage included |
| a photo in a gap | its own chapter, named by time of day ("Afternoon") |
| an event with no schedule | grouped by venue day, nothing invented |
| a day that ran late | the real clock when it was recorded, else the plan |

### ⚠ The hazard this file exists to contain

**A schedule time and a capture time are not the same kind of value.**

`event_schedule_blocks.start_at` stores the venue's **wall clock** in a UTC column —
prod reads `Dinner 18:45+00`, meaning quarter to seven *at the venue*. Proof it is a
wall clock, from prod itself: read as instants that same evening becomes Cocktails
01:00, Dinner 02:45, First Dance 04:00, Send-off 05:45. No wedding runs like that.

`papic_photos.captured_at` is a **real instant** — prod reads `04:53:49+00`, which
is 12:53 in Manila.

Compare them directly and every frame lands **eight hours out**: dinner photos file
under hair & make-up. Nothing throws; the chapters render beautifully holding the
wrong photographs. Every schedule value goes through `plannedInstant`, whose own
docblock states the rule.

⚠ **And `actual_start_at` is ALREADY an instant** — converting it too would shift it
a second time: the bug wearing the fix's clothes. A test pins that in both
directions.

### Overlap, which is real in production and not hypothetical

One event has *Hair & makeup / preparations* 08:00–12:00 overlapping *Vendor ingress
& styling* 10:00–13:00, so an 11:00 frame sits inside **both**. **The shorter window
wins** — a four-hour block is background, a tighter one is the thing happening. Ties
break on later start, then block id, so the result never depends on row order.

### Nothing is ever dropped

A frame with no capture time cannot be placed in time, so it lands in its own
trailing group rather than disappearing. A gallery that silently loses photographs
is the one outcome worse than an ugly one.

🛡 **11 tests over PRODUCTION'S OWN SCHEDULE**, copied from the live database.
All four sabotages measured by occurrence count as landed (1→0 · 1→0 · 1→0 · 2→1)
and each confirmed RED — **the naive raw comparison takes FOUR tests down.**
Green under **UTC, Asia/Manila and America/New_York**: CI runs in UTC, the one clock
where a wall-clock/instant mix-up cancels out and looks correct.

⏭ **Next:** the album view renders these chapters, plus the per-event Life-Flash
(already a supported scope, gated at 3+ moments).
