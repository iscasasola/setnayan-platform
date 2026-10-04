## 2026-10-04 · feat(setup): Finish your Event Hub asks which stage to get ready, then only that stage's facts (PR-2)

"Finish your Event Hub" now opens with **"Which stage do you want ready?"** —
Save the Date · RSVP · Invitation · The Day · Post Event, the same five the
Maker's Page ▾ names — each with its own "n of m" counted from the facts THAT
stage shows, and the whole ("9 of 20 in place") once above. Picking a stage
opens its **Before we start** the first time (the approved 2026-10-01 frame 0,
filtered to the stage: already have · media that helps · we'll ask; "I'm ready"
and "Start anyway" both go to the first step still to do), then the steps one
fact at a time, each opening the SAME Details editor the Maker uses — on a
phone in the half sheet over the live page (`MakerHalfSheet`: the step ▾ and
its line, the field, Back · Skip · Next, Peek, the slim bar). A Ready screen
closes each stage and leads back to the picker with every stage's progress.

- NEW `lib/stage-setup.ts` derives each stage's parts from `STAGE_SCENES`, the
  fixed top part, the fixed entourage / greeting / Find your seat, and the RSVP
  stage's three settings (`RSVP_PIECES`: how guests get in · what to ask ·
  reply by). `STEP_PARTS` names the part(s) that show each fact; a stage is a
  filter over the one record — a fact two stages share (names, date) is ONE
  step, asked once and counted for both. Post Event is listed, never walked.
- `lib/details-guided-flow.ts`: `GuidedRound` is now the stage key; steps carry
  `stages` and an optional `piece` (RSVP's sections); screens gain `stages` and
  `before`; the address is `?guide=1` (picker) · `walk-<stage>` ·
  `before-<stage>` · `ready-<stage>`. The prints look-overs leave the walk (no
  scene draws them); the special message is its own fact; "Photos from your
  guests" joins The Day.
- `lib/hub-setup-steps.ts`: `HubSetupRound.guestList` — an open event's RSVP
  stage asks only how guests get in. The setup's steps are walked in the stages
  that show them; B5–6 is the RSVP stage's own settings.
- The three doors (Home's "Finish your Event Hub" card — now "n of m · Pick a
  stage", the Maker's What's left, the once-offer) all open the picker.
- The floating "● Finish · n of m" chip that sat over the page (it covered the
  page's own header line at 375 px — "Sat, 12 Dec 2026 · 69 days to go") is
  gone: the setup's progress is one button in the sheet's header, and in the
  flow the step sheet's own ▾ line. Render-guarded (nothing of the flow is
  absolutely placed over the top of the page).
- **B6**: the cover step shows Look › Background's own row — the same node
  (`lookPages.look.background`), one value, one `saveMain`; the theme picker's
  "Samples · Maria & Jose" label is now "Each theme on a sample Event Hub".
- Guards (each sabotaged red → restored green): NEW
  `lib/a-stage-counts-only-its-own-facts.test.ts` (a stage's count = the facts
  its parts draw; a shared fact asked once) and
  `lib/setup-by-stage-opens-and-writes-nothing.test.ts` (Start anyway skips
  Before we start · opening writes nothing · the background step and Look ›
  Background show one value · the label); `details-guided-flow.test.ts`,
  `hub-setup-steps.test.ts`, `one-panel-at-a-time-on-a-phone.test.ts` and
  `the-maker-keeps-the-page-on-a-phone.test.ts` re-pinned to the stage model.

SPEC IMPACT: DECISION_LOG row "BUILT — PR-2 SETUP BY STAGE" (corpus
`DECISION_LOG.md`) records the build against `EVENT_DETAILS_STUDY_2026-10-04_fable.md`
§ 7 PR-2 and B6. Two calls flagged for the owner: the stages wear the one stage
vocabulary for every type (a wake's Ready lines stay its own), and the prints
look-overs left the walk (they are no stage's fact).
