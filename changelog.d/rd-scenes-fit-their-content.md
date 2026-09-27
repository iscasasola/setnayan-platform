## 2026-09-28 · fix(event-hub): every scene is as tall as its content — Scrub and Auto too — and the progress line has no blank

- **Scrub** no longer pins every scene at one full screen. The scenes of a run are stacked in one
  grid cell; each scene's frame is `position: sticky` inside a slot stretched to the run, so it pins
  exactly as tall as its content under the progress line. The spacers stay the clock (one
  `--hub-step` row each, in a zero-width column, so they still abut), and every cross-fade range is
  measured from the pin line (`--hub-at`), not from the screen height. A run of two short scenes
  went from 3,714px of scroll to 1,013px at 390 wide; the gap before and after a run went from
  ~400px to the page's 1rem rhythm.
- A frame followed by another scene is capped at the screen and scrolls inside itself (it fades while
  pinned); the run's LAST frame is uncapped and scrolls on with the page, so a tall last scene (Love
  Story) is now read to its end without an inner scroll. A capped frame's body clips its parts'
  rise, so a short frame never becomes scrollable by accident (measured: 144px frame read
  scrollHeight 170 before the clip).
- **Auto** runs are as tall as their tallest scene (no `min-height: 100svh`, no screen-sized
  padding); the Pause button sits in the run's top-right corner.
- **Progress line** (owner: "look at the progress line, there was a blank"): a section that renders
  nothing (Countdown with no date) kept a segment whose timeline never existed, so it stayed empty
  while later ones filled. Empty scenes are now `display: none` on every engine, and a segment has
  no width until its own section's timeline is live. Every segment fills on ONE line
  (`SCENE_PROGRESS_RANGE`), so they fill strictly in page order.
- New guard `lib/a-scene-is-as-tall-as-its-content.test.ts` (5 properties, each sabotage-proven);
  `a-hybrid-page-renders-runs` and `hub-scenes` tests moved to the new geometry.

SPEC IMPACT: None — implements the DECISION_LOG rows "A SCENE IS AS TALL AS ITS CONTENT" and
"SCRUB SCENES ALSO FIT THEIR CONTENT" (2026-09-27), already recorded.
