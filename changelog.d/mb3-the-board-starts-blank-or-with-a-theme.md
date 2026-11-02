## 2026-09-03 · fix(mood-board): the blank-board promise is now kept, and nobody re-asks how you began

MB3 (see `build-sessions/MB3.md`). RULE 0 found the two-path fork already shipped in
`<TemplateGallery>` ("How would you like to begin?" — pick a designed theme, or start
with a blank board) and the 18-slot × 3-photo inspiration intake already shipped in
`<InspirationBoard>`; both are extended here, not rebuilt.

- **The blank-board promise was false.** `<TemplateGallery>`'s "Start with a blank
  board" step said "Your board stays blank" while `page.tsx` silently pre-filled the
  reception majors with real hex colors from the couple's onboarding "feel" (or the
  Chinese-wedding red/gold default) on every load with nothing saved — before the
  couple had even seen the fork. Owner's correction, verbatim: *"why can't i delete
  the first 3 colors. it is a requirement to have at least 3. but start with blank."*
  The page-level auto-seed is retired; `reception` now fills only from an applied
  theme or the couple's own edits, never a silent page-load side effect.
- **One shared predicate.** `hasChosenMajors(palette)` (`lib/mood-board.ts`) —
  `role_palette.reception` is non-empty — is the ONE answer to "has the couple chosen
  their theme colours," ported from the prototype's `majorsChosen`. Every surface
  that needs this fact reads it; `page.tsx`'s old `hasSavedPalette` (any key at all)
  answered a different, looser question and is gone.
- **The fork stops re-asking a question it already answered.** `<TemplateGallery>`
  opened on "How would you like to begin?" on every load, including a return visit
  from a couple who had already chosen — the same class of dishonesty this whole
  redesign exists to close. It now takes an `alreadyChosen` prop
  (`hasChosenMajors(palette)`) and opens on a quiet "you've set your main colours"
  state instead, with "Browse designed themes anyway" as the way back in.
- **Reception renders three genuinely empty starter slots**, not three colors. Scoped
  to the `reception` key only (`PaletteFamily`'s new `starterSlots` prop) — every
  other palette family is byte-identical. An empty slot carries no remove control
  (nothing to remove); once three real colors exist the placeholders are gone for
  good and the ordinary "+ Add color" (toward the max of 5) returns.
- **Inspiration gets its (i) affordance** — a new small `<InfoButton>` (the
  prototype's `.info-btn`/`.info-pop` pattern), scoped honestly to what ships today:
  upload-your-own only. The gallery-browsing half of the prototype's copy for this
  same info button is MB10's, not this session's, and is not promised here.

**Known gap, deliberately not closed here:** the fork does not yet hard-block color
editing in the Palette section until a path is chosen (the prototype's
`majorsAvailable`/`aiAvailable` full gate) — that needs the shared client state the
redesigned Section 02 will carry, and Section 02 (Palette) is explicitly out of
scope for MB3. Flagged for MB4/MB5.

SPEC IMPACT: None — no schema change, no locked decision altered. Corpus already
described the two-path fork as the target design; this closes the gap between that
design and what `page.tsx` actually did.
