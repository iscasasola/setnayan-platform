## 2026-09-27 · feat(event-hub): each stage does one job — its own scenes, its own order, its own bar

DECISION_LOG 2026-09-27, "EACH STAGE DOES ONE JOB" and "EVERY SCENE DRAGS WITHIN
ITS STAGE (ORDER SAVED PER STAGE) · SAVE THE DATE: THE COUPLE PICKS FILM OR
PHOTOS". The controller measured the live Maker: Save the Date, the Invitation
and On the Day drew the same scenes in the same order, the stage-specific ones
sat in "Not shown", On the Day had a countdown and no schedule, and Post Event
had a dress code.

- **One table, `lib/stage-scenes.ts` (`STAGE_SCENES`).** Which scenes each stage
  draws, and their order until the couple drags. `WIDGET_PHASES` is now derived
  from it, the page plan orders every stage by it (open browsing included, which
  previously had no stage fence), and the Maker navigator reads the same plan, so
  the page, the Event Bar and the navigator give one answer.
  - Save the Date: the film or the couple's photos (their pick, below) ·
    countdown · Love Story. No entourage.
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
- **Every scene drags within its stage**, built-ins included. The order is
  kept per stage on each section's own row (`config_json.stage_order`), in the
  draft first and live at Apply, never Pro. A stage nobody dragged reads the
  table; a scene with no saved place goes after the placed ones. The existing
  move actions take a `stage` field. The "order set for you" note is gone.
- **Save the Date: Film · Photos.** One Maker switch, kept on the gallery's row
  (`config_json.std_lead`) through the draft. Default: the film where the event
  type has one, otherwise the photos. Photos draws the ordinary body, led by the
  gallery, and still counts as a Save the Date view.

+0 exported "use server" functions. Tests: `lib/each-stage-does-one-job.test.ts`
(10 sabotages) and `lib/every-scene-drags-within-its-stage.test.ts` (16
sabotages), each assertion seen to fail once. Existing tests that pinned the old
per-stage lists, bar order or fixed order are re-anchored to the rulings.

SPEC IMPACT: None. Both decisions are already recorded in DECISION_LOG
2026-09-27 and in `build-sessions/STAGES-ONE-JOB-EACH-BUILD-BRIEF-2026-09-27.md`.
