## 2026-07-03 · fix(marketing): Suri comparator bar labels — one line, one shared column width

- "Other AI apps · ₱100,000" wrapped to two rows at the 118px label column
  while the Setnayan row stayed one line, misaligning the bars.
- Both rows now share one 152px label column (sized for the longest label at
  the 26-month max, "Hired team · ₱1,213,333") with wrapping forbidden — both
  labels stay single-line and both bars start at the same x, desktop + mobile.

SPEC IMPACT: None (visual fix).
