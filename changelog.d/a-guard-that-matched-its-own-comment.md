## 2026-08-21 · fix(test): a guard that matched its own comment

`front-door-invariants.test.ts` asserted that the merged story shelf "still
states the rule it exists to keep" by matching `/one shelf/` against the RAW
feed source. The phrase also appears in an ordinary code comment in that file,
so deleting the sentence a VISITOR reads left the comment behind and the guard
stayed green.

The file already ships `code()` for exactly this, and its own docblock says
*"Strip comments so a rule mentioned in prose can never satisfy a check."*
Every sibling assertion in the file already used the stripped source. This one
did not — in the single place a prose string was being matched, which is the
only place the stripper mattered.

Proven both directions, by occurrence count:

- **M49** — deleted the visible sentence (1 → 0). Fixed guard: 24 pass / 0 fail
  → **23 pass / 1 fail**.
- **Counterfactual** — same sabotage against the ORIGINAL guard restored from
  `origin/main`: **24 pass / 0 fail**. It could not fail.

Swept the sibling front-door guards for the same shape. `rail-active.test.ts`
looked like 13 more instances but its `SHELL`/`APP_SHELL` are already stripped
— a naming difference, not a defect. No second instance exists.

SPEC IMPACT: None.
