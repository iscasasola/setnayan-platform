## 2026-09-10 · docs(build-sessions): point PROVE-THE-FLOW at the round-1 test plan and its blockers

The resume doc for the two-sided live test still described the September 8th frontier
(reply in the thread, on `Cale & Ice`). Round 1 of the owner's live test uses a different,
non-internal couple account and cannot run honestly until five in-flight sessions land
(the optional gift, the Lock-without-a-price bug, the dead end after accepting a quote,
nameless cards, and a locked shop's place on the list). Added a table naming each blocker,
its session, its PR, and the re-check command, plus a pointer to the owner's one-page prep
script in the spec corpus (`Test_Script_Live_Two_Sided_2026-09-10.md`).

SPEC IMPACT: None (the spec-corpus script itself is a separate, non-code change — see the
corpus's own `DECISION_LOG.md`).
