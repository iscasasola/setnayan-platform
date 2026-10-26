## 2026-10-27 · feat(home): the Papic card moves to the row after Budget

Owner, verbatim: *"Place papic under budget widget"* · *"Place it on the next row after the budget widget"*. Home's
Papic card (shipped under the Today line on 2026-10-26, #6979) now follows the control row, whose last tile is Budget,
and stays above Your services. Same card, same controls — only its place moved. Guard
`papic-lives-on-home.test.ts` § 1 now asserts the card sits after the Budget card (sabotage: card back above the
row → red).

SPEC IMPACT: DECISION_LOG row "PAPIC CARD ON THE ROW AFTER BUDGET" (amends 2026-10-26 "on the today").
