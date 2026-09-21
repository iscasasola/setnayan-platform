## 2026-09-21 · fix(rail): My Home absorbs "What you run" — Events · Memories · People · Shop · Admin

Owner: *"my home and what you run must be combined. So it is My Home · Events ·
Memories · People · Shop · Admin"*. The rail's divider and "What you run"
heading are removed; the shop and HQ rows now follow People inside My Home.
Both stay capability-gated (absent, never greyed, for someone the door does
not admit). `rail-carries-what-you-run.test.ts` now asserts the order
My Home → People → Shop → HQ with no divider or heading between People and
HQ; the old heading-gating test was deleted with the heading it guarded.

SPEC IMPACT: None
