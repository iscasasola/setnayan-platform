## 2026-09-09 · fix(story): the six stages have one home again

`lib/story-theme.ts` (the Story Maker's Theme step) held a PROVISIONAL copy of
the six-stage derivation, written while `lib/story-light.ts` did not exist yet.
A test was left behind to fail the moment it did.

**It fired.** Both landed within thirteen minutes of each other — PR #5349
(the public page's light and lens) at 05:48, PR #5346 (the Story Maker) at
06:01 — and main went red on that test, with the instruction in the message.
This is that instruction carried out.

`story-theme.ts` now adapts `deriveStages()` / `neutralStages()` and derives
nothing. The host's live preview and their published page walk the same code, so
a preview cannot drift from the page it previews. What stays here is the part
that is genuinely the host's desk: the three modes, what each resolves to, and
the board's own slot labels.

The guard is INVERTED and kept — it now fails if a second derivation is ever
re-grown here. Sabotage-checked: adding a bare stage weight back to the file
fails it by name; removing it passes. The contrast floors are now measured over
the PUBLIC page's derivation and imported from it, so the preview can never be
checked against a floor the page does not use: 72 pairs (4 palettes × 6 stages ×
3 roles), 0 under floor.

SPEC IMPACT: None.
