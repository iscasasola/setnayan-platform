## 2026-08-02 · feat(papic): the gallery reads as a journey, not one flat feed

Owner: a wedding is planning, milestones, then the day — *"these are different
stories for their wedding"* — and travel is the days of the trip. Labelling,
owner-chosen: *"split by x months away. to x days away."*

The shared gallery now groups into chapters: **5 months to go · 1 month to go ·
30 days to go · 1 day to go · The day · After the day.** A trip counts **Day 1,
Day 2** instead.

**Derived, never filed.** A chapter is computed from the timestamp every capture
already stamps. Nothing is stored, nobody files a photo into an album, and no
"sub-event" entity was created — the couple already has a run-of-show and a
travel itinerary, and a second list that means the same thing would only drift
from the first. So a photo can never land in the wrong chapter or in none, it
works on everything already taken, and **moving the event date re-chapters the
whole gallery** — the chapter was never a fact about the photo, it is a fact
about the distance between the photo and the day.

🚨 **Every photo comes out the other side.** Anything unplaceable — no event
date, an unreadable timestamp — lands under one honest *"Everything else"*
heading rather than being dropped. Papic's governing promise is that every
capture reaches the couple, and a gallery that silently loses photos is the one
bug this feature must not introduce.

🪤 **31 days out reads "1 month to go", not "2 months"** — rounding up on the
first bucket past the switch would overstate the distance by a whole month in the
most visible place possible. And a chapter's rank comes from its real distance,
not its rounded label, so a monthly chapter can never sort after a daily one.

🪤 **Chapters are Manila dates.** 23:00 on the wedding night is 15:00 UTC the same
day, but 01:00 is 17:00 UTC the day before — read in UTC, the last hours of the
reception would file under "1 day to go".

Empty chapters never render: a couple who shot on four days sees four headings.

SPEC IMPACT: `DECISION_LOG.md` — gallery chapters are a countdown (months → days)
derived from capture time, not a stored grouping and not a new sub-event entity.
