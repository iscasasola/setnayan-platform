## 2026-08-31 · perf(tests/db): the replay stops re-running migrations it can PROVE will fail — 18.4% of every replay, ~12 minutes of CI

**Follow-up to #5033, which bought correct ordering with wall clock.** That change made the drain retry every deferred migration after every successful apply, so a back-numbered file lands at the earliest index that works instead of after the whole corpus. It also slowed the `Data-layer guards (DB replay)` step — inside `typecheck + lint`, the only required blocking job.

⚠ **#5033's own PR body put that cost at "+12 minutes, +66%", and that figure was wrong — corrected there and here.** It compared one run against one `main` run. Eight `main` samples of the same step read `808 · 1087 · 1362 · 1373 · 1450 · 1453 · 1489 · 1514` seconds — median 1412 s, a **1.87× spread** — and the single sample chosen (1087 s) was its second lowest. Against the median, #5033 (three samples: 1806 · 1764 · 1772 s, all above `main`'s maximum) costs **≈ +6 minutes, ≈ +25%**. The direction was right; the magnitude was half again too big. 🔑 **CI runners are not a controlled environment, and one sample of a variable quantity is not a measurement wherever it is taken** — which is why the headline numbers below are the controlled per-replay ones, median of 3 each, back to back on one machine.

**MEASURED BEFORE DESIGNING ANYTHING, because attempts are not milliseconds.** Instrumenting `attempt()` to accumulate per-file failure time:

```
TOTAL_REPLAY_MS=9067
   958ms  866 attempts  20270110320023_invitation_widgets_our_love_story.sql
   627ms  680 attempts  20270405784887_seed_founder_vendor_demo_stats.sql
    68ms   70 attempts  20260530010000_iteration_0006_v2_1_amendment_2.sql
    17ms   69 attempts  20260530030000_..._amendment_2_titles.sql
  1670ms 1685 attempts  TOTAL WASTED — 18.4% of the replay
```

**95% of the waste is two files that can NEVER apply** (both in `ALLOWED_SKIP`), re-executed in full after every one of the ~1,270 successful applies that follow them. The two legitimately-deferred files cost 85 ms between them.

**THE FIX — skip a retry only when it can be PROVEN pointless.** A file's last error either names a database object or it does not. `parseMissingObject` reads the two shapes this corpus produces (`relation "x" does not exist`, `column "y" of relation "z" does not exist`); if the named object is still absent — one `to_regclass` / `pg_attribute` probe — the retry would fail at the same statement, because the statements before it already succeeded and the failing one still has nothing to bind to. That is not a heuristic, and it is not taken on trust either (see the audit below). Everything else resolves toward doing the work: an unparseable message, a probe that throws, a file forced eager — all attempt.

**⛔ NO CAP AND NO BACKOFF.** Both were considered and refused: either can delay a landing past a later writer, which is precisely the defect #5033 removed. The skip gate never delays anything — it declines only attempts it has proven cannot succeed.

**THE ONE CONCESSION, AND THE UNDO THAT MAKES IT SAFE.** A failure naming nothing probeable (a CHECK violation, a `RAISE`) cannot be reasoned about, so it is not retried eagerly at all — it gets one attempt in a final pass. If such a file ever *applies* there it landed after the whole corpus, which is the 2026-08-31 defect returning. So it is not reported and left: `settleOrder` **throws that database away and replays from scratch** with the file forced eager, and refuses to return one it cannot settle. A report would have been read afterwards, by someone, maybe — while every other db test in the same run had already used the reordered database.

**PROOF THE DATABASE DID NOT CHANGE — byte-identical, seven ways.** Both algorithms were run and their output digested: **5,127 columns · 477 functions · 863 RLS policies · 400 table ACLs · 1,269 applied migrations · 19 vendor-catalogue rows · 35 retail-catalogue rows.** Every one identical. Out-of-order landings identical (the same 2 files, both at index 187, neither via the final pass).

**PROOF EVERY SKIP WAS SOUND — audited, not argued.** The soundness case assumes no earlier statement in a file conditionally creates the object its error named. That is a claim about 1,271 hand-written files, not a theorem. `createReplayedDb({ auditSkips: true })` re-attempts every skipped retry and throws if one applies; run over the whole corpus, **all 1,685 skips were re-attempted and every one failed.** It is a test, not a one-off: `replay-order-is-honest.db.test.ts` runs it.

**Tests: 7 → 14.** New: the error reader parses what it should and refuses what it should not (including `column "…" of relation "…" ALREADY exists`, and the CHECK message that names a relation which *exists*); a skipped retry does not move where a file lands; an unreadable failure lands via the final pass and says so; `settleOrder` discards and rebuilds; `settleOrder` refuses to return an unsettleable database; the real corpus lands nothing via the final pass; and the audit. Two assert the saving itself (`probeSkips`/`blindSkips` above thresholds) — without them the gate could silently stop firing and every other test would still pass, on the slow path, costing the 12 minutes back.

**Mutation-tested — 5 mutants, all killed**, anchor counts printed before → after each time. (1) restore fixpoint-at-end → 8/14 fail. (2) probe gate always skips → 3/14. (3) `settleOrder` accepts the first build → 2/14. (4) the column pattern searches instead of anchoring → **survived at first**; the mutant was equivalent on today's messages, and the fix was a real missing case — `column "…" of relation "…" already exists` — after which it fails 1/14. (5) the relation pattern searches instead of anchoring → 4/14.

🪤 **Mutation 4's first run reported "0 failures" because the `perl` substitution silently did not match** — anchor count stayed 1, mutant count 0. That reads exactly like a surviving mutant with a passing suite. It is the same trap #5033 hit while instrumenting the retry loop, from the other direction: **print the anchor count before believing a mutation result, in both directions.**

**A real bug in this change, found by its own test.** `settleOrder` originally filtered late landings with `!forceEager.has(o.file)`, so a file that was forced eager and *still* landed late looked like "nothing landed late" — and the reordered database would have been returned. Now every `viaFinalPass` landing counts, and one already forced eager throws.

**Measured, three ways, back to back in one sitting so the numbers are comparable (median of 3 each):**

| replay | ordering | median |
|---|---|---|
| pre-#5033 — fixpoint at the end | **wrong** (the oldest file won) | 5,817 ms |
| #5033 — eager drain, unconditional | correct | 8,093 ms |
| this PR — eager drain, probe-gated | correct | **5,866 ms** |

**Correct ordering now costs 49 ms — 0.8%, down from 39%.** The gate skipped 1,681 retries (137 proven-still-missing, 1,544 unreadable), exactly the 1,681 extra applies #5033 added.

**Full db suite: before 1931/1931 pass, after 1938/1938 pass, 0 fail both, exit 0.** Diffed by test NAME: 7 after-only (exactly the new tests), 0 before-only, 0 status flips.

SPEC IMPACT: None — test harness only. No product behaviour, schema, or price changes; `supabase/migrations/` untouched. The database this builds is byte-identical to the one #5033 builds.
