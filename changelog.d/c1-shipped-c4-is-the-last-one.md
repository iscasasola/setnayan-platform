## 2026-08-31 · docs(build-sessions): C1 shipped — all ten built, C4 is the last one

C1 was spawned into the overseer session at ~13:50Z. **RULE 0's `git fetch` found it had already
merged 23 minutes earlier** — PR #5046, `feat(people): draw the connection tree — kinship-derive
finally reaches a screen`, merged 2026-08-31T13:27:51Z. Nothing was built. Autonomy rule 14:
premise FALSE, say so, stop.

**Verified against C1's own PROVE IT rather than against the merge notification:**

- rendered on the People surface — `people/page.tsx` → `connection-tree-section.tsx`
- blood vs courtesy visually distinct — `switch (person.basis)` into separate layers, with a test
  named *"a blood tita and a courtesy tita both appear, in different layers"*
- draft and pending appear nowhere — `.eq('status','confirmed')` **at the query**, plus two further
  drops; the module's own docblock says *"three checks for one rule is deliberate"*
- the module was NOT given a hop cap — `git diff 730f6875a..54050e605 -- lib/kinship-derive.ts` is
  **empty**, which is what C1 required (volume management is the UI's job)
- `# tests 16 · # pass 16 · # fail 0` — non-zero, so not the zero-tests-zero-failures shape

It also carries a test named *"a refused person read reports unmeasured, not an empty tree"* — the
programme's founding disease, handled at the render.

🔑 **How this was caught is the lesson.** The board was refreshed at 11:25Z and correctly said C1
was unbuilt. C1 merged at 13:27Z. The `git fetch` at the top of RULE 0 caught it at ~13:50Z. **A
tracking document is accurate only at the instant of measurement** — this is the third incident of
that shape in this programme in two days, and the reason RULE 0 opens with a fetch rather than a
read.

**C4 is now the only session left**, and its premise was re-verified today: no route exists under
`app/**/dependent*` — only `people/_components/dependents-section.tsx` and `dependent-actions.ts`,
which are a section on the People page, not a page of their own. Its gate (C1 merging) is open.

SPEC IMPACT: None — programme tracking.
