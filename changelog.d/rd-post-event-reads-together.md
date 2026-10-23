## 2026-10-23 · perf(story): the Post Event story's reads start together — 51 trips in a row → 10 (WIP, unverified)

Production 2026-10-23: the guest page on Post Event took 3.7–3.9 s (couple's Maker canvas) and ~2.3 s (guest);
the page's own timer (`slug/invitation-body`) said 0.13–0.36 s — the rest was `EditorialContent` →
`loadEditorialData` → `loadStorySpineFacts`, 57 reads with 51 in single file (new `tests/story/editorial-reads.harness.ts`).
Every read needing only the event id / the day's window / the redacted story is now STARTED together and awaited
where it always was (queries moved by script, not rewritten); past-the-gate reads start only after the story's one
gate. Harness at 150 ms/trip: 51 → 10 deep, 7.7 s → 1.5 s, the same 57 reads. Adds a `slug/editorial-content`
ServerTimer line. Guard `the-story-reads-start-together.test.ts` added — NOT yet run green; typecheck not run.

SPEC IMPACT: None.
