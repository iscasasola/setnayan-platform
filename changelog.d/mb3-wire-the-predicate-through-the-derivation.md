## 2026-09-03 · fix(mood-board): the fork's "already chosen" wiring is now guarded, not just assumed

Follow-up to MB3 (PR #5151). A peer oversight session sabotage-tested the merged PR by
hard-coding `page.tsx`'s `alreadyChosenMajors={hasChosenMajors(palette)}` prop to `true` and
found every existing test stayed green — `lib/mood-board.test.ts` pins `hasChosenMajors`
directly, and `theme-path-fork-renders.test.ts` paints `<TemplateGallery>` from a boolean it
takes as a prop and never questions. Both ends of the wire were tested; the wire itself
was not.

- **Structural fix, not just a guard.** `<ThemeStudio>` already receives `palette` (to hand
  down to `<ThemeCard>`); it now derives `hasChosenMajors(palette)` itself instead of taking a
  separately-computed `alreadyChosenMajors` boolean from `page.tsx`. There is no longer a
  second call site that could disagree with the first — `page.tsx` only passes `palette`.
- New guard `theme-studio-wires-the-predicate.test.ts` renders `<ThemeStudio>` with real
  `RolePalette` values (never a hand-fed boolean) and reads which fork state paints.
  Sabotage-tested live: reverting the derivation to a hard-coded `true` (the exact
  regression the peer session found) turned the "fresh board" and "other keys set, reception
  empty" cases red while leaving the "already chosen" case green, proving the guard watches
  the derivation, not a coincidence.

SPEC IMPACT: None.
