## 2026-09-20 · fix(invitation): the home-screen label is a word, not a cut

Seen in production minutes after #5753 shipped: `short_name` was a plain 12-character slice, so
**"Indalecio & Claire" became "Indalecio & "** — clipped mid-phrase, ending on an ampersand and a
space, under an icon on somebody's home screen.

`homeScreenLabel()` now CHOOSES the label: the whole name when it fits, else the first partner's
name (what a person says out loud), else a hard cut with trailing punctuation removed. Trailing
punctuation is stripped on every path, because "Maria, Jose, and everyone else" splits to
"Maria, Jose," which fits and still ends on a comma.

Measured on the real names: `Indalecio & Claire → Indalecio` · `Cale & Ice → Cale & Ice` ·
`Bartholomew Fitzgerald III → Bartholomew` · empty → `Invitation`.

Guarded by one new case in `their-wedding-on-your-home-screen.test.ts`, which asserts both the
length and that no label ends on punctuation.

SPEC IMPACT: None — refines the 2026-09-20 home-screen row.
