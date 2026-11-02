## 2026-09-11 · test(db): two merged suites publish their card through the H2 cover + what's-included gate

Main's CI has been red since #5442 (H2) merged at `27373ab2b`: its publish gate
refuses a live card with no cover photo or no "what's included" line, and two
suites merged just before it (#5441 `a-cards-daily-limit-really-refuses`, #5439
`a-supplier-cannot-open-a-strangers-thread`) create a live card with neither, so
their `before` hooks fail (23 tests). The fixtures now draft the card with a
cover, add one included line, then publish — the order the gate asks. Test-only;
no production behaviour changes. Both files 23/23 locally; full DB replay
2713/2713 on the merged tree (with LOCK-PATH 2, draft #5444).

SPEC IMPACT: None
