## 2026-11-03 · chore(mood-board): the mood board's ✕ marks are all kept kinds — moved to ALLOWED

Owner 2026-11-03 (DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). Swept the mood board
for list rows with a visible ✕: there are none. Every mark is one of the kinds the ruling keeps — a pinned photo's ✕ in
the image grid (tile), the "Remove this photo?" box's own Remove (confirm), a Do / Don't input's ✕ in the dress-code
form and a custom role's ✕ in the palette editor (editor fields), colour swatches and read theme chips (chips). The five
files move from the shrink-only baseline to `ALLOWED` in `lib/no-delete-x-on-list-rows.test.ts`, each with its reason.
No UI change.

SPEC IMPACT: None
