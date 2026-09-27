## 2026-09-27 · feat(event-hub): each stage does one job — its own scenes, its own order, its own bar

DECISION_LOG 2026-09-27, "EACH STAGE DOES ONE JOB". The controller measured the
live Maker: Save the Date, the Invitation and On the Day drew the same scenes in
the same order, the stage-specific ones sat in "Not shown", On the Day had a
countdown and no schedule, and Post Event had a dress code.

- **One table, `lib/stage-scenes.ts` (`STAGE_SCENES`).** Which scenes each stage
  draws, in order. `WIDGET_PHASES` is now derived from it, the page plan orders
  every stage by it (open browsing included, which previously had no stage
  fence), and the Maker navigator reads the same plan, so the page, the Event
  Bar and the navigator give one answer.
  - Save the Date: the gallery (only when there is no film, since the film
    carries its own gallery) · countdown · Love Story. No entourage.
  - Invitation: countdown · message · Love Story · details · schedule · venue ·
    dress code · what to bring, then the entourage.
  - On the Day: schedule · venue · camera cues, then the entourage. No
    countdown.
  - Post Event: as before, minus the dress code and the countdown.
  - "Two ways to celebrate" is on no stage, Post Event included.
  - The couple's own scenes stay on every stage, after the stage's own.
- **The Event Bars.**
  - Save the Date: Home · Story · Me. No Camera, no Details.
  - Invitation: Home · Details · Story · RSVP. RSVP becomes Me once the guest
    has answered.
  - On the Day: Now · Schedule · Camera · Gallery · Me. Schedule is a new tab
    that lands on the day's details; Watch takes its place while a broadcast
    runs.
- **Maker.** A stage's own scenes keep the stage's order, so only the couple's
  own scenes can be dragged; the order note says so.

+0 exported "use server" functions. Tests: `lib/each-stage-does-one-job.test.ts`,
with each assertion seen to fail once (10 sabotages). Eight existing tests that
pinned the old per-stage lists or bar order are re-anchored to the ruling.

SPEC IMPACT: None. The decision is already recorded in DECISION_LOG 2026-09-27
("EACH STAGE DOES ONE JOB") and in
`build-sessions/STAGES-ONE-JOB-EACH-BUILD-BRIEF-2026-09-27.md`.
