## 2026-09-22 · feat(invitation): the hub is cards

Second of two merges toward the arrival canvas (after the invitation card).
Every section the hub renders — the day, the place, what to wear, the rest —
now sits on one card look (paper, 14px corners, soft shadow; the chapter №
drops and the heading becomes a card title), applied from a `.sn-hub-cards`
wrapper on both the stranger's and the guest's page, so no widget was
rewritten. Before the day the programme is a short card: the first three
moments and "All N moments" (expands in place). On the day the run of show
stays whole. Guard: `the-hub-is-cards.test.ts`.

SPEC IMPACT: None beyond the 2026-09-21 invitation-card decision row.

The hub card's corner routes through `var(--m-r-md)` rather than a raw
`border-radius: 14px` (the same value, on the token scale). The radius guard
runs strict in CI and cannot see inside `globals.css` — it is excluded as the
token home — so the literal was caught only where the test restated it.
