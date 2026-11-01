## 2026-11-01 · fix(maker): a ▶ tap holds its finished look until Exit preview

Owner's iPhone recording (1 Nov, iOS app): a ▶ tap on a part with no Action or Build out went back to editing by
itself about a second later, which read as "tapping does not work"; and the dark "Build in · Action · Build out" chip
sat over the app's bottom nav and stayed on screen after the return to editing.

- **Holds.** When the canvas says the play reached its end, the Maker stays in the play: the page stands on the
  finished look (a Build in built, a Build out gone — `playSequence(…, holdAtEnd)`, ▶'s single phase only; a whole
  life ends at rest, and a Motion pick's replay rests at once as before), with the whole-page preview's own "Exit
  preview" pill. Exit preview, a tap anywhere (a catch over the page, so the tap never picks a part) or Esc returns
  to editing and puts the part back at rest. The hold-▶ whole-page preview is unchanged.
- **The chip** is drawn only while ▶ plays or holds (no more 3.5 s after), inside the Maker's shell where its
  measures resolve, lifted over the app's nav with `--maker-lift` (it read `--maker-lt-h` on `<body>`, which never
  resolved there, so it fell back to 62 px and landed on Home · Guests · Hub).
- Guard: `apps/web/lib/the-tap-preview-holds.test.ts` (executed hold + four sabotage-checked properties).

SPEC IMPACT: None — implements the 1 Nov amendment already in `Maker_Animate_Preview_Scrub_LOCKED_2026-10-09.md` §4.
