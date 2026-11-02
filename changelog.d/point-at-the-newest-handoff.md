## 2026-08-19 · docs(claude): point cold sessions at the newest handoff, and inline its traps

The owner is continuing on a DIFFERENT Claude account. `~/.claude/.../memory/` does not travel,
and this file's own "START HERE" block already warns that the spec corpus is "a second repo you
may not have" — so the essentials are inlined here rather than only linked.

Carries: the 749-commits-behind home checkout (a subagent sweep aimed at it returned a coherent,
fully-traced, completely wrong finding), the seven PRs shipped today, the 11 remaining
money-first defects, the two in-repo files that define the pattern to copy, and eight traps.

SPEC IMPACT: Applied — `WHATS_NEXT_Silent_Failures_2026-08-19.md` added to the corpus and
registered at the top of `WHATS_NEXT_INDEX.md`; `WHAT_IS_LEFT_2026-08-17.md` §6 item 12 struck
and corrected in place (prod is 5 mode_a / 3 mode_b, and the live /privacy page is honest).
