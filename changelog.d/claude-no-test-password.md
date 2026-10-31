## 2026-11-01 · docs(security): the test accounts' password leaves WHAT_IS_LEFT.md

`WHAT_IS_LEFT.md` printed the shared password of the five production test accounts in a public repo. The line now says to ask the owner. Removing it from the file does not remove it from git history, so the owner still has to change that password.

SPEC IMPACT: None
