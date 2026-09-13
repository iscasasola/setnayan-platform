# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-07 · fix(onboarding): the summary claims the wedding exists only when it does

Found while walking wedding onboarding end to end as a real couple.

The final screen told every couple:

> *"Set na 'yan. ✨ This is the Reyes–Cruz wedding — and it already exists."*

**Measured at that exact moment: no event row existed anywhere in the database.** A
`select … from events where created_at > now() - interval '30 minutes'` returned **zero rows**
platform-wide while that sentence was on screen. The commit runs in `handleFinish`, when the couple
taps "Go to my dashboard"; the row appeared ~30 seconds later.

🔑 **A statement of fact that nothing measured** — the class this codebase guards against everywhere
else, arriving in the one place designed to feel like proof.

### The fix

`committedEventId` is the only thing that knows. It is set in `handleFinish` immediately before
navigating, so it is non-null exactly on the back-then-forward path where the wedding really *does*
already exist. The line is now gated on it:

- committed → *"— and it already exists."* (true)
- not yet → *"— ready when you are."* (claims nothing)

### Tests

3 source-anchored cases. Mutation-checked: un-gating the claim (the original bug) turns it RED, and
so does making the un-committed branch assert existence in different words. A third guard fails if
the commit ever moves ahead of the summary, so the gate is revisited rather than left asserting
something that no longer matters.

SPEC IMPACT: None — one conditional on existing copy.
