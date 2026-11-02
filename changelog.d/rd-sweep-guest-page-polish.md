## 2026-10-19 · fix(guest-pages): the Save the Date monogram fits a phone; no frames on what you cannot press (sweep batch 8 — B5, C6, C7)

- **B5** — the film's opening lockup (`scale-[2.7]` on a 440 stage) ran off a 375 phone on marco-marga: the `bar`
  mark's viewBox is cropped tight and draws `overflow: visible`, so the italic capitals' ink reached past the screen.
  `lib/film-lockup-fit.ts`: `measureLockupInk` (where the ink really is — canvas glyph bounds, floored by the advance
  plus an italic lean because WebKit reports the advance) and `fitLockupScale` (the designed scale wherever the ink
  has room; only on a narrow screen, exactly small enough to stand 16px inside the edge). Desktop sizes unchanged.
- **C7** — "See our page" moves from the bottom-left corner to the film's centre line; the persistent
  "Add to calendar" chip and the hold cue stack above it (both now rise over the first-visit cookie notice too). The
  "Press and hold to pause" cue is plain type in the film's text colour instead of a grey pill (~2:1, read as a button).
- **C6** — the Everyone page's two dashed notes and /our-story's three era cards and four "kept" cards lose their
  frames (owner rule: a frame only on what you press); eras are divided by a rule, the present by a gold one.
- Guards: `the-film-monogram-fits-the-screen.test.ts` (the fit at every phone width, larger widths unchanged, the
  transform is the fitted scale, the three bottom rows stack clear by their heights, the hold cue unframed) and
  `no-frame-on-what-you-cannot-press.test.ts` (no four-sided frame on a non-pressable element in both files).

SPEC IMPACT: None — applies the standing "frames only on what you press" and phone-first rules; no ruling changed.
