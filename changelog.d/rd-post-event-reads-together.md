## 2026-10-23 · perf(story): the Post Event story's reads start together — 51 trips in a row → 10

Production 2026-10-23: the guest page on Post Event took 3.7–3.9 s (couple's Maker canvas) and ~2.3 s (guest);
the page's own timer (`slug/invitation-body`) said 0.13–0.36 s — the rest was `EditorialContent` →
`loadEditorialData` → `loadStorySpineFacts`, 57 reads with 51 in single file (new `tests/story/editorial-reads.harness.ts`).
Every read needing only the event id / the day's window / the redacted story is now STARTED together and awaited
where it always was (queries moved by script, not rewritten); past-the-gate reads start only after the story's one
gate. Harness at 150 ms/trip: 51 → 10 deep, 7.7 s → 1.5 s, the same 57 reads. Adds a `slug/editorial-content`
ServerTimer line. Guard `the-story-reads-start-together.test.ts`: depth ≤ 11 for couple and guest, and a viewer the
gate turns away reads EXACTLY what is read before the gate (the harness runs the three pre-gate reads alone and waits
for in-flight reads, so a read started and dropped is counted). Sabotaged: reads serialised → red; the back cover started
ahead of the gate → red. Four guest-tree guards kept whole: the harness lives in `tests/story/`, the sample check stays
at the monogram/watermark calls, and the watch-film and story-room guards resolve `ahead.liveWatch` / `ahead.roomFreeze`
to their one definition (each sabotaged red). Full `pnpm typecheck` clean. Not yet measured on production.

SPEC IMPACT: None.
