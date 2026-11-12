## 2026-11-12 · feat(chat): an ask starts from the part it changes · the (+) and picker sheets open at half (rulings 6076 · 6106)

- **6076** — the host's (+) loses its generic "Ask for a change" row (and `/ask`). An ask now starts from the part
  being changed and carries it: the shipped `AskChangeDoor` (`ask-change-card.tsx`) is offered on each quote line,
  on the payment plan and on a sent form, pre-attached to that part. Poll (`pollRow`) is unchanged.
- **6106** — the (+) sheets (supplier `thread-tools-sheet.tsx`, the hosts' equivalent) and the picker sheets opt in to
  the shipped `Sheet` `half` + `snap` (open at half, drag up to full, drag down back).

SPEC IMPACT: None (implements DECISION_LOG rulings 6076 and 6106 as written).
