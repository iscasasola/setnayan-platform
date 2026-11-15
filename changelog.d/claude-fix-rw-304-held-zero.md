## 2026-11-14 · fix(supplier): a held analytics figure never shows a false "0" beside its true line (RW-304)

Shop analytics drew a big "0 asked" above "8 couples asked", and "0 booked" above "6 bookings". Both read the SAME
number (`countOf(totals, k)`); the figure is a held count (it counts up once its card plays) and a held count that had
never shown a number drew 0 — in the server's HTML too, so a full-page shot, a slow phone or a card not yet scrolled
to read a false zero beside the true line. `HeldCount` now keeps its place and draws nothing readable until it plays,
then counts up exactly as before. One fix covers every held figure (the count cards, the health ring, the pillars,
"how your business is doing"). No new look. Guard: `a-held-count-never-says-zero`.

SPEC IMPACT: None.
