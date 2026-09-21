## 2026-09-21 · feat(monogram): the maker is four rows — choose · make · effects · Static or Animated

The owner drew the Monogram Maker as four rows and asked for it built as drawn:
"the top part is where you make them choose. the next row is where they upload or
edit the monogram / next row is the different animation effects / next row is Use
Static Image (FREE) and Unlock Animation (500)."

- **Row 3 plays ON the mark.** Tapping an effect plays it on the design in the
  studio canvas (engine `playReveal`) or on the uploaded logo in place — no second
  preview box. The studio's own reveal panel (`#animbox`) is hidden.
- **Row 4 is the only save.** "Use Static Image · FREE" and "Unlock Animation &
  Apply" (price appended by the checkout drawer from the catalog) both save the
  mark on screen through one non-redirecting action, `commitMonogram`. The
  studio's "Save as my monogram" and the uploader's "Use this as my monogram" are
  gone; `reveal-step.tsx` / `reveal-actions.ts` are deleted. Owned →
  "Apply Animation". Store shell or unreadable price → no purchase offered.
- **Static means static.** A paid couple who presses "Use Static Image" gets
  `anim.off = true`; both guest gates (`resolveEventMonogram`, the `[slug]`
  loader) now read `owned && !markAnimationSwitchedOff(...)`. Reversible without
  paying again. Guard: `lib/static-means-static.test.ts`.
- Tempo is no longer a control; the saved preset is carried through unchanged.
- Port baseline regenerated for the deliberate removals (SaveButton, RevealStep,
  setRevealAction, saveUploadedMarkAction).

SPEC IMPACT: `DECISION_LOG.md` — new 2026-09-21 row (four-row maker, static-means-static,
`#animbox` hidden); closes the "NOT FINISHED" item of the 2026-09-20 reveal row.
