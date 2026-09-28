## 2026-09-29 · feat(event-hub): Save the Date Auto walks every scene, not only the fixed ones

On the guest's Save the Date, Auto (after the film reaches its close) used to
step only through the FIXED sections — the names & date, the entourage, the
story — because the runner (`stage-autoplay.tsx`) read only those three ids.
The couple's own scenes on the stage (countdown, Love Story, their own scenes)
had no handle on the guest page, so the navigator listed `w:countdown` and Auto
scrolled straight past it.

- **One list, no second order.** `HubScenes` — the one place that holds the
  scene list the page renders, in the order it renders it — now stamps each
  scene with its navigator key (`data-stage-scene="w:<type>"`) when asked
  (`stageMarks`). The runner reads those marks and the fixed anchors in ONE
  document-order pass. Held by a render test that compares the marks with
  `makerStageList` for both the stranger's and the guest's tree, and after a
  drag.
- **Each scene's own clock.** A scene set to Auto holds for its own speed
  (`HUB_AUTO_SCENE_SECONDS` × `HUB_AUTO_SPEED_FACTOR`, the clock `autoRunTimings`
  already steps by); Scroll/Scrub hold one ordinary beat. An armed Auto run is
  ONE stop, held while every scene in it that drew plays. A Scrub scene is
  reached by scrolling its spacer, so its cross-fade still plays under the
  scroll exactly as under a thumb — its behaviour is unchanged.
- **Empty scenes are skipped** (a countdown with no date, a scene whose body is
  empty) — never a stop on a blank screen.
- **Never in the Maker's canvas** (`?editor=1`): the marks are gated on
  `plan.body === 'save_the_date' && !isMakerCanvas`, the same condition that
  mounts the runner. Every other stage, and the canvas, render byte-identical.
- **Reduced motion:** unchanged — no clock at all (the existing rule).

No migration. No new `"use server"` export.

SPEC IMPACT: None — implements the shipped Auto ("the scenes play one after
another, in the navigator's order", owner 2026-09-26) for the scenes it missed.
