## 2026-09-10 · tools(build-sessions): a read-only watcher for the live two-sided test (T1)

`apps/web/scripts/prove-the-flow-watch.ts` reads production, read-only, after a tap of
`Test_Script_Live_Two_Sided_2026-09-10.md`'s walk (spec corpus) and prints the shop's card, the
inquiry thread, the chat Deal, the formal quote, the lock state, and the price-change trail since
lock — each in plain words, next to what the screen just showed. It never writes. The pure
sentence-building is split into `apps/web/lib/prove-the-flow-watch-format.ts` (18 unit tests,
covering both the healthy path and the exact shapes of A2 — a Deal locked with no quote and a
frozen NULL price — and B2 — a price silently replacing the old total instead of showing both,
and a negative booked total).

Per the T1 session's own instruction, this PR writes the script only — nobody starts watching
production with it here. It is invoked by hand once the owner begins the test.

`build-sessions/PROVE-THE-FLOW.md`'s rebase for today's path and the corpus one-page script
(`Test_Script_Live_Two_Sided_2026-09-10.md`) were already done by a concurrent T1 pass (PR #5405)
before this session started — not redone here; this PR only adds the watcher those two point at.

SPEC IMPACT: corpus edit already applied directly — `Test_Script_Live_Two_Sided_2026-09-10.md` now
names this script as the tool for "whoever is watching production," and a `DECISION_LOG.md` row
records it.
