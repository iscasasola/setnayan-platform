## 2026-10-26 · feat(prints): Studio › Prints is a swipe carousel — one print per slide, the toolbar under it

Owner, verbatim: *"So we can make like a swipe carousel type where they can see the preview larger then under is the toolbar to
pick style? and download options?"* · *"Does it have print setting icon also"* · *"Ok build it"* (DECISION_LOG "APPROVED — PRINTS
IS A SWIPE CAROUSEL"; prototype `prototypes/prints_carousel_2026-10-26/index.html`).

- **One print per slide** (`studio-prints-carousel.tsx`): the print large at its true paper proportions; swipe (CSS scroll-snap,
  touch and trackpad), ‹ › and ← → on a computer; dots · the print's name ▾ (the grouped piece list, a jump) · ⓘ · one spec line.
  Pinch / double-tap / ctrl+wheel zoom stays on the slide; a file of several pages keeps its page badge (a press turns the page).
- **The toolbar in the lower third**: row 1 chooses (size ▾, Colours ▾ · File ▾ · Chart ▾, View as ▾ on the four guest prints);
  row 2 acts — ONE wide Download (▾ on a guest print: This one · All guests · N · Pick guests… → the shared `GuestManySheet`)
  and ⚙ Print settings (the shipped sheet; its first row is now "Your Event Hub look ◆"). The count line under it, word for word.
- **≥ 1024 px**: the piece list left, the slide centre with ‹ ›, the same toolbar right as Form rows.
- **Cheap to swipe**: only the slide on screen (at once, high) and its two neighbours (low) ask for their picture; every other
  slide is its paper's shape.
- **Same files, same routes**: every print's part now REGISTERS its slide (`prints-view-store.ts` `useRegisterSlide`) instead of
  drawing a row; the carousel never builds an address. One save for every Download (`usePrintSave`, extracted from
  `PrintSaveButton`).
- **Deleted, not hidden**: the long row list's controls (`StudioPrintHead` row, `ViewAsRow`, `AllInOneButton`,
  `StudioEditInPlace`, the row thumbnail `PrintThumb` / `PrintPaperHead`), the piece bar (`studio-prints-bar.tsx`,
  `StudioPrintsDownloadSheet`) and the tap-to-enlarge `PrintPaperSheet`; the dead `printThumbSize` box helpers. The port baseline
  is regenerated for exactly those removals. "Edit menu" / "Edit your Love Story" open from the ⓘ and the slide's empty line.
- **The dev lab reaches the owner's surface**: `/dev/maker-lab` handed Details no Studio, so its Prints opened Details' retired
  one-piece view ("INVITATION SET · The Invitation" + its editor sheet); it now always passes `studio: '1'`, as the real launch
  page always does.

Guarded by `apps/web/lib/prints-carousel-follows-the-prototype.test.ts` (Pick guests on every per-guest slide and on no other; the
Download items' routes; each slide's count line is its own file's; ⚙ on every slide; ±1 pictures only; the deleted pieces stay
deleted) — sabotaged once (Pick guests dropped → red). The guards that read the old rows now read the slides.

SPEC IMPACT: None — builds the approved 2026-10-26 prototype; the DECISION_LOG row already records the ruling.
