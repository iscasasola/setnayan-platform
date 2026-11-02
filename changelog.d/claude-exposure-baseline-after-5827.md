## 2026-09-21 · chore(security): exposure baseline header matches its body again

`lint exposure baseline` (a required check) failed on `main` and on every open
PR: "header declares 6429 facts but the body holds 6430". Two same-hour merges
each regenerated the file; git combined one's body line with the other's header
counts. Regenerated from the merged tree: only the two header counts change
(`facts` 6429→6430, `col` 4736→4737); no fact line added or removed, so no new
anon/authenticated reach.

SPEC IMPACT: None
