## 2026-08-01 · chore(sec): the anon-RPC backlog was 181 because nobody wrote the answers down — 130 of them were already known

The `anon-rpc-surface.baseline.txt` debt figure read **181 unreviewed**. That number was wrong in the same way as every other hand-maintained count today: **130 of those functions had already been read.**

Two audit passes examined 211 bodies between them and recorded, per function, what actually gates it. Only the nine that got *closed* were removed from the baseline; the other 130 kept their `unreviewed —` placeholder while their real answer sat in a workflow journal.

This writes them back. No new analysis, no agents.

**181 → 51.**

### 21 of them carry a corrected reason, not the original suspicion

Those functions were flagged during a sweep and then **died under adversarial refutation**. Recording them by what raised the flag would leave a baseline full of frightening sentences about things that turned out to be fine. Each of those lines instead records *why the suspicion was wrong* — `flagged, then REFUTED on re-reading: …`.

That distinction is the difference between a baseline someone reads and one they learn to skim.

### What is actually left

**51 functions** neither pass examined. A sweep over exactly those is running as this lands, so this number is expected to go to zero shortly. Its work-list was derived from the journals rather than typed — which matters, because the first attempt at that sweep was handed a hand-written list of function names, fourteen of sixteen of which did not exist.

### The guard did its job twice today

The abort added after that failure — *refuse to summarise an empty result* — fired on the very next run when the same argument-serialisation bug recurred. Previously that bug produced the sentence *"All 189 were correctly filtered. Zero exceptions."* This time it produced `ABORTED: true` and zero agents.

A guard whose first live firing catches the exact defect it was written for is worth more than the finding that prompted it.

Verified: the anon-surface guard is 5/5 against the rewritten baseline — including the check that every line carries a real reason rather than a placeholder.

SPEC IMPACT: None — documentation of an existing surface.
